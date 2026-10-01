// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { lireMarqueDeLHote, manifesteDeMarque, marqueDeLHote } from "./marqueServeur";
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
    expect(await lireMarqueDeLHote("inconnu.mg")).toEqual({ marque: null, sure: false });
  });

  it("garde la dernière marque connue quand la lecture expire", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([ligne]))),
    );
    await lireMarqueDeLHote("memoire.mg");
    vi.advanceTimersByTime(6 * 60 * 1000);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("délai dépassé");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const lecture = await lireMarqueDeLHote("memoire.mg");
    expect(lecture.sure).toBe(true);
    expect(lecture.marque?.nom).toBe("Kinvest Gestion");
    vi.useRealTimers();
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

  it("sans logo, annonce les PNG de repli qui rendent l'application installable", () => {
    const m = manifesteDeMarque(marqueDepuisLigne({ ...ligne, logo_url: null }));
    const icones = m.icons as { src: string; sizes: string; type: string; purpose: string }[];
    expect(icones.map((i) => `${i.purpose} ${i.sizes} ${i.type}`)).toEqual([
      "any 192x192 image/png",
      "any 512x512 image/png",
      "maskable 192x192 image/png",
      "maskable 512x512 image/png",
    ]);
    expect(icones.every((i) => i.src.startsWith("/marque-icone-"))).toBe(true);
    expect(m).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });
    expect(JSON.stringify(m)).not.toContain(SANS_ICONE);
    expect(JSON.stringify(m)).not.toMatch(/tantana|\/icon-\d/i);
  });

  it("une marque en cache d'avant le repli n'annonce pas d'icône vide", () => {
    const m = manifesteDeMarque({
      ...marqueDepuisLigne({ ...ligne, logo_url: null }),
      faviconUrl: SANS_ICONE,
    });
    expect(JSON.stringify(m)).not.toContain(SANS_ICONE);
  });
});
