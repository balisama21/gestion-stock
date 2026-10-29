import type { NatureVendeur, Seller } from "../types";
import { ROLE_LABELS, type RoleKey } from "./permissions";

/**
 * LE RESPONSABLE N'EST PAS UN VENDEUR DE L'ÉQUIPE
 *
 * Tant qu'aucun collaborateur n'a rejoint la boutique, le responsable
 * vend seul : ce qu'il encaisse va droit dans sa caisse, et un « solde
 * en poche » à son nom ne serait que le cumul de ses ventes, qui ne
 * redescend jamais. Les écrans qui parlent de vendeurs — classements,
 * soldes, filtres — ne montrent donc que l'équipe, et se taisent ou
 * invitent à en former une quand elle n'existe pas.
 *
 * Les calculs ne changent pas : `soldeNetEnPoche` est le même pour
 * tous. Seule la présentation choisit qui elle montre.
 */

export const natureDe = (v: Pick<Seller, "nature">): NatureVendeur => v.nature ?? "membre";

export const estResponsable = (v: Pick<Seller, "nature">): boolean => natureDe(v) === "responsable";

/**
 * Ceux qui encaissent à la place du responsable et lui doivent des
 * comptes : les membres invités, et les noms sans compte qui portent
 * des ventes ou des dépenses.
 */
export const collaborateurs = <T extends Pick<Seller, "nature">>(vendeurs: T[]): T[] =>
  vendeurs.filter((v) => !estResponsable(v));

/** Une équipe existe dès qu'un collaborateur figure parmi les vendeurs. */
export const aUneEquipe = (vendeurs: Pick<Seller, "nature">[]): boolean =>
  collaborateurs(vendeurs).length > 0;

/** Le mot posé à côté du nom : « Responsable », « Vendeur », « Sans compte »… */
export const libelleNature = (v: Pick<Seller, "nature" | "role">): string => {
  const nature = natureDe(v);
  if (nature === "responsable") return "Responsable";
  if (nature === "sans_compte") return "Sans compte";
  return (v.role && ROLE_LABELS[v.role as RoleKey]) || "Membre";
};
