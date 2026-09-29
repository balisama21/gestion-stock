import { describe, expect, it } from "vitest";
import { fondDominant, pastelDe } from "./vignetteDetouree";
import { cleDeNom } from "./teintes";

describe("le fond d'une vignette produit", () => {
  const pixels = (rgb: [number, number, number], n = 50) => {
    const d = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) d.set([...rgb, 255], i * 4);
    return d;
  };

  it("prend la teinte du produit, éclaircie", () => {
    // Une huile ambrée : un fond chaud et pâle, pas un gris.
    const fond = fondDominant(pixels([200, 130, 40]));
    const [, t, , l] = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(fond) ?? [];
    expect(Number(t)).toBeGreaterThan(20);
    expect(Number(t)).toBeLessThan(50);
    expect(Number(l)).toBeGreaterThanOrEqual(88);
  });

  it("reste gris clair pour un produit blanc", () => {
    expect(fondDominant(pixels([250, 250, 250]))).toMatch(/^hsl\(\d+ (1[0-2]|[0-9])% 9\d%\)$/);
  });

  it("donne à un produit sans photo un fond stable, tiré de son nom", () => {
    expect(pastelDe("Savon artisanal")).toEqual(pastelDe("savon artisanal"));
  });
});

describe("la forme stable d'un nom", () => {
  it("ignore accents, casse et espaces parasites", () => {
    expect(cleDeNom("  Héry   RABE ")).toBe("hery rabe");
  });
});
