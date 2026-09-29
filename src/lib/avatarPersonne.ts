import { cleDeNom, condense } from "./teintes";

/**
 * Les traits d'un avatar de personne, tirés du nom : teint, coiffure,
 * cheveux, tenue, lunettes, barbe. Voir `components/shared/AvatarPersonne.tsx`.
 */

const FONDS = ["#DCEBFF", "#FDE2E4", "#E3F4E8", "#FFF1D6", "#EDE4FF", "#DDF3F5", "#F3E8DC"];
const PEAUX = ["#F4D5B5", "#E8BB90", "#D39C6C", "#B97B4F", "#94603E", "#6E452B"];
const CHEVEUX = ["#1E1916", "#2E231E", "#3D2B21", "#58371F", "#7A4A28", "#141414"];
const TENUES = [
  "#2F6FDB",
  "#0B7F57",
  "#C23B70",
  "#5B5BD6",
  "#B5530F",
  "#0B7C8A",
  "#4F5E7A",
  "#8B4FC9",
];
const COIFFURES = ["courts", "raie", "longs", "chignon", "boucles", "ras", "carre"] as const;
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
