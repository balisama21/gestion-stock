import { describe, expect, it } from "vitest";
import {
  estDejaDetouree,
  recadrerTransparent,
  supprimerFond,
  type ImagePixels,
  type ResultatFond,
} from "./fondCachet";

type Rgb = [number, number, number];
type Test = (x: number, y: number) => boolean;

function image(
  w: number,
  h: number,
  peindre: (x: number, y: number) => Rgb | null,
  fond: (x: number, y: number) => Rgb,
): ImagePixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = peindre(x, y) ?? fond(x, y);
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

/** Bruit déterministe, comme celui d'un capteur de téléphone. */
const bruit = (x: number, y: number) => ((x * 73 + y * 151) % 7) - 3;

/** L'opacité finale d'un pixel de l'image d'origine (0 s'il a été recadré). */
function alpha(res: ResultatFond, x: number, y: number) {
  const { image: img, origine } = res;
  const ox = x - origine.x;
  const oy = y - origine.y;
  if (ox < 0 || oy < 0 || ox >= img.width || oy >= img.height) return 0;
  return img.data[(oy * img.width + ox) * 4 + 3];
}

/** Part des pixels de la zone qui finissent opaques (ou transparents). */
function part(res: ResultatFond, src: ImagePixels, zone: Test, opaque: boolean) {
  let t = 0;
  let ok = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (!zone(x, y)) continue;
      t++;
      const a = alpha(res, x, y);
      if (opaque ? a > 200 : a < 26) ok++;
    }
  }
  return ok / t;
}

/* ── Un tampon rond bleu, sur papier blanc légèrement dégradé ─────── */

const anneau: Test = (x, y) => {
  const d = Math.hypot(x - 210, y - 160);
  return d > 100 && d < 112;
};
const texte: Test = (x, y) => x > 160 && x < 260 && y > 150 && y < 170;
const cachet = image(
  420,
  320,
  (x, y) => (anneau(x, y) || texte(x, y) ? [40, 60, 170] : null),
  (x, y) => {
    const v = 245 - Math.round((x / 420) * 15) + bruit(x, y);
    return [v, v, v - 2];
  },
);
const cœurAnneau: Test = (x, y) => {
  const d = Math.hypot(x - 210, y - 160);
  return d > 102 && d < 110;
};
const papierCachet: Test = (x, y) => !anneau(x, y) && !texte(x, y) && !cœurAnneau(x, y);

/* ── Une signature noire sur papier ligné bleu, éclairé de travers ── */

const trace = (x: number) => 150 + 60 * Math.sin((x - 60) / 45);
const trait: Test = (x, y) => x > 60 && x < 420 && Math.abs(y - trace(x)) < 2.5;
const ligne = (y: number) => y % 30 >= 14 && y % 30 < 16;
const signature = image(
  480,
  300,
  (x, y) => (trait(x, y) ? [25, 25, 30] : ligne(y) ? [165, 195, 232] : null),
  (x, y) => {
    const v = 205 + Math.round((x / 480) * 40) + bruit(x, y);
    return [v, v, v - 4];
  },
);

describe("un cachet sur fond blanc", () => {
  const res = supprimerFond(cachet);

  it("n'avertit pas, et recadre au plus près de l'anneau", () => {
    expect(res.avertissement).toBeNull();
    expect(res.image.width).toBeGreaterThanOrEqual(224);
    expect(res.image.width).toBeLessThan(250);
  });

  it("garde l'anneau et le texte opaques, efface le papier", () => {
    expect(part(res, cachet, cœurAnneau, true)).toBeGreaterThan(0.95);
    expect(
      part(res, cachet, (x, y) => x > 165 && x < 255 && y > 154 && y < 166, true),
    ).toBeGreaterThan(0.95);
    expect(part(res, cachet, papierCachet, false)).toBeGreaterThan(0.99);
  });

  it("garde le bleu de l'encre", () => {
    const { image: img, origine } = res;
    const i = ((160 - origine.y) * img.width + (316 - origine.x)) * 4;
    expect(img.data[i + 2]).toBeGreaterThan(img.data[i] + 60);
  });

  it("peut imposer une encre noire", () => {
    const noir = supprimerFond(cachet, { sensibilite: 1, encre: "noir" });
    const { image: img, origine } = noir;
    const i = ((160 - origine.y) * img.width + (316 - origine.x)) * 4;
    expect([img.data[i], img.data[i + 1], img.data[i + 2]]).toEqual([22, 24, 28]);
  });

  it("garde la résolution d'origine : aucun pixel réduit, seulement recadré", () => {
    expect(res.image.width).toBe(res.image.width | 0);
    expect(res.image.width * res.image.height).toBeGreaterThan(224 * 224);
  });
});

