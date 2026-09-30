// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { manifesteDeMarque, marqueDeLHote } from "./marqueServeur";
import { SANS_ICONE, marqueDepuisLigne, type LigneMarquePublique } from "./marque";

const ligne: LigneMarquePublique = {
  app_name: "Kinvest Gestion",
  short_name: "Kinvest",
  tagline: "Gérer simplement",
  page_title: null,
  logo_url: "https://cdn.kinvest.mg/logo.png",
  favicon_url: null,
  splash_logo_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  primary_color: "#1D4ED8",
  primary_color_dark: null,
  splash_background: "#0B1220",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("marqueDeLHote", () => {
  it("ne questionne rien pour les hôtes de Tantana", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await marqueDeLHote("localhost")).toBeNull();
    expect(await marqueDeLHote("tantana-suite.netlify.app")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("lit la marque du domaine une fois, puis la garde en cache", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    const f = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(JSON.stringify([ligne])),
    );
    vi.stubGlobal("fetch", f);
    const m = await marqueDeLHote("www.kinvest.mg");
    expect(m?.nom).toBe("Kinvest Gestion");
    await marqueDeLHote("kinvest.mg");
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(f.mock.calls[0][1].body as string)).toEqual({ p_hostname: "kinvest.mg" });
  });

  it("retombe sur Tantana si la lecture échoue", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await marqueDeLHote("inconnu.mg")).toBeNull();
  });
});

describe("manifesteDeMarque", () => {
  it("porte le nom, les icônes et la couleur de lancement du client", () => {
    const m = manifesteDeMarque(marqueDepuisLigne(ligne));
    expect(m.name).toBe("Kinvest Gestion");
    expect(m.short_name).toBe("Kinvest");
    expect(m.background_color).toBe("#0B1220");
    expect(m.icons).toEqual([
      { src: "https://cdn.kinvest.mg/logo.png", sizes: "any", purpose: "any", type: "image/png" },
    ]);
    expect(JSON.stringify(m)).not.toMatch(/tantana/i);
  });

  it("n'annonce pas d'icône vide", () => {
    const m = manifesteDeMarque(marqueDepuisLigne({ ...ligne, logo_url: null }));
    expect(m.icons).toEqual([]);
    expect(JSON.stringify(m)).not.toContain(SANS_ICONE);
  });
});
