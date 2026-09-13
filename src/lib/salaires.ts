import type { Database } from "./database.types";
import { dateDuJour } from "./dates";

export type Salaire = Database["public"]["Tables"]["salaires"]["Row"];
export type PaiementSalaire = Database["public"]["Tables"]["paiements_salaire"]["Row"];
export type TypePaiement = "avance" | "solde";
export type StatutPaiement = "en_attente" | "approuvee" | "refusee" | "versee" | "annulee";

/**
 * Les salaires et les avances : tout le calcul, au même endroit.
 *
 * Ce fichier ne contient aucune requête et aucun affichage. On peut donc
 * vérifier un reste à payer ou un salaire en vigueur sans ouvrir un
 * navigateur ni toucher à la base.
 *
 * ── Deux comptes à ne jamais confondre ──
 *
 * Le SOLDE EN POCHE d'un vendeur répond à « combien de mon argent
 * détient-il en ce moment ». Le SALAIRE répond à « combien est-ce que je
 * lui dois ». Les deux vont dans des directions opposées et coexistent :
 * quelqu'un peut détenir 200 000 Ar de la caisse et avoir 150 000 Ar de
 * salaire à percevoir. Les additionner détruirait les deux chiffres.
 *
 * Un seul point les relie, et il est explicite : une avance prise sur la
 * caisse que l'employé détient déjà (`depuis_la_caisse_du_vendeur`) fait
 * baisser les deux. Voir `avancesPrisesSurLaCaisse`.
 *
 * ── La trésorerie ──
 *
 * Le salaire est un ENGAGEMENT : il ne devient de l'argent qu'au moment
 * où il est payé. Seules les lignes `versee` sortent de la caisse.
 * Compter la charge ET le versement retirerait deux fois le même argent.
 */

export const TYPES: { valeur: TypePaiement; libelle: string }[] = [
  { valeur: "avance", libelle: "Avance" },
  { valeur: "solde", libelle: "Solde" },
];

export const STATUTS: { valeur: StatutPaiement; libelle: string }[] = [
  { valeur: "en_attente", libelle: "En attente" },
  { valeur: "approuvee", libelle: "Approuvée" },
  { valeur: "refusee", libelle: "Refusée" },
  { valeur: "versee", libelle: "Versée" },
  { valeur: "annulee", libelle: "Annulée" },
];

export const libelleStatut = (s: string) => STATUTS.find((x) => x.valeur === s)?.libelle ?? s;
export const libelleType = (t: string) => TYPES.find((x) => x.valeur === t)?.libelle ?? t;

/**
 * La couleur ne parle que quand elle dit quelque chose.
 *
 * « Versée » est le cas courant d'une ligne qu'on relit : elle n'a pas à
 * se signaler. Ce qui mérite l'œil, c'est une demande qui attend une
 * décision, et un refus.
 */
export const CLASSE_STATUT: Record<StatutPaiement, string> = {
  en_attente: "app-badge-warning",
  approuvee: "app-badge-info",
  refusee: "app-badge-danger",
  versee: "app-badge-neutral",
  annulee: "app-badge-neutral",
};

// ─────────────────────────────────────────────────────────────────────
// LES MOIS
//
// Il n'y a AUCUNE clôture mensuelle dans ce module, et c'est voulu : une
// clôture est une procédure qu'on oublie de lancer. Un mois commence
// parce qu'on demande à le voir, et il est vide parce qu'aucune ligne
// n'y est encore imputée. Tout tient dans la colonne `periode`, toujours
// ramenée au 1er par la base.
// ─────────────────────────────────────────────────────────────────────

/** Le 1er du mois qui contient cette date, au format AAAA-MM-JJ. */
export const moisDe = (date: string): string => `${date.slice(0, 7)}-01`;

/** Le mois en cours. */
export const moisCourant = (): string => moisDe(dateDuJour());

