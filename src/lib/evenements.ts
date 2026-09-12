import type { Database } from "./database.types";
import { dateDuJour } from "./dates";

export type Evenement = Database["public"]["Tables"]["evenements"]["Row"];
export type NatureEvenement = "rendez_vous" | "reunion" | "evenement" | "autre";
export type VisibiliteEvenement = "prive" | "equipe" | "choisis";

/**
 * Le calendrier : du calcul de dates, et rien d'autre.
 *
 * Aucune requête, aucun affichage — c'est ce qui permet de vérifier
 * qu'une semaine commence bien un lundi, ou qu'un événement tombe le bon
 * jour, sans ouvrir un navigateur.
 *
 * ── Le fuseau, qui est ici le vrai sujet ──
 *
 * Un événement porte une heure, ce qui est nouveau dans ce logiciel : la
 * base l'enregistre en `timestamptz`, donc en temps universel. Savoir à
 * quel JOUR il appartient dépend alors du fuseau du lecteur. À
 * Antananarivo, qui est à UTC+3, un rendez-vous du 13 septembre à 1 h du
 * matin s'écrit « 2026-09-12T22:00:00Z » : le lire en temps universel le
 * rangerait au 12.
 *
 * Toutes les conversions passent donc par les méthodes locales de `Date`
 * — `getFullYear`, `getMonth`, `getDate` — et jamais par `toISOString`.
 * C'est exactement le bug que ce projet a déjà connu sur les saisies de
 * nuit.
 */

export const NATURES: { valeur: NatureEvenement; libelle: string }[] = [
  { valeur: "rendez_vous", libelle: "Rendez-vous" },
  { valeur: "reunion", libelle: "Réunion" },
  { valeur: "evenement", libelle: "Événement" },
  { valeur: "autre", libelle: "Autre" },
];

export const VISIBILITES: { valeur: VisibiliteEvenement; libelle: string; aide: string }[] = [
  { valeur: "prive", libelle: "Privé", aide: "Vous seul le voyez." },
  { valeur: "equipe", libelle: "Toute l'équipe", aide: "Visible par tous vos collaborateurs." },
  { valeur: "choisis", libelle: "Certaines personnes", aide: "Vous choisissez qui le voit." },
];

export const libelleNature = (n: string) => NATURES.find((x) => x.valeur === n)?.libelle ?? n;
export const libelleVisibilite = (v: string) =>
  VISIBILITES.find((x) => x.valeur === v)?.libelle ?? v;

/** La couleur dit la nature, jamais l'importance. */
export const CLASSE_NATURE: Record<NatureEvenement, string> = {
  rendez_vous: "app-badge-info",
  reunion: "app-badge-info",
  evenement: "app-badge-success",
  autre: "app-badge-neutral",
};

export const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Le jour d'une date, en AAAA-MM-JJ, lu dans le fuseau du lecteur. */
export const jourLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Le jour où tombe un horodatage. */
export const jourDe = (iso: string): string => jourLocal(new Date(iso));

/** L'heure d'un horodatage, « 14:30 ». */
export const heureDe = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const versDate = (jour: string): Date => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(a, m - 1, j);
};

export const ajouterJours = (jour: string, n: number): string => {
  const d = versDate(jour);
  d.setDate(d.getDate() + n);
  return jourLocal(d);
};

export const ajouterMois = (jour: string, n: number): string => {
  const d = versDate(jour);
  // Le 1er du mois d'abord : sans cela, « un mois après le 31 janvier »
  // donnerait le 3 mars, février n'ayant pas de 31.
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return jourLocal(d);
};

/**
 * Le lundi de la semaine d'un jour.
 *
 * `getDay()` rend 0 pour dimanche : en France comme à Madagascar la
 * semaine commence le lundi, et c'est ce décalage que la formule
 * corrige.
 */
export const lundiDe = (jour: string): string => {
  const d = versDate(jour);
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  return jourLocal(d);
};

/** Les sept jours d'une semaine, du lundi au dimanche. */
export const semaineDe = (jour: string): string[] => {
  const lundi = lundiDe(jour);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
};

/**
 * La grille d'un mois : toujours des semaines entières, du lundi au
 * dimanche, quitte à déborder sur le mois d'avant et celui d'après. Un
 * calendrier dont la première ligne commencerait un jeudi serait
 * illisible.
 */
