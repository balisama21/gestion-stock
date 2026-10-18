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

// ─────────────────────────────────────────────────────────────────────
// LE CHIFFRE D'AFFAIRES NET DES AVOIRS
//
// Un avoir annule tout ou partie d'une facture (décision du 18 octobre,
// rapport d'audit § 10). Il retranche donc son montant du chiffre
// d'affaires — mais à SA date, pas à celle de la vente : le mois passé,
// déjà lu et peut-être déclaré, ne se réécrit pas. C'est le
// contre-mouvement de la comptabilité.
//
// Le reste dû, lui, n'est pas calculé ici : la base le tient dans
// `solde_du` (total − payé − avoiré).
// ─────────────────────────────────────────────────────────────────────

/** Un avoir tel que le chiffre d'affaires le lit : un montant, à sa date. */
export interface AvoirDeVente {
  date: string;
  montant: number;
  ticket_id: string | null;
}

/**
 * Les avoirs qui portent sur ces ventes, rattachés par leur ticket.
 *
 * Un écran qui ne montre qu'une partie des ventes (un vendeur limité aux
 * siennes, une fiche client) ne doit retrancher que les avoirs de CES
 * ventes-là.
 */
export function avoirsDesVentes<A extends { ticket_id: string | null }>(
  avoirs: A[],
  ventes: { id: string; ticketId?: string | null }[],
): A[] {
  const tickets = new Set(ventes.map((v) => v.ticketId ?? v.id));
  return avoirs.filter((a) => a.ticket_id !== null && tickets.has(a.ticket_id));
}

/**
 * Σ des ventes − Σ des avoirs. À l'appelant de passer les deux listes
 * prises sur la MÊME période, chacune selon sa propre date.
 */
export function chiffreAffairesNet(
  ventes: { totalVente: number }[],
  avoirs: { montant: number }[],
): number {
  return (
    ventes.reduce((n, v) => n + v.totalVente, 0) - avoirs.reduce((n, a) => n + Number(a.montant), 0)
  );
}

/** Le chiffre d'affaires net, jour par jour. */
export function chiffreAffairesParJour(
  ventes: { date: string; totalVente: number }[],
  avoirs: { date: string; montant: number }[],
): Map<string, number> {
  const parJour = new Map<string, number>();
  for (const v of ventes) parJour.set(v.date, (parJour.get(v.date) ?? 0) + v.totalVente);
  for (const a of avoirs) parJour.set(a.date, (parJour.get(a.date) ?? 0) - Number(a.montant));
  return parJour;
}
