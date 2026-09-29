import { cleDeNom, condense } from "./teintes";

/**
 * Les traits d'un avatar de personne, tirés du nom : teint, coiffure,
 * cheveux, tenue, lunettes, barbe. Voir `components/shared/AvatarPersonne.tsx`.
 */

export const FONDS = ["#DCEBFF", "#FDE2E4", "#E3F4E8", "#FFF1D6", "#EDE4FF", "#DDF3F5", "#F3E8DC"];
export const PEAUX = ["#F4D5B5", "#E8BB90", "#D39C6C", "#B97B4F", "#94603E", "#6E452B"];
export const CHEVEUX = ["#1E1916", "#2E231E", "#3D2B21", "#58371F", "#7A4A28", "#141414"];
export const TENUES = [
  "#2F6FDB",
  "#0B7F57",
  "#C23B70",
  "#5B5BD6",
  "#B5530F",
  "#0B7C8A",
  "#4F5E7A",
  "#8B4FC9",
];
export const COIFFURES = ["courts", "raie", "longs", "chignon", "boucles", "ras", "carre"] as const;
export type Coiffure = (typeof COIFFURES)[number];

/** Assombrit une couleur #rrggbb : l'ombre du cou, le trait du nez. */
export function ombre(hex: string, part = 0.14): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * (1 - part));
  return `rgb(${c(n >> 16)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
}

export interface Traits {
  fond: string;
  peau: string;
  cheveux: string;
  tenue: string;
  coiffure: Coiffure;
  lunettes: boolean;
  barbe: boolean;
  sourire: "doux" | "ouvert";
}

/** Les traits d'un nom : un tirage réglé par le nom, donc toujours le même. */
export function traitsDe(nom: string): Traits {
  let h = condense(cleDeNom(nom)) || 1;
  const tirer = (n: number) => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return (h >>> 8) % n;
  };
  const coiffure = COIFFURES[tirer(COIFFURES.length)];
  const courte = coiffure === "courts" || coiffure === "raie" || coiffure === "ras";
  return {
    fond: FONDS[tirer(FONDS.length)],
    peau: PEAUX[tirer(PEAUX.length)],
    cheveux: CHEVEUX[tirer(CHEVEUX.length)],
    tenue: TENUES[tirer(TENUES.length)],
    coiffure,
    lunettes: tirer(100) < 16,
    barbe: courte && tirer(100) < 30,
    sourire: tirer(2) === 0 ? "doux" : "ouvert",
  };
}

/** Le nom de chaque coiffure, pour le choix du visage. */
export const NOMS_COIFFURES: Record<Coiffure, string> = {
  courts: "Courts",
  raie: "Raie de côté",
  longs: "Longs",
  chignon: "Chignon",
  boucles: "Bouclés",
  ras: "Très courts",
  carre: "Carré",
};

/**
 * Les traits réglés à la main, posés sur ceux du nom. Ce qui vient de
 * la base est relu champ par champ : une valeur inconnue (une version
 * plus récente, une saisie abîmée) retombe sur le trait du nom au lieu
 * de dessiner un visage cassé.
 */
export function fusionnerTraits(base: Traits, perso: unknown): Traits {
  if (!perso || typeof perso !== "object") return base;
  const p = perso as Record<string, unknown>;
  const dans = <T>(liste: readonly T[], v: unknown, defaut: T): T =>
    liste.includes(v as T) ? (v as T) : defaut;
  return {
    fond: dans(FONDS, p.fond, base.fond),
    peau: dans(PEAUX, p.peau, base.peau),
    cheveux: dans(CHEVEUX, p.cheveux, base.cheveux),
    tenue: dans(TENUES, p.tenue, base.tenue),
    coiffure: dans(COIFFURES, p.coiffure, base.coiffure),
    lunettes: typeof p.lunettes === "boolean" ? p.lunettes : base.lunettes,
    barbe: typeof p.barbe === "boolean" ? p.barbe : base.barbe,
    sourire: p.sourire === "doux" || p.sourire === "ouvert" ? p.sourire : base.sourire,
  };
}
