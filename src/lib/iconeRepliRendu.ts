import { deflateSync } from "node:zlib";
import { FOND_PAR_DEFAUT, type VarianteIcone } from "./iconeRepli";

/**
 * Dessin de l'icône provisoire, côté serveur uniquement : initiale en
 * trait uniforme (police filaire A–Z, 0–9) sur la couleur de la marque,
 * encodée en PNG sans dépendance.
 */

type Point = [number, number];
type Trace = Point[];

/** Arc d'ellipse ; angles en degrés, y vers le bas. */
function arc(cx: number, cy: number, rx: number, ry: number, de: number, a: number): Trace {
  const pas = Math.max(8, Math.ceil(Math.abs(a - de) / 6));
  return Array.from({ length: pas + 1 }, (_, i) => {
    const t = ((de + ((a - de) * i) / pas) * Math.PI) / 180;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Point;
  });
}
const suite = (...parts: Trace[]): Trace => parts.flat();

// Hauteur de capitale : 100 unités.
const P: Trace = suite(
  [
    [0, 100],
    [0, 0],
    [35, 0],
  ],
  arc(35, 27, 25, 27, -90, 90),
  [
    [35, 54],
    [0, 54],
  ],
);
const GLYPHES: Record<string, Trace[]> = {
  A: [
    [
      [0, 100],
      [35, 0],
      [70, 100],
    ],
    [
      [13, 64],
      [57, 64],
    ],
  ],
  B: [
    suite(
      [
        [0, 100],
        [0, 0],
        [33, 0],
      ],
      arc(33, 24, 22, 24, -90, 90),
      [
        [33, 48],
        [0, 48],
      ],
    ),
    suite([[33, 48]], arc(36, 74, 26, 26, -90, 90), [
      [36, 100],
      [0, 100],
    ]),
  ],
  C: [arc(46, 50, 46, 50, -45, -315)],
  D: [
    suite(
      [
        [0, 0],
        [0, 100],
        [28, 100],
      ],
      arc(28, 50, 42, 50, 90, -90),
      [[0, 0]],
    ),
  ],
  E: [
    [
      [60, 0],
      [0, 0],
      [0, 100],
      [60, 100],
    ],
    [
      [0, 50],
      [50, 50],
    ],
  ],
  F: [
    [
      [60, 0],
      [0, 0],
      [0, 100],
    ],
    [
      [0, 50],
      [50, 50],
    ],
  ],
  G: [suite(arc(46, 50, 46, 50, -45, -360), [[54, 50]])],
  H: [
    [
      [0, 0],
      [0, 100],
    ],
    [
      [66, 0],
      [66, 100],
    ],
    [
      [0, 50],
      [66, 50],
    ],
  ],
  I: [
    [
      [0, 0],
      [0, 100],
    ],
  ],
  J: [
    suite(
      [
        [50, 0],
        [50, 70],
      ],
      arc(26, 70, 24, 30, 0, 180),
    ),
  ],
  K: [
    [
      [0, 0],
      [0, 100],
    ],
    [
      [62, 0],
      [0, 60],
    ],
    [
      [22, 40],
      [66, 100],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 100],
      [56, 100],
    ],
  ],
  M: [
    [
      [0, 100],
      [0, 0],
      [40, 70],
      [80, 0],
      [80, 100],
    ],
  ],
  N: [
    [
      [0, 100],
      [0, 0],
      [66, 100],
      [66, 0],
    ],
  ],
  O: [arc(46, 50, 46, 50, 0, 360)],
  P: [P],
  Q: [
    arc(46, 50, 46, 50, 0, 360),
    [
      [58, 72],
      [92, 104],
    ],
  ],
  R: [
    P,
    [
      [30, 54],
      [62, 100],
    ],
  ],
  S: [suite(arc(33, 25, 30, 25, -30, -270), arc(33, 75, 32, 25, -90, 150))],
  T: [
    [
      [0, 0],
      [70, 0],
    ],
    [
      [35, 0],
      [35, 100],
    ],
  ],
  U: [
    suite(
      [
        [0, 0],
        [0, 64],
      ],
      arc(33, 64, 33, 36, 180, 0),
      [[66, 0]],
    ),
  ],
  V: [
    [
      [0, 0],
      [35, 100],
      [70, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [25, 100],
      [50, 20],
      [75, 100],
      [100, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [66, 100],
    ],
    [
      [66, 0],
      [0, 100],
    ],
  ],
  Y: [
    [
      [0, 0],
      [34, 50],
      [68, 0],
    ],
    [
      [34, 50],
      [34, 100],
    ],
  ],
  Z: [
    [
      [0, 0],
      [66, 0],
      [0, 100],
      [66, 100],
    ],
  ],
  "0": [arc(32, 50, 32, 50, 0, 360)],
  "1": [
    [
      [4, 22],
      [30, 0],
      [30, 100],
    ],
  ],
  "2": [
    suite(arc(32, 30, 30, 30, -165, 35), [
      [0, 100],
      [64, 100],
    ]),
  ],
  "3": [arc(30, 25, 29, 25, -150, 90), arc(30, 74, 33, 26, -90, 150)],
  "4": [
    [
      [50, 100],
      [50, 0],
      [0, 70],
      [68, 70],
    ],
  ],
  "5": [
    suite(
      [
        [60, 0],
        [8, 0],
        [5, 44],
      ],
      arc(31, 68, 32, 32, -130, 150),
    ),
  ],
  "6": [
    arc(32, 67, 32, 33, 0, 360),
    [
      [54, 2],
      [6, 60],
    ],
  ],
  "7": [
    [
      [0, 0],
      [64, 0],
      [22, 100],
    ],
  ],
  "8": [arc(32, 24, 26, 24, 0, 360), arc(32, 74, 32, 26, 0, 360)],
  "9": [
    arc(32, 33, 32, 33, 0, 360),
    [
      [62, 40],
      [12, 98],
    ],
  ],
};

/** Part de la hauteur de l'icône occupée par la capitale. */
const HAUTEUR_LETTRE: Record<VarianteIcone, number> = { any: 0.46, apple: 0.46, maskable: 0.36 };

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Même seuil que `appliquerMarqueAuDocument` : lettre blanche sur fond sombre. */
function encreSur(fond: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(fond[0]) + 0.7152 * lin(fond[1]) + 0.0722 * lin(fond[2]);
  return L < 0.2 ? [255, 255, 255] : [17, 20, 24];
}

function distanceAuSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

/** Pixels RGBA de l'icône. */
export function dessinerIconeRepli(
  initiale: string,
  couleur: string | null,
  variante: VarianteIcone,
  taille: number,
): Uint8Array {
  const fond = rgb(couleur && /^#[0-9a-f]{6}$/i.test(couleur) ? couleur : FOND_PAR_DEFAUT);
  const encre = encreSur(fond);
  const traces = GLYPHES[initiale] ?? [];

  // Mise à l'échelle et centrage de la lettre, trait compris.
  const echelle = (taille * HAUTEUR_LETTRE[variante]) / 100;
  const demiTrait = 8 * echelle;
  const xs = traces.flat().map((p) => p[0]);
  const largeur = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const ox = (taille - largeur * echelle) / 2 - (xs.length ? Math.min(...xs) : 0) * echelle;
  const oy = (taille - 100 * echelle) / 2;
  const segments: [Point, Point][] = traces.flatMap((t) =>
    t.slice(1).map(
      (p, i) =>
        [
          [ox + t[i][0] * echelle, oy + t[i][1] * echelle],
          [ox + p[0] * echelle, oy + p[1] * echelle],
        ] as [Point, Point],
    ),
  );

  const bords = segments.flat();
  const marge = demiTrait + 1;
  const cadre = [
    Math.min(...bords.map((p) => p[0])) - marge,
    Math.min(...bords.map((p) => p[1])) - marge,
    Math.max(...bords.map((p) => p[0])) + marge,
    Math.max(...bords.map((p) => p[1])) + marge,
  ];

  // Carré aux coins arrondis pour « any » ; plein bord sinon (le système découpe).
  const rayon = variante === "any" ? taille * 0.2 : 0;
  const pixels = new Uint8Array(taille * taille * 4);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let couverture = 1;
      if (rayon) {
        const qx = Math.max(Math.abs(px - taille / 2) - (taille / 2 - rayon), 0);
        const qy = Math.max(Math.abs(py - taille / 2) - (taille / 2 - rayon), 0);
        couverture = Math.max(0, Math.min(1, rayon - Math.hypot(qx, qy) + 0.5));
      }
      let d = Infinity;
      if (px > cadre[0] && px < cadre[2] && py > cadre[1] && py < cadre[3]) {
        for (const [a, b] of segments) d = Math.min(d, distanceAuSegment(px, py, a, b));
      }
      const e = Math.max(0, Math.min(1, demiTrait - d + 0.5));
      const i = (y * taille + x) * 4;
      pixels[i] = Math.round(fond[0] + (encre[0] - fond[0]) * e);
      pixels[i + 1] = Math.round(fond[1] + (encre[1] - fond[1]) * e);
      pixels[i + 2] = Math.round(fond[2] + (encre[2] - fond[2]) * e);
      pixels[i + 3] = Math.round(255 * couverture);
    }
  }
  return pixels;
}

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type: string, donnees: Uint8Array): Uint8Array {
  const sortie = new Uint8Array(12 + donnees.length);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, donnees.length);
  sortie.set(new TextEncoder().encode(type), 4);
  sortie.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)));
  return sortie;
}

export function encoderPng(pixels: Uint8Array, taille: number): Uint8Array {
  const entete = new Uint8Array(13);
  const vue = new DataView(entete.buffer);
  vue.setUint32(0, taille);
  vue.setUint32(4, taille);
  entete.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const brut = new Uint8Array(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y++) {
    brut.set(pixels.subarray(y * taille * 4, (y + 1) * taille * 4), y * (taille * 4 + 1) + 1);
  }
  const morceaux = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc("IHDR", entete),
    bloc("IDAT", deflateSync(brut)),
    bloc("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let pos = 0;
  for (const m of morceaux) {
    png.set(m, pos);
    pos += m.length;
  }
  return png;
}

const cache = new Map<string, Uint8Array>();

export function pngIconeRepli(
  initiale: string,
  couleur: string | null,
  variante: VarianteIcone,
  taille: number,
): Uint8Array {
  const cle = `${initiale}|${couleur}|${variante}|${taille}`;
  let png = cache.get(cle);
  if (!png) {
    png = encoderPng(dessinerIconeRepli(initiale, couleur, variante, taille), taille);
    cache.set(cle, png);
  }
  return png;
}