export const grilleDuMois = (jour: string): string[] => {
  const d = versDate(jour);
  const premier = jourLocal(new Date(d.getFullYear(), d.getMonth(), 1));
  const dernier = jourLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const debut = lundiDe(premier);
  const cases: string[] = [];
  let courant = debut;
  // On s'arrête à la fin de la semaine qui contient le dernier jour.
  const fin = ajouterJours(lundiDe(dernier), 6);
  while (courant <= fin) {
    cases.push(courant);
    courant = ajouterJours(courant, 1);
  }
  return cases;
};

export const memeMois = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** « 13 septembre 2026 ». */
export const libelleJour = (jour: string): string => {
  const [a, m, j] = jour.split("-").map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
};

/** « Septembre 2026 ». */
export const libelleMois = (jour: string): string => {
  const [a, m] = jour.split("-").map(Number);
  const nom = MOIS[m - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${a}`;
};

/** « Du 8 au 14 septembre ». */
export const libelleSemaine = (jour: string): string => {
  const jours = semaineDe(jour);
  const [, m1, j1] = jours[0].split("-").map(Number);
  const [, m2, j2] = jours[6].split("-").map(Number);
  return m1 === m2
    ? `Du ${j1} au ${j2} ${MOIS[m2 - 1]}`
    : `Du ${j1} ${MOIS[m1 - 1]} au ${j2} ${MOIS[m2 - 1]}`;
};

/**
 * Une ligne d'agenda, quelle que soit son origine.
 *
 * L'agenda mêle deux choses qui n'ont rien à voir dans la base : les
 * événements qu'on a saisis, et les échéances que le métier porte déjà
 * — un achat à régler, un devis qui expire, une course prévue. Les
 * mettre dans une même forme est ce qui permet de les afficher côte à
 * côte, triés par heure, sans que l'écran ait à savoir d'où chacune
 * vient.
 */
export interface LigneAgenda {
  id: string;
  jour: string;
  /** Vide pour une échéance, qui ne porte pas d'heure. */
  heure: string | null;
  titre: string;
  detail: string;
  /** `evenement` ou l'une des trois natures d'échéance. */
  source: "evenement" | "achat" | "devis" | "livraison";
  classe: string;
  /** L'événement d'origine, quand il y en a un. */
  evenement?: Evenement;
  /** L'écran à ouvrir pour une échéance. */
  onglet?: string;
}

export const ligneDeEvenement = (e: Evenement): LigneAgenda => ({
  id: `ev-${e.id}`,
  jour: jourDe(e.debut),
  heure: e.journee_entiere ? null : heureDe(e.debut),
  titre: e.titre,
  detail: [libelleNature(e.nature), e.lieu].filter(Boolean).join(" · "),
  source: "evenement",
  classe: CLASSE_NATURE[e.nature as NatureEvenement] ?? "app-badge-neutral",
  evenement: e,
});

/** Les lignes d'un jour donné, l'heure d'abord, puis le titre. */
export const lignesDuJour = (lignes: LigneAgenda[], jour: string): LigneAgenda[] =>
  lignes
    .filter((l) => l.jour === jour)
    .sort((a, b) => {
      // Ce qui n'a pas d'heure ouvre la journée : une échéance vaut pour
      // le jour entier, pas pour un moment.
      if (!a.heure && b.heure) return -1;
      if (a.heure && !b.heure) return 1;
      if (a.heure && b.heure && a.heure !== b.heure) return a.heure < b.heure ? -1 : 1;
      return a.titre < b.titre ? -1 : 1;
    });

export const compterParJour = (lignes: LigneAgenda[]): Record<string, number> => {
  const compte: Record<string, number> = {};
  for (const l of lignes) compte[l.jour] = (compte[l.jour] ?? 0) + 1;
  return compte;
};

/** Le prochain rendez-vous à venir, aujourd'hui compris. */
export const prochaine = (lignes: LigneAgenda[], aujourdhui = dateDuJour()): LigneAgenda | null => {
  const suivantes = lignes
    .filter((l) => l.jour >= aujourdhui)
    .sort((a, b) =>
      a.jour === b.jour ? ((a.heure ?? "") < (b.heure ?? "") ? -1 : 1) : a.jour < b.jour ? -1 : 1,
    );
  return suivantes[0] ?? null;
};
