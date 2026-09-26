import type { LocaleSetting } from "../../../types";
import { conversionActive, deviseAffichee, versAffichage } from "../../../lib/affichageDevise";

/**
 * MONTANTS, DATES ET QUANTITÉS, TELS QU'ILS S'IMPRIMENT
 *
 * Une règle domine tout ce fichier : **le document ne doit jamais
 * afficher un chiffre différent de l'écran d'où il vient**. Une
 * facture qui dit « 6 501 » là où la page Ventes dit « 6 500 » ruine
 * la confiance dans les deux. Les fonctions ci-dessous reproduisent
 * donc exactement le comportement de `formatCurrency` et de
 * `formatDateLocale` (`src/utils/formulas.ts`), à une seule chose
 * près : la devise vient de la boutique au lieu d'être « Ar » en dur.
 */

/**
 * Sépare les milliers.
 *
 * `Intl` en français utilise U+202F, l'espace fine insécable. Elle
 * s'affiche correctement, mais c'est un caractère exotique qui ne
 * survit pas à tous les encodages — un export sur un octet la tronque
 * et « 6 500 » devient « 6/500 ». On lui substitue l'espace
 * insécable ordinaire U+00A0, qui se voit pareil et empêche toujours
 * « 6 » et « 500 » de se retrouver sur deux lignes.
 *
 * C'est exactement la substitution que fait `formatCurrency`, pour la
 * même raison, découverte sur un vrai fichier.
 */
