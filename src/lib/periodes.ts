import { dateDuJour } from "./dates";

/**
 * La période que le tableau de bord regarde.
 *
 * ── Ce que la période peut et ne peut pas toucher ──
 *
 * Un SOLDE n'a pas de période. « La trésorerie sur 7 jours » ne veut
 * rien dire : c'est ce qu'il y a en caisse maintenant, point. Idem pour
 * la valeur du stock, le nombre de commandes en cours et tout le bloc
 * « En suspens ». Ces chiffres-là restent en dehors du sélecteur, et
 * l'écran doit le montrer plutôt que de l'expliquer.
 *
 * Un FLUX, lui, n'existe que rapporté à une durée : les ventes, les
 * achats, les dépenses. Ce sont les seuls que la période filtre.
 *
 * ── Pourquoi la comparaison suit la période ──
 *
 * Avant, le tableau de bord affichait le total DEPUIS TOUJOURS avec, à
 * côté, un pourcentage qui comparait ce mois-ci au mois dernier. Le
 * pourcentage ne décrivait pas le nombre posé à côté de lui. En liant
 * les deux au même intervalle, « −11 % » veut enfin dire quelque chose
 * sur le chiffre qu'on est en train de lire.
 *
 * ── Le piège du mois en cours ──
 *
 * Le 13 du mois, « ce mois » ne couvre que treize jours. Le comparer au
 * mois dernier tout entier ferait chuter le pourcentage tous les mois,
 * mécaniquement, sans que rien n'aille mal. On compare donc au MÊME
 * NOMBRE DE JOURS du mois précédent — du 1er au 13 août contre le 1er au
 * 13 septembre — et l'étiquette le dit.
 */

export type ClePeriode = "jour" | "semaine" | "mois" | "tout";

export interface Intervalle {
  /** Bornes incluses, au format AAAA-MM-JJ. */
  debut: string;
  fin: string;
}

export interface Periode {
  cle: ClePeriode;
  libelle: string;
  /** Nul pour « Tout » : aucune borne, on prend l'historique entier. */
  intervalle: Intervalle | null;
  /** L'intervalle équivalent juste avant. Nul quand rien n'est comparable. */
  precedent: Intervalle | null;
  /** Ce qu'annonce le badge de tendance, à côté du pourcentage. */
  libelleComparaison: string;
}

export const PERIODES: { cle: ClePeriode; libelle: string }[] = [
  { cle: "jour", libelle: "Aujourd'hui" },
  { cle: "semaine", libelle: "7 jours" },
  { cle: "mois", libelle: "Ce mois" },
  { cle: "tout", libelle: "Tout" },
];

/** La clé par défaut : le mois en cours, qui est l'horizon d'un commerçant. */
export const PERIODE_PAR_DEFAUT: ClePeriode = "mois";

const enJours = (date: string, pas: number): string => {
  const [a, m, j] = date.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + pas));
  return d.toISOString().slice(0, 10);
};

const premierDuMois = (date: string): string => `${date.slice(0, 7)}-01`;

const dernierJourDuMois = (annee: number, mois1a12: number): number =>
  new Date(Date.UTC(annee, mois1a12, 0)).getUTCDate();

export function calculerPeriode(cle: ClePeriode, aujourdhui = dateDuJour()): Periode {
  const libelle = PERIODES.find((p) => p.cle === cle)?.libelle ?? cle;

  if (cle === "tout") {
    return {
      cle,
      libelle,
      intervalle: null,
      // Comparer « tout » à quoi ? Il n'y a rien avant le début.
      precedent: null,
      libelleComparaison: "depuis le début",
    };
  }

  if (cle === "jour") {
    const hier = enJours(aujourdhui, -1);
    return {
      cle,
      libelle,
      intervalle: { debut: aujourdhui, fin: aujourdhui },
      precedent: { debut: hier, fin: hier },
      libelleComparaison: "vs hier",
    };
  }

  if (cle === "semaine") {
    // Sept jours en comptant aujourd'hui : c'est ainsi qu'on dit « ces
    // sept derniers jours » en parlant, et l'intervalle précédent est
    // les sept jours d'avant, de la même longueur.
    const debut = enJours(aujourdhui, -6);
    return {
      cle,
      libelle,
      intervalle: { debut, fin: aujourdhui },
      precedent: { debut: enJours(debut, -7), fin: enJours(debut, -1) },
      libelleComparaison: "vs 7 jours avant",
    };
  }

  // « Ce mois » : du 1er à aujourd'hui, comparé au même nombre de jours
  // du mois précédent.
  const debut = premierDuMois(aujourdhui);
  const [a, m, j] = aujourdhui.split("-").map(Number);
  const moisPrecedent = m === 1 ? 12 : m - 1;
  const anneePrecedente = m === 1 ? a - 1 : a;
  const dernierPossible = dernierJourDuMois(anneePrecedente, moisPrecedent);
  // Le 31 mars se compare au 28 ou 29 février : on s'arrête au dernier
  // jour qui existe, plutôt que de fabriquer une date impossible.
  const finPrecedent = Math.min(j, dernierPossible);
  const mm = String(moisPrecedent).padStart(2, "0");

  return {
    cle,
    libelle,
    intervalle: { debut, fin: aujourdhui },
    precedent: {
      debut: `${anneePrecedente}-${mm}-01`,
      fin: `${anneePrecedente}-${mm}-${String(finPrecedent).padStart(2, "0")}`,
    },
    libelleComparaison: "vs même période le mois dernier",
  };
}

/** Vrai si cette date tombe dans l'intervalle. Un intervalle nul prend tout. */
export const dansIntervalle = (date: string, i: Intervalle | null): boolean => {
  if (!i) return true;
  const d = (date || "").slice(0, 10);
  return d >= i.debut && d <= i.fin;
};

/** Le sous-ensemble d'une liste datée qui tombe dans l'intervalle. */
export function filtrerParIntervalle<T>(
  lignes: T[],
  date: (l: T) => string,
  i: Intervalle | null,
): T[] {
  if (!i) return lignes;
  return lignes.filter((l) => dansIntervalle(date(l), i));
}
