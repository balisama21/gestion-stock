import type { Intervalle } from "../../features/dashboard-v2/hooks/useDashboardPeriod";
import { dansIntervalle } from "../../features/dashboard-v2/hooks/useDashboardPeriod";
import type { DocumentCommercial } from "./documents";
import type { CleOnglet } from "./OngletsType";
import type { StatutDocument } from "./statuts";

/**
 * CE QUI RESTE À L'ÉCRAN, ET DANS QUEL ORDRE.
 *
 * Fonctions pures, séparées de la vue : c'est ce qui permet de vérifier
 * qu'une recherche sur un montant trouve bien la facture, sans monter
 * la page entière.
 */

/** Le filtre posé par un clic sur un indicateur du haut de page. */
export type VueRapide = "" | "a_encaisser" | "en_retard" | "offres";

export interface FiltresFacturation {
  onglet: CleOnglet;
  recherche: string;
  statut: StatutDocument | "";
  /** Le nom du client ou du fournisseur, exactement. */
  tiers: string;
  vendeur: string;
  intervalle: Intervalle | null;
  vue: VueRapide;
}

export const FILTRES_VIDES: FiltresFacturation = {
  onglet: "tous",
  recherche: "",
  statut: "",
  tiers: "",
  vendeur: "",
  intervalle: null,
  vue: "",
};

/** Combien de filtres sont posés, hors onglet et hors période. */
export function compterFiltres(f: FiltresFacturation): number {
  return [f.recherche.trim(), f.statut, f.tiers, f.vendeur, f.vue].filter(Boolean).length;
}

/**
 * Sans accents et sans casse : « Rakotondrasoa » se trouve en tapant
 * « rakotondrasoa », et « Société » en tapant « societe ».
 */
const aplatir = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Les chiffres d'un texte, pour qu'« un 250 000 » trouve « 250000 ». */
const chiffres = (s: string): string => s.replace(/[^0-9]/g, "");

function correspond(d: DocumentCommercial, recherche: string): boolean {
  const q = aplatir(recherche.trim());
  if (!q) return true;

  const textes = [d.numero, d.numeroBrut, d.tiers, d.vendeur, d.reference ?? "", d.avoirDe ?? ""];
  if (textes.some((t) => aplatir(t).includes(q))) return true;

  // Un montant se cherche comme on le lit : « 250 000 », « 250000 »,
  // « 250.000 » désignent la même facture.
  const q9 = chiffres(q);
  if (q9.length >= 3) {
    const montants = [d.montant, d.reste, d.paye].map((n) => String(Math.round(n)));
    if (montants.some((m) => m.includes(q9))) return true;
  }
  return false;
}

export function filtrerDocuments(
  documents: DocumentCommercial[],
  f: FiltresFacturation,
): DocumentCommercial[] {
  return documents.filter((d) => {
    if (f.onglet !== "tous" && d.type !== f.onglet) return false;
    if (f.intervalle && !dansIntervalle(d.date, f.intervalle)) return false;
    if (f.statut && d.statut !== f.statut) return false;
    if (f.tiers && d.tiers !== f.tiers) return false;
    if (f.vendeur && d.vendeur !== f.vendeur) return false;

    if (f.vue === "a_encaisser" && !(d.entite === "vente" && d.reste > 0 && d.statut !== "annulee"))
      return false;
    if (f.vue === "en_retard" && d.statut !== "retard") return false;
    if (f.vue === "offres" && !(d.entite === "devis" && d.statut === "attente")) return false;

    return correspond(d, f.recherche);
  });
}

export type CleTri = "date" | "numero" | "tiers" | "montant" | "reste" | "echeance";

export const TRIS: { cle: CleTri; label: string }[] = [
  { cle: "date", label: "Date" },
  { cle: "numero", label: "Numéro" },
  { cle: "tiers", label: "Client ou fournisseur" },
  { cle: "echeance", label: "Échéance" },
  { cle: "montant", label: "Montant" },
  { cle: "reste", label: "Reste à payer" },
];

/**
 * Le tri est stable et déterministe : à valeur égale, la clé de la
 * pièce tranche. Sans quoi deux factures du même jour changeraient de
 * place à chaque rendu, et l'œil perdrait la ligne qu'il suivait.
 */
export function trierDocuments(
  documents: DocumentCommercial[],
  cle: CleTri,
  descendant: boolean,
): DocumentCommercial[] {
  const signe = descendant ? -1 : 1;
  const valeur = (d: DocumentCommercial): string | number => {
    switch (cle) {
      case "numero":
        return d.numero;
      case "tiers":
        return aplatir(d.tiers);
      case "echeance":
        return d.echeance ?? "";
      case "montant":
        return d.montant;
      case "reste":
        return d.reste;
      default:
        return d.date;
    }
  };

  return [...documents].sort((a, b) => {
    const va = valeur(a);
    const vb = valeur(b);
    if (va === vb) return a.cle.localeCompare(b.cle);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * signe;
    return String(va).localeCompare(String(vb)) * signe;
  });
}