export function nombre(valeur: number): string {
  if (!Number.isFinite(valeur)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(valeur)
    .replace(/\u202f/g, "\u00a0");
}

/**
 * Un montant avec sa devise.
 *
 * La devise vient de `stores.currency_symbol`, qui vaut « Ar » chez
 * toutes les boutiques aujourd'hui mais n'a aucune raison de le rester.
 */
export function montant(valeur: number, devise: string | null | undefined = "Ar"): string {
  // Une devise d'affichage choisie remplace celle de la boutique, montant converti.
  if (conversionActive()) return `${argent(valeur)}\u00a0${deviseAffichee().symbole}`;
  const symbole = (devise ?? "").trim() || "Ar";
  return `${nombre(valeur)}\u00a0${symbole}`;
}

/** Un montant sans symbole, dans la devise d'affichage (ticket, tableau de bord). */
export function argent(valeur: number): string {
  if (!Number.isFinite(valeur)) return "\u2014";
  const dec = conversionActive() ? deviseAffichee().decimales : 0;
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .format(versAffichage(valeur))
    .replace(/\u202f/g, "\u00a0");
}

export const argentOuTiret = (valeur: number | null | undefined): string =>
  valeur === null || valeur === undefined ? "\u2014" : argent(valeur);

/**
 * Un montant, ou un tiret quand la valeur est inconnue.
 *
 * Jamais « 0 Ar » à la place d'un prix qu'on ignore : sur un bon de
 * commande, zéro se lit comme « gratuit », et c'est une erreur qu'on
 * ne rattrape plus une fois le document parti.
 */
export function montantOuTiret(valeur: number | null | undefined, devise?: string | null): string {
  return valeur === null || valeur === undefined ? "—" : montant(valeur, devise);
}

/**
 * Un nombre, ou un tiret quand la valeur est inconnue.
 *
 * Le pendant de `montantOuTiret` là où la devise est déjà dite une
 * fois pour toute la colonne — le ticket de caisse, qui l'annonce en
 * tête plutôt que sur chaque ligne.
 */
export function nombreOuTiret(valeur: number | null | undefined): string {
  return valeur === null || valeur === undefined ? "—" : nombre(valeur);
}

/* ─────────────────────────────────────────────────────────────
 * Dates
 * ───────────────────────────────────────────────────────────── */

const MOIS = [
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

/**
 * Découpe une date ISO sans passer par `Date`.
 *
 * `new Date("2026-09-13")` interprète la chaîne en UTC puis l'affiche
 * dans le fuseau local : à l'ouest de Greenwich, la facture porte la
 * veille. Les dates de l'application sont des jours commerciaux, pas
 * des instants — on les lit donc comme du texte.
 */
function decouper(iso: string): [number, number, number] | null {
  const parties = iso.slice(0, 10).split("-");
  if (parties.length !== 3) return null;
  const [a, m, j] = parties.map(Number);
  if (!a || !m || !j) return null;
  return [a, m, j];
}

/** 13/09/2026 en français, 09/13/2026 en anglais. */
export function dateCourte(iso: string | null | undefined, locale: LocaleSetting = "FR"): string {
  if (!iso) return "";
  const d = decouper(iso);
  if (!d) return iso;
  const [a, m, j] = d;
  const jj = String(j).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return locale === "FR" ? `${jj}/${mm}/${a}` : `${mm}/${jj}/${a}`;
}

/** 13 septembre 2026 — pour la ligne de date d'un document soigné. */
export function dateLongue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = decouper(iso);
  if (!d) return iso;
  const [a, m, j] = d;
  return `${j === 1 ? "1er" : j} ${MOIS[m - 1] ?? ""} ${a}`.replace(/\s+/g, " ").trim();
}

/**
 * L'heure d'un horodatage complet, pour le ticket de caisse.
 *
 * Ici `Date` est légitime : `created_at` EST un instant, et l'heure
 * qu'on veut imprimer est celle du comptoir, donc l'heure locale.
 */
export function heure(horodatage: string | null | undefined): string {
  if (!horodatage) return "";
  const d = new Date(horodatage);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────
 * Échéance
 * ───────────────────────────────────────────────────────────── */

export type Echeance = "a_reception" | "sous_15_jours" | "sous_30_jours" | "comptant";

/** Ce que la mention dit, en toutes lettres, sur le document. */
export const LIBELLE_ECHEANCE: Record<Echeance, string> = {
  a_reception: "À réception",
  sous_15_jours: "Sous 15 jours",
  sous_30_jours: "Sous 30 jours",
  comptant: "Payée comptant",
};

const JOURS_AJOUTES: Record<Echeance, number | null> = {
  a_reception: 0,
  sous_15_jours: 15,
  sous_30_jours: 30,
  // Comptant : l'argent est déjà rentré, il n'y a pas de date à attendre.
  comptant: null,
};

/**
 * La date d'échéance, calculée depuis la date de la vente.
 *
 * AUCUNE COLONNE NE LA PORTE en base, et je n'en ai pas créé : une
 * échéance n'est pas une donnée de la vente, c'est une politique de
 * la boutique. Elle se recalcule donc à l'affichage, ce qui a un effet
 * de bord assumé : changer le réglage change l'échéance des factures
 * qu'on réimprime. C'est le comportement attendu tant que personne ne
 * négocie de délai vente par vente — le jour où cela arrivera, il
 * faudra une colonne, et ce sera une autre discussion.
 *
 * Renvoie `null` quand il n'y a pas de date à afficher (« comptant »),
 * auquel cas le document montre le libellé seul.
 */
export function dateEcheance(
  dateVente: string | null | undefined,
  echeance: Echeance,
): string | null {
  const jours = JOURS_AJOUTES[echeance];
  if (jours === null || !dateVente) return null;

  const d = decouper(dateVente);
  if (!d) return null;

  const [a, m, j] = d;
  // `Date.UTC` puis lecture en UTC : aucun fuseau ne s'invite, et le
  // passage d'un mois ou d'une année se fait tout seul.
  const t = new Date(Date.UTC(a, m - 1, j + jours));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────
 * Divers
 * ───────────────────────────────────────────────────────────── */

/**
 * Les initiales d'une boutique sans logo.
 *
 * Deux lettres au plus : « Ma Boutique » donne « MB », « Épicerie »
 * donne « É ». Au-delà, la pastille devient un pavé de texte.
 */
export function initiales(nom: string | null | undefined): string {
  const mots = (nom ?? "")
    .trim()
    .split(/\s+/)
    .filter((m) => /[\p{L}\p{N}]/u.test(m));
  if (mots.length === 0) return "";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

/**
 * Une quantité suivie de son unité.
 *
 * Reprend `quantiteEnMots` de l'application plutôt que d'en refaire
 * une : « 3 pièces » mais « 3 kg », et c'est cette fonction qui sait
 * quelles unités s'accordent.
 */
export { quantiteEnMots as quantite } from "../../../utils/formulas";
