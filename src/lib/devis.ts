import type { Database } from "./database.types";

export type Devis = Database["public"]["Tables"]["quotes"]["Row"];
export type LigneDevis = Database["public"]["Tables"]["quote_items"]["Row"];

/** Une ligne en cours de saisie, avant d'être envoyée à la base. */
export interface LigneSaisie {
  /** Vide pour une prestation qui n'est pas au catalogue. */
  productId: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

export const STATUTS_DEVIS = [
  { valeur: "brouillon", libelle: "Brouillon" },
  { valeur: "envoye", libelle: "Envoyé" },
  { valeur: "accepte", libelle: "Accepté" },
  { valeur: "refuse", libelle: "Refusé" },
] as const;

export const libelleStatut = (statut: string) =>
  STATUTS_DEVIS.find((s) => s.valeur === statut)?.libelle ?? statut;

/**
 * Un devis dont la date de validité est passée sans avoir été ni accepté
 * ni refusé.
 *
 * L'expiration n'est pas un statut enregistré : elle se déduit de la
 * date. Un statut qu'il faudrait penser à mettre à jour serait faux dès
 * le lendemain de l'oubli.
 */
// Le type est réduit à ce que la fonction lit vraiment : le tableau de
// bord ne charge des devis que leur statut, leur total et leur validité,
// et n'a pas à en fabriquer un complet pour poser cette question.
export const estExpire = (
  devis: { statut: string; valide_jusqu_au: string | null },
  aujourdhui = new Date(),
): boolean => {
  if (!devis.valide_jusqu_au) return false;
  if (devis.statut === "accepte" || devis.statut === "refuse") return false;
  const limite = new Date(devis.valide_jusqu_au + "T23:59:59");
  return limite.getTime() < aujourdhui.getTime();
};

/** La couleur du badge, où elle porte du sens et nulle part ailleurs. */
export const classeStatut = (devis: Devis): string => {
  if (devis.statut === "accepte") return "app-badge-success";
  if (devis.statut === "refuse") return "app-badge-danger";
  if (estExpire(devis)) return "app-badge-warning";
  return devis.statut === "envoye" ? "app-badge-info" : "app-badge-neutral";
};

export const texteStatut = (devis: Devis): string =>
  estExpire(devis) ? "Expiré" : libelleStatut(devis.statut);

/** Le total d'un brouillon en cours de saisie. */
export const totalDesLignes = (lignes: LigneSaisie[]): number =>
  lignes.reduce((n, l) => n + l.quantite * l.prixUnitaire, 0);
