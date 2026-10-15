/**
 * Les dates de l'organisation, dites en français.
 *
 * Aucun calcul de fuseau ici : tout passe par les helpers que le reste
 * de l'application utilise déjà (`lib/dates.ts`, `lib/evenements.ts`),
 * qui lisent le calendrier LOCAL du navigateur et jamais `toISOString`.
 * Un jour s'écrit toujours « AAAA-MM-JJ ».
 */
import { dateDuJour } from "../../../lib/dates";
import { ajouterJours, jourLocal, lundiDe, MOIS } from "../../../lib/evenements";

export { ajouterJours, dateDuJour, jourLocal, lundiDe };

export const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const JOURS_LONGS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
export const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
export const MOIS_LONGS = MOIS;

export const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const versDate = (jour: string): Date => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, m - 1, j);
};

/** Nombre de jours de `a` à `b` (positif si `b` est après). */
export const ecartJours = (a: string, b: string): number => {
  const [aa, am, aj] = a.split("-").map(Number);
  const [ba, bm, bj] = b.split("-").map(Number);
  return Math.round((Date.UTC(ba, bm - 1, bj) - Date.UTC(aa, am - 1, aj)) / 86400000);
};

/** « samedi 19 septembre ». */
export const dateLongue = (jour: string): string => {
  const d = versDate(jour);
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]}`;
};

/** « 19 sept. ». */
export const dateCourte = (jour: string): string => {
  const d = versDate(jour);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
};

/** « aujourd'hui », « demain », « lundi », « il y a 4 jours », « dans 12 jours ». */
export const relatif = (jour: string, aujourdhui = dateDuJour()): string => {
  const n = ecartJours(aujourdhui, jour);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  if (n < 0) return `il y a ${-n} jours`;
  if (n < 7) return JOURS_LONGS[versDate(jour).getDay()];
  return `dans ${n} jours`;
};

/** « 09:51 », l'heure locale d'un instant. */
export const heureMinute = (d: Date): string =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Une colonne `time` arrive en « 16:45:00 » : on n'en garde que « 16:45 ». */
export const heureCourte = (h: string | null | undefined): string | null =>
  h ? h.slice(0, 5) : null;

/** Le premier jour de la grille d'un mois (lundi), et ses 42 cases. */
export const grilleDe = (curseur: string): string[] => {
  const d = versDate(curseur);
  const debut = lundiDe(jourLocal(new Date(d.getFullYear(), d.getMonth(), 1)));
  return Array.from({ length: 42 }, (_, i) => ajouterJours(debut, i));
};

export const ajouterMoisAuPremier = (curseur: string, n: number): string => {
  const d = versDate(curseur);
  return jourLocal(new Date(d.getFullYear(), d.getMonth() + n, 1));
};
