// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import serveur from "./server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const demander = (chemin: string, init?: RequestInit) =>
  serveur.fetch(new Request(`https://injoignable.mg${chemin}`, init), {}, {});

describe("manifeste d'un domaine client", () => {
  it("lecture de la marque en échec : 503, jamais le manifeste de Tantana", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("délai dépassé");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const chemin of [
      "/marque.webmanifest",
      "/marque-icone-any-192.png",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      const reponse = await demander(chemin);
      expect(reponse.status).toBe(503);
      expect(reponse.headers.get("location")).toBeNull();
      expect(reponse.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("référencement d'un domaine client", () => {
  it("lecture de la marque en échec : 503 pour Googlebot, jamais la page de Tantana", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("délai dépassé");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reponse = await demander("/", {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    expect(reponse.status).toBe(503);
    expect(reponse.headers.get("retry-after")).toBe("30");
  });
});

describe("robots.txt et sitemap de Tantana", () => {
  const tantana = (chemin: string) =>
    serveur.fetch(new Request(`https://tantana-suite.com${chemin}`), {}, {});

  it("annoncent tantana-suite.com", async () => {
    const robots = await tantana("/robots.txt");
    expect(robots.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await robots.text()).toContain("Sitemap: https://tantana-suite.com/sitemap.xml");
    const sitemap = await tantana("/sitemap.xml");
    expect(await sitemap.text()).toContain("<loc>https://tantana-suite.com/</loc>");
  });

  it("un aperçu Netlify ferme tout", async () => {
    const reponse = await serveur.fetch(
      new Request("https://deploy-preview-9--tantana-suite.netlify.app/robots.txt"),
      {},
      {},
    );
    expect(await reponse.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
