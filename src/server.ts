import "./lib/error-capture";

import { AsyncLocalStorage } from "node:async_hooks";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { MANIFESTE_DE_MARQUE, MANIFESTE_PAR_DEFAUT, type Marque } from "./lib/marque";
import { lireMarqueDeLHote, manifesteDeMarque } from "./lib/marqueServeur";
import { initialeDeMarque, lireCheminIconeRepli } from "./lib/iconeRepli";
import { pngIconeRepli } from "./lib/iconeRepliRendu";

// Marque de l'hôte, lue par `marqueCourante()` pendant le rendu.
const marqueDeLaRequete = new AsyncLocalStorage<Marque | null>();
(globalThis as { __marqueDeLaRequete?: () => Marque | null | undefined }).__marqueDeLaRequete =
  () => marqueDeLaRequete.getStore();
const hoteDeLaRequete = new AsyncLocalStorage<string>();
(globalThis as { __hoteDeLaRequete?: () => string | undefined }).__hoteDeLaRequete = () =>
  hoteDeLaRequete.getStore();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const { marque, sure } = await lireMarqueDeLHote(url.hostname);
      const icone = lireCheminIconeRepli(url.pathname);

      // Lecture en échec : une erreur passagère, jamais le manifeste de Tantana.
      if (!sure && (url.pathname === MANIFESTE_DE_MARQUE || icone)) {
        return new Response(null, {
          status: 503,
          headers: { "cache-control": "no-store", "retry-after": "30" },
        });
      }

      if (url.pathname === MANIFESTE_DE_MARQUE) {
        if (!marque) return Response.redirect(new URL(MANIFESTE_PAR_DEFAUT, url), 302);
        return new Response(JSON.stringify(manifesteDeMarque(marque)), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }

      if (icone) {
        if (!marque) return new Response(null, { status: 404 });
        const png = pngIconeRepli(
          initialeDeMarque(marque.nom),
          marque.couleurPrimaire,
          icone.variante,
          icone.taille,
        );
        return new Response(png as BodyInit, {
          headers: {
            "content-type": "image/png",
            // Versionnée par `?v=` : un changement de nom ou de couleur change l'URL.
            "cache-control": "public, max-age=86400",
          },
        });
      }

      const handler = await getServerEntry();
      const response = await hoteDeLaRequete.run(url.hostname, () =>
        marqueDeLaRequete.run(marque, () => handler.fetch(request, env, ctx)),
      );
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
