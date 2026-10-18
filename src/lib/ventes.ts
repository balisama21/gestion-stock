/**
 * LES RÈGLES D'UNE VENTE, À UN SEUL ENDROIT.
 *
 * L'écran Ventes recalculait le statut d'un ticket à trois endroits (le
 * reçu, la ligne regroupée, la modale de modification) et la commission
 * par défaut à trois autres (deux dans Ventes, une dans Facturation).
 * Trois copies d'une même règle finissent toujours par en donner deux.
 */

export type StatutReglement = "Payé" | "Partiel" | "Impayé";

/** Le statut d'un montant dû : soldé, entamé, ou pas encore touché. */
export function statutDeReglement(du: number, paye: number): StatutReglement {
  if (du <= 0) return "Payé";
  return paye > 0 ? "Partiel" : "Impayé";
}

/**
 * Les totaux d'un ticket, toutes lignes confondues.
 *
 * Le reste dû vient de `soldeDu`, que la base entretient elle-même : on
 * ne le recalcule pas depuis le total et le payé.
 */
export function totauxDesLignes(
  lignes: { totalVente: number; montantPaye: number; soldeDu: number; margeTotale: number }[],
) {
  const total = lignes.reduce((n, v) => n + v.totalVente, 0);
  const paye = lignes.reduce((n, v) => n + v.montantPaye, 0);
  const du = lignes.reduce((n, v) => n + Math.max(0, v.soldeDu), 0);
  const marge = lignes.reduce((n, v) => n + v.margeTotale, 0);
  return { total, paye, du, marge, statut: statutDeReglement(du, paye) };
}

/** La commission que propose le taux de la boutique, à l'unité près. */
export const commissionParDefaut = (total: number, taux: number): number =>
  Math.round((total * taux) / 100);

/**
 * Une commission est une PART du total : jamais négative, jamais plus
 * que le total lui-même.
 */
export function erreurDeCommission(montant: number, total: number): string | null {
  if (!Number.isFinite(montant) || montant < 0) return "La commission ne peut pas être négative.";
  if (montant > total) return "La commission ne peut pas dépasser le total de la vente.";
  return null;
}

/**
 * Ce que la modification d'une vente peut réellement changer.
 *
 * `update_sale_quantity` n'écrit que la quantité, le total qui en
 * découle et le client. La date, le vendeur, le prix unitaire et le
 * montant payé n'y entrent pas : la modale les proposait à la saisie,
 * puis les perdait sans un mot. Le montant payé passe par les
 * règlements (`add_payment`), jamais par une modification.
 *
 * Le contrôle reprend celui de la base, pour répondre avant l'appel :
 * le total ne peut pas descendre sous ce qui a déjà été encaissé.
 */
export function preparerModificationVente(
  vente: { quantite: number; prixVenteUnit: number; montantPaye: number },
  saisie: { quantite: number },
): { quantite: number; totalVente: number } | { erreur: string } {
  const quantite = Number(saisie.quantite);
  if (!Number.isInteger(quantite) || quantite <= 0) {
    return { erreur: "La quantité doit être un nombre entier supérieur à zéro." };
  }
  const totalVente = quantite * vente.prixVenteUnit;
  if (vente.montantPaye > totalVente) {
    return {
      erreur:
        "Le nouveau total serait inférieur à ce qui a déjà été encaissé. Remboursez d'abord la différence.",
    };
  }
  return { quantite, totalVente };
}
