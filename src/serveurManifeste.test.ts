// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import serveur from "./server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const demander = (chemin: string) =>
  serveur.fetch(new Request(`https://injoignable.mg${chemin}`), {}, {});

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
    for (const chemin of ["/marque.webmanifest", "/marque-icone-any-192.png"]) {
      const reponse = await demander(chemin);
      expect(reponse.status).toBe(503);
      expect(reponse.headers.get("location")).toBeNull();
      expect(reponse.headers.get("cache-control")).toBe("no-store");
    }
  });
});
