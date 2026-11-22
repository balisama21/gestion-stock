/**
 * LE CARRÉ DES BOÎTES DE MÉDICAMENTS (GS1 DataMatrix)
 *
 * Sur une boîte, à côté du code-barres, un petit carré porte bien plus :
 * le code du produit (GTIN), le numéro de lot et la date de péremption.
 * Lu par la caméra ou une douchette 2D, il arrive sous l'une de ces
 * formes :
 *
 *   (01)03400930000120(17)280131(10)AB123
 *   010340093000012017280131 10AB123      (séparateur invisible FNC1)
 *
 * On en tire le code à comparer à celui des médicaments (le GTIN-14 sans
 * son zéro de tête est l'EAN-13 imprimé sous les barres), et, à la
 * réception, le lot et le mois de péremption, sans rien taper.
 */

export interface LectureGS1 {
  /** Le code du produit, comme un EAN-13 quand il en est un. */
  code: string;
  lot: string | null;
  /** AAAA-MM-JJ. Un jour « 00 » veut dire : fin du mois. */
  peremption: string | null;
}

const FNC1 = "\u001d";
/** Les identifiants de longueur fixe qu'on peut croiser : on les saute. */
const FIXES: Record<string, number> = { "01": 14, "02": 14, "11": 6, "13": 6, "15": 6, "17": 6 };
const VARIABLES = new Set(["10", "21", "30", "240", "241", "250", "710", "711", "712", "713"]);

const dateGS1 = (aammjj: string): string | null => {
  if (!/^\d{6}$/.test(aammjj)) return null;
  const a = 2000 + Number(aammjj.slice(0, 2));
  const m = Number(aammjj.slice(2, 4));
  let j = Number(aammjj.slice(4, 6));
  if (m < 1 || m > 12) return null;
  if (j === 0) j = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
};

const versCode = (gtin: string) =>
  gtin.length === 14 && gtin.startsWith("0") ? gtin.slice(1) : gtin;

/** Lit un carré GS1 ; `null` si ce n'en est pas un (un simple code-barres). */
export function lireGS1(brut: string): LectureGS1 | null {
  const texte = brut.trim().replace(/^\]d2|^\]C1|^\]Q3/, "");
  const champs = new Map<string, string>();

  if (texte.startsWith("(")) {
    for (const m of texte.matchAll(/\((\d{2,4})\)([^(]*)/g)) champs.set(m[1], m[2].trim());
  } else {
    let i = 0;
    const s = texte.replace(/\s/g, FNC1);
    while (i < s.length) {
      if (s[i] === FNC1) {
        i += 1;
        continue;
      }
      const ai2 = s.slice(i, i + 2);
      const ai3 = s.slice(i, i + 3);
      if (FIXES[ai2] !== undefined) {
        champs.set(ai2, s.slice(i + 2, i + 2 + FIXES[ai2]));
        i += 2 + FIXES[ai2];
      } else if (VARIABLES.has(ai2) || VARIABLES.has(ai3)) {
        const ai = VARIABLES.has(ai2) ? ai2 : ai3;
        const debut = i + ai.length;
        const fin = s.indexOf(FNC1, debut);
        champs.set(ai, s.slice(debut, fin === -1 ? undefined : fin));
        i = fin === -1 ? s.length : fin + 1;
      } else break;
    }
  }

  const gtin = champs.get("01");
  if (!gtin || !/^\d{14}$/.test(gtin)) return null;
  const lot = champs.get("10")?.trim() || null;
  return {
    code: versCode(gtin),
    lot: lot ? lot.toUpperCase() : null,
    peremption: dateGS1(champs.get("17") ?? ""),
  };
}
