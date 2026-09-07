import type { Database } from "./database.types";

export type Livraison = Database["public"]["Tables"]["deliveries"]["Row"];

/**
 * Une ligne de ce que le livreur transporte.
 *
 * Volontairement sans prix : il doit savoir ce qu'il remet et combien
 * encaisser en tout, pas ce que la boutique a payé la marchandise.
 */
export interface ArticleLivre {
  designation: string;
  quantite: number;
}

export const STATUTS_LIVRAISON = [
  { valeur: "a_faire", libelle: "À faire" },
  { valeur: "en_cours", libelle: "En cours" },
  { valeur: "livree", libelle: "Livrée" },
  { valeur: "echouee", libelle: "Échouée" },
  { valeur: "annulee", libelle: "Annulée" },
] as const;

export const libelleStatutLivraison = (statut: string) =>
  STATUTS_LIVRAISON.find((s) => s.valeur === statut)?.libelle ?? statut;

/** La couleur ne sert qu'au statut, où elle informe. */
export const classeStatutLivraison = (statut: string): string => {
  if (statut === "livree") return "app-badge-success";
  if (statut === "echouee") return "app-badge-danger";
  if (statut === "en_cours") return "app-badge-info";
  if (statut === "annulee") return "app-badge-neutral";
  return "app-badge-warning";
};

/**
 * L'argent de cette course est encore chez le livreur.
 *
 * Il a livré et encaissé, mais n'est pas encore repassé — ou le
 * commerçant n'a pas encore coché. Tant que ce n'est pas fait, la
 * caisse ne compte pas cet argent, et c'est voulu : il n'y est pas.
 */
export const argentChezLeLivreur = (l: Livraison): boolean =>
  l.statut === "livree" && l.montant_encaisse > 0 && l.argent_remis_le === null;

/** Une livraison qu'il reste à faire, par opposition à une close. */
export const estEnCours = (l: Livraison): boolean =>
  l.statut === "a_faire" || l.statut === "en_cours";

/**
 * Le contenu tel qu'il est rangé en base : du JSON libre.
 *
 * On le relit prudemment — une base peut contenir autre chose que ce
 * qu'on y a mis, et un écran ne doit pas tomber parce qu'une ligne est
 * malformée.
 */
export const lireContenu = (brut: unknown): ArticleLivre[] => {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      designation: typeof a.designation === "string" ? a.designation : "",
      quantite: typeof a.quantite === "number" ? a.quantite : Number(a.quantite) || 0,
    }))
    .filter((a) => a.designation !== "");
};

/** « 3 articles » — ce que le livreur lit d'un coup d'œil. */
export const resumeContenu = (contenu: ArticleLivre[]): string => {
  const articles = contenu.reduce((n, a) => n + a.quantite, 0);
  if (articles === 0) return "contenu non précisé";
  return `${articles} article${articles > 1 ? "s" : ""}`;
};