/** Le dernier jour du mois, pour savoir quel salaire était en vigueur. */
export const finDuMois = (periode: string): string => {
  const [a, m] = periode.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${periode.slice(0, 7)}-${String(dernier).padStart(2, "0")}`;
};

/** Le mois d'avant, ou celui d'après quand `pas` vaut 1. */
export const decalerMois = (periode: string, pas: number): string => {
  const [a, m] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + pas, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/** « Septembre 2026 ». */
export const libelleMois = (periode: string): string => {
  const [a, m] = periode.split("-").map(Number);
  return `${MOIS[m - 1] ?? periode} ${a}`;
};

// ─────────────────────────────────────────────────────────────────────
// LE SALAIRE EN VIGUEUR
// ─────────────────────────────────────────────────────────────────────

/** Deux noms désignent la même personne s'ils s'écrivent pareil, casse mise à part. */
export const memePersonne = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Le salaire retenu pour un mois.
 *
 * La règle tient en une phrase : c'est celui en vigueur à la fin du
 * mois. Une règle qu'on peut énoncer vaut mieux qu'un prorata que
 * personne ne saura refaire de tête ; si un changement doit porter sur
 * le mois suivant, on date sa prise d'effet au 1er.
 *
 * Un employé parti en cours de mois fait exception : plus rien n'est en
 * vigueur le dernier jour, mais on lui doit quand même son mois. On
 * retient alors la dernière fiche qui a couvert une partie du mois.
 */
export const salaireEnVigueur = (
  salaires: Salaire[],
  employe: string,
  periode: string,
): Salaire | null => {
  const fin = finDuMois(periode);
  const candidats = salaires
    .filter(
      (s) =>
        memePersonne(s.employe, employe) &&
        s.debut_le <= fin &&
        (s.fin_le === null || s.fin_le >= periode),
    )
    .sort((a, b) => a.debut_le.localeCompare(b.debut_le));
  return candidats[candidats.length - 1] ?? null;
};

/** La fiche en cours, celle qui n'a pas de date de fin. */
export const salaireEnCours = (salaires: Salaire[], employe: string): Salaire | null =>
  salaires.find((s) => memePersonne(s.employe, employe) && s.fin_le === null) ?? null;

// ─────────────────────────────────────────────────────────────────────
// LA SITUATION D'UN EMPLOYÉ SUR UN MOIS
// ─────────────────────────────────────────────────────────────────────

export interface SituationSalaire {
  /** Le nom, dans l'orthographe de sa fiche la plus récente. */
  employe: string;
  poste: string | null;
  /** Le compte, quand la personne en a un. */
  userId: string | null;
  /** Ce qui lui est dû pour le mois. Zéro si aucune fiche ne le couvre. */
  salaire: number;
  /** Ce qu'il a déjà touché en avances versées, imputées à ce mois. */
  avances: number;
  /** Ce qui lui a été versé en solde de fin de mois. */
  soldes: number;
  /** Avances + soldes : l'argent réellement sorti pour lui ce mois-ci. */
  verse: number;
  /**
   * Ce qui reste à lui payer. Négatif quand on lui a avancé plus que son
   * salaire : la dette se reporte en imputant le surplus au mois suivant.
   */
  resteAPayer: number;
  /** Approuvé mais pas encore remis : promis, pas payé. */
  approuveNonVerse: number;
  /** Les demandes qui attendent une décision. */
  enAttente: PaiementSalaire[];
  /** Toutes ses lignes du mois, du plus récent au plus ancien. */
  lignes: PaiementSalaire[];
  /** Vrai s'il n'a plus de fiche ouverte : il a quitté l'équipe. */
  parti: boolean;
}

const somme = (lignes: PaiementSalaire[]) => lignes.reduce((acc, l) => acc + Number(l.montant), 0);

/**
 * Tout le monde à suivre ce mois-ci, chacun avec ses chiffres.
 *
 * La liste vient des DEUX tables : quelqu'un peut avoir une fiche sans
 * versement (il vient d'être embauché) comme un versement sans fiche
 * en cours (il est parti mais son dernier mois se lit encore).
 */
export const situations = (
  salaires: Salaire[],
  paiements: PaiementSalaire[],
  periode: string,
): SituationSalaire[] => {
  const noms = new Map<string, string>();
  // La fiche la plus récente donne l'orthographe retenue.
  for (const s of [...salaires].sort((a, b) => a.debut_le.localeCompare(b.debut_le))) {
    noms.set(s.employe.trim().toLowerCase(), s.employe.trim());
  }
  for (const p of paiements) {
    const cle = p.employe.trim().toLowerCase();
    if (!noms.has(cle)) noms.set(cle, p.employe.trim());
  }

  return Array.from(noms.values())
    .map((employe) => {
      const fiche = salaireEnVigueur(salaires, employe, periode);
      const lignes = paiements
        .filter((p) => memePersonne(p.employe, employe) && p.periode === periode)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      const verses = lignes.filter((l) => l.statut === "versee");
      const avances = somme(verses.filter((l) => l.type === "avance"));
      const soldes = somme(verses.filter((l) => l.type === "solde"));
      const salaire = fiche ? Number(fiche.montant) : 0;

      return {
        employe,
        poste: fiche?.poste ?? null,
        userId: fiche?.user_id ?? null,
        salaire,
        avances,
        soldes,
        verse: avances + soldes,
        resteAPayer: salaire - avances - soldes,
        approuveNonVerse: somme(lignes.filter((l) => l.statut === "approuvee")),
        enAttente: lignes.filter((l) => l.statut === "en_attente"),
        lignes,
        parti: salaireEnCours(salaires, employe) === null,
      };
    })
    .sort((a, b) => a.employe.localeCompare(b.employe, "fr"));
};

/** Les trois chiffres de l'en-tête. */
export const totauxDuMois = (liste: SituationSalaire[]) => ({
  masseSalariale: liste.reduce((acc, s) => acc + s.salaire, 0),
  verse: liste.reduce((acc, s) => acc + s.verse, 0),
  resteAPayer: liste.reduce((acc, s) => acc + s.resteAPayer, 0),
  demandesEnAttente: liste.reduce((acc, s) => acc + s.enAttente.length, 0),
});

/** Toutes les demandes qui attendent une décision, tous mois confondus. */
export const demandesEnAttente = (paiements: PaiementSalaire[]): PaiementSalaire[] =>
  paiements
    .filter((p) => p.statut === "en_attente")
    .sort((a, b) => a.demande_le.localeCompare(b.demande_le));

// ─────────────────────────────────────────────────────────────────────
// LE SEUL PONT VERS LE SOLDE EN POCHE
// ─────────────────────────────────────────────────────────────────────

/**
 * Ce qu'un vendeur a gardé de la caisse qu'il détenait, au titre d'une
 * avance.
 *
 * Deux cas, et la différence est réelle. L'employé garde 50 000 Ar de ce
 * qu'il avait encaissé : la trésorerie baisse de 50 000 ET il ne détient
 * plus que le reste. Ou bien on le paie depuis le coffre : la trésorerie
 * baisse, mais ce qu'il détient pour la boutique n'a pas bougé.
 *
 * Seul le premier cas passe ici — d'où la case à cocher au moment de
 * verser. Sans elle, il faudrait choisir un cas par défaut et l'autre
 * serait faux.
 */
export const avancesPrisesSurLaCaisse = (paiements: PaiementSalaire[], employe: string): number =>
  somme(
    paiements.filter(
      (p) =>
        memePersonne(p.employe, employe) && p.statut === "versee" && p.depuis_la_caisse_du_vendeur,
    ),
  );

// ─────────────────────────────────────────────────────────────────────
// LES GARDES DE SAISIE
// ─────────────────────────────────────────────────────────────────────

/**
 * Un nom déjà connu, écrit presque pareil.
 *
 * Créer « Naivo » à côté d'un « Naivo R. » existant donne deux employés
 * là où il n'y en a qu'un, et personne ne s'en aperçoit avant la paie.
 * On ne bloque pas — deux frères peuvent travailler ensemble — mais on
 * le signale.
 */
export const nomVoisin = (saisi: string, connus: string[]): string | null => {
  const n = saisi.trim().toLowerCase();
  if (n.length < 2) return null;
  return (
    connus.find((c) => {
      const k = c.trim().toLowerCase();
      return k !== n && (k.startsWith(n) || n.startsWith(k));
    }) ?? null
  );
};

/**
 * Ce qu'on s'apprête à verser dépasse-t-il ce qui reste dû ?
 *
 * On avertit, on ne bloque pas : un commerçant avance parfois plus que
 * le salaire — une urgence médicale, ça arrive — et l'en empêcher le
 * pousserait à contourner le logiciel, donc à perdre la trace. Le
 * surplus s'impute simplement au mois suivant.
 */
export const depassement = (montant: number, resteAPayer: number): number =>
  Math.max(0, montant - Math.max(0, resteAPayer));
