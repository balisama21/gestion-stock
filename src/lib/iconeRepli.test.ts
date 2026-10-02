// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { estIconeRepli, initialeDeMarque, lireCheminIconeRepli, urlIconeRepli } from "./iconeRepli";
import { pngIconeRepli } from "./iconeRepliRendu";

/** Pixel (x, y) d'un PNG RGBA sans filtre, tel que l'écrit `encoderPng`. */
function pixel(png: Uint8Array, x: number, y: number): number[] {
  const vue = new DataView(png.buffer, png.byteOffset);
  const taille = vue.getUint32(16);
  const longueurIdat = vue.getUint32(33);
  const brut = inflateSync(png.subarray(41, 41 + longueurIdat));
  const i = y * (taille * 4 + 1) + 1 + x * 4;
  return [...brut.subarray(i, i + 4)];
}

describe("icône de repli", () => {
  it("prend la première lettre ou chiffre, sans accent", () => {
    expect(initialeDeMarque("CRM Kinvest")).toBe("C");
    expect(initialeDeMarque("  éco-boutique")).toBe("E");
    expect(initialeDeMarque("3 Frères")).toBe("3");
    expect(initialeDeMarque("—")).toBe("");
  });

  it("change d'URL quand le nom ou la couleur change", () => {
    const a = urlIconeRepli("Kinvest", "#1D4ED8", "any", 192);
    expect(estIconeRepli(a)).toBe(true);
    expect(urlIconeRepli("Kinvest", "#1D4ED8", "any", 192)).toBe(a);
    expect(urlIconeRepli("Kinvest", "#DC2626", "any", 192)).not.toBe(a);
    expect(urlIconeRepli("Lova", "#1D4ED8", "any", 192)).not.toBe(a);
  });

  it("ne reconnaît que les variantes et tailles servies", () => {
    expect(lireCheminIconeRepli("/marque-icone-maskable-512.png")).toEqual({
      variante: "maskable",
      taille: 512,
    });
    expect(lireCheminIconeRepli("/marque-icone-any-4096.png")).toBeNull();
    expect(lireCheminIconeRepli("/icon-192.png")).toBeNull();
  });

  it("produit un PNG carré à la taille demandée", () => {
    const png = pngIconeRepli("K", "#1D4ED8", "any", 192);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const vue = new DataView(png.buffer, png.byteOffset);
    expect([vue.getUint32(16), vue.getUint32(20)]).toEqual([192, 192]);
  });

  it("peint la couleur de la marque, coins transparents seulement pour « any »", () => {
    const any = pngIconeRepli("K", "#1D4ED8", "any", 192);
    expect(pixel(any, 0, 0)[3]).toBe(0);
    expect(pixel(any, 96, 20)).toEqual([0x1d, 0x4e, 0xd8, 255]);
    const masquable = pngIconeRepli("K", "#1D4ED8", "maskable", 512);
    expect(pixel(masquable, 0, 0)).toEqual([0x1d, 0x4e, 0xd8, 255]);
  });

  it("dessine l'initiale en blanc sur un fond sombre", () => {
    // Le fût du I passe au centre.
    const png = pngIconeRepli("I", "#1D4ED8", "any", 192);
    expect(pixel(png, 96, 96)).toEqual([255, 255, 255, 255]);
  });
});
