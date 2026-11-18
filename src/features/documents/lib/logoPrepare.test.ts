import { describe, expect, it } from "vitest";
import { avecLogoDeMarque, cadreUtile, logoDeMarqueLocal } from "./logoPrepare";

/** Une image de `l` × `h`, vide, où l'on peint des pixels pleins. */
function image(l: number, h: number, pleins: [number, number][], fond: "transparent" | "blanc") {
  const px = new Uint8ClampedArray(l * h * 4);
  for (let i = 0; i < l * h; i++) {
    if (fond === "blanc") px.set([255, 255, 255, 255], i * 4);
  }
  for (const [x, y] of pleins) px.set([20, 40, 90, 255], (y * l + x) * 4);
  return px;
}

describe("le cadre utile d'un logo", () => {
  it("rogne la marge transparente autour du dessin", () => {
    const px = image(
      100,
      100,
      [
        [40, 30],
        [59, 69],
      ],
      "transparent",
    );
    const c = cadreUtile(px, 100, 100)!;
    // Le dessin va de (40,30) à (59,69), plus un liseré de 2 % de 40 px.
    expect(c).toEqual({ x: 39, y: 29, l: 22, h: 42 });
  });

  it("rogne aussi un fond blanc, celui d'une photo ou d'un JPEG", () => {
    const px = image(
      200,
      50,
      [
        [10, 10],
        [189, 39],
      ],
      "blanc",
    );
    const c = cadreUtile(px, 200, 50)!;
    expect(c.x).toBeLessThanOrEqual(10);
    expect(c.x + c.l).toBeGreaterThanOrEqual(190);
    expect(c.y).toBeLessThanOrEqual(10);
  });

  it("laisse une image vide telle quelle", () => {
    expect(cadreUtile(image(10, 10, [], "transparent"), 10, 10)).toBeNull();
  });
});

describe("le logo de la marque, faute de logo importé", () => {
  const sans = { emetteur: { logoUrl: null, initiales: "PB", fauteDeLogo: true } };

  it("remplace les initiales par le logo de la marque", () => {
    const d = avecLogoDeMarque(sans, "/marques/kinvest/logo-k.svg");
    expect(d.emetteur.logoUrl).toBe("/marques/kinvest/logo-k.svg");
    expect(d.emetteur.initiales).toBeNull();
  });

  it("garde les initiales choisies, le logo importé, et Tantana", () => {
    const choisies = { emetteur: { logoUrl: null, initiales: "PB" } };
    expect(avecLogoDeMarque(choisies, "/k.png")).toBe(choisies);
    const importe = { emetteur: { logoUrl: "data:x", initiales: null, fauteDeLogo: true } };
    expect(avecLogoDeMarque(importe, "/k.png")).toBe(importe);
    expect(avecLogoDeMarque(sans, null)).toBe(sans);
  });

  it("lit le logo d'une marque sur le site même", () => {
    expect(logoDeMarqueLocal("https://mg-kinvest.com/marques/kinvest/logo-k-512.png")).toBe(
      "/marques/kinvest/logo-k-512.png",
    );
    expect(logoDeMarqueLocal("https://cdn.exemple.com/logo.png")).toBe(
      "https://cdn.exemple.com/logo.png",
    );
  });
});