describe("une signature sur papier ligné", () => {
  const res = supprimerFond(signature);

  it("n'avertit pas", () => {
    expect(res.avertissement).toBeNull();
  });

  it("garde le trait, y compris là où il croise une ligne", () => {
    const cœur: Test = (x, y) => x > 65 && x < 415 && Math.abs(y - trace(x)) < 1.5;
    expect(part(res, signature, cœur, true)).toBeGreaterThan(0.95);
    const croisements: Test = (x, y) =>
      ligne(y) && x > 65 && x < 415 && Math.abs(y - trace(x)) < 1.5;
    expect(part(res, signature, croisements, true)).toBeGreaterThan(0.9);
  });

  it("efface les lignes du papier loin du trait", () => {
    const lignes: Test = (x, y) => ligne(y) && Math.abs(y - trace(x)) > 6;
    expect(part(res, signature, lignes, false)).toBeGreaterThan(0.97);
  });

  it("efface le papier, malgré l'éclairage inégal", () => {
    const papier: Test = (x, y) =>
      !ligne(y) && !ligne(y - 1) && !ligne(y + 1) && Math.abs(y - trace(x)) > 6;
    expect(part(res, signature, papier, false)).toBeGreaterThan(0.99);
  });
});

describe("un tampon rectangulaire à double cadre", () => {
  // Quatre longs traits horizontaux, comme des lignes de cahier : mais de la même encre que le texte.
  const cadre: Test = (x, y) =>
    x >= 40 &&
    x < 360 &&
    y >= 40 &&
    y < 200 &&
    (y < 44 || y >= 196 || (y >= 50 && y < 53) || (y >= 187 && y < 190) || x < 44 || x >= 356);
  const lettres: Test = (x, y) => y > 100 && y < 140 && x > 80 && x < 320 && x % 20 < 6;
  const tampon = image(
    400,
    240,
    (x, y) => (cadre(x, y) || lettres(x, y) ? [150, 30, 40] : null),
    (x, y) => [238 + bruit(x, y), 236, 232],
  );

  it("garde les quatre traits du cadre", () => {
    const res = supprimerFond(tampon);
    const traits: Test = (x, y) =>
      x >= 50 &&
      x < 350 &&
      ((y >= 41 && y < 43) ||
        (y >= 51 && y < 52) ||
        (y >= 188 && y < 189) ||
        (y >= 197 && y < 199));
    expect(part(res, tampon, traits, true)).toBeGreaterThan(0.95);
  });
});

describe("les secours", () => {
  it("avertit quand rien ne ressemble à de l'encre", () => {
    const vide = image(
      200,
      150,
      () => null,
      (x, y) => [240 + bruit(x, y), 240, 238],
    );
    expect(supprimerFond(vide).avertissement).toMatch(/Presque rien/);
  });

  it("avertit quand le fond n'a pas été reconnu", () => {
    const damier = image(
      200,
      150,
      (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [20, 20, 20] : null),
      () => [235, 235, 235],
    );
    expect(supprimerFond(damier).avertissement).toMatch(/fond n'a pas été reconnu/);
  });

  it("reconnaît une image déjà détourée et la recadre sans la toucher", () => {
    const data = new Uint8ClampedArray(100 * 80 * 4);
    for (let y = 30; y < 50; y++) {
      for (let x = 20; x < 70; x++) data.set([10, 20, 30, 255], (y * 100 + x) * 4);
    }
    const png = { width: 100, height: 80, data };
    expect(estDejaDetouree(png)).toBe(true);
    expect(estDejaDetouree(cachet)).toBe(false);
    const r = recadrerTransparent(png);
    expect([r.width, r.height]).toEqual([50, 20]);
    expect([...r.data.subarray(0, 4)]).toEqual([10, 20, 30, 255]);
  });
});
