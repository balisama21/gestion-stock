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
  vente: { quantite: number; prixVenteUnit: number; montantPaye: number; montantAvoire?: number },
  saisie: { quantite: number; prixVenteUnit?: number },
): { quantite: number; prixVenteUnit: number; totalVente: number } | { erreur: string } {
  const quantite = Number(saisie.quantite);
  if (!Number.isInteger(quantite) || quantite <= 0) {
    return { erreur: "La quantité doit être un nombre entier supérieur à zéro." };
  }
  // Le prix se corrige depuis le 19 octobre (`corriger_prix_vente`) ; sans
  // saisie, il reste celui d'origine.
  const prixVenteUnit = Number(saisie.prixVenteUnit ?? vente.prixVenteUnit);
  if (!Number.isFinite(prixVenteUnit) || prixVenteUnit < 0) {
    return { erreur: "Le prix unitaire doit être un nombre positif ou nul." };
  }
  // Au centime : une vente au carton (7 000 les 12, soit 583,33… l'unité)
  // redonnerait sinon 6 999,999… ou 7 000,000…1, et la base la croirait
  // à jamais « partielle ». Un prix entier ne bouge pas.
  const totalVente = Math.round(quantite * prixVenteUnit * 100) / 100;
  // La base refuse un total sous ce qui est payé + annulé par avoir.
  if (vente.montantPaye + (vente.montantAvoire ?? 0) > totalVente) {
    return {
      erreur:
        "Le nouveau total serait inférieur à ce qui a déjà été encaissé. Remboursez d'abord la différence.",
    };
  }
  return { quantite, prixVenteUnit, totalVente };
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
  /** Présent quand on a les lignes de l'avoir à lui rattacher. */
  id?: string;
  date: string;
  montant: number;
  ticket_id: string | null;
  /** La facture annulée (« FAC-V002 ») : sert à savoir si l'avoir a remis en stock. */
  facture_numero?: string | null;
}

/**
 * LA MARGE NETTE DES AVOIRS
 *
 * Un avoir retire son montant du chiffre d'affaires (voir plus haut). Sur
 * la marge, deux cas :
 *
 * — les articles NE reviennent PAS en stock (avoir partiel, geste
 *   commercial, marchandise perdue) : la boutique a cédé la marchandise et
 *   renonce à l'argent ; la marge baisse de tout le montant de l'avoir ;
 * — les articles REVIENNENT en stock (avoir total, case « Remettre les
 *   articles en stock ») : leur coût d'achat retourne au stock ; la marge
 *   ne baisse que de l'avoir MOINS ce coût — c'est-à-dire de la marge que
 *   la vente avait faite.
 *
 * La remise en stock se reconnaît au mouvement « ajustement » que la page
 * Facturation écrit avec la note « Avoir sur <numéro de facture> »
 * (`facturesRemisesEnStock`). Comme l'avoir, l'effet se compte à la date
 * de l'avoir.
 */
export function effetDesAvoirsSurLaMarge(
  avoirs: readonly AvoirDeVente[],
  ventes: readonly {
    id: string;
    ticketId?: string | null;
    productId?: string;
    totalAchatRef: number;
  }[],
  facturesRemisesEnStock: ReadonlySet<string> = new Set(),
): number {
  let effet = 0;
  for (const a of avoirs) {
    let coutRemis = 0;
    if (a.facture_numero && facturesRemisesEnStock.has(a.facture_numero) && a.ticket_id) {
      for (const v of ventes)
        if ((v.ticketId ?? v.id) === a.ticket_id && v.productId) coutRemis += v.totalAchatRef;
    }
    effet += Number(a.montant) - coutRemis;
  }
  return effet;
}

/** Les numéros de facture dont un avoir a remis les articles en stock. */
export function facturesRemisesEnStockDepuis(
  notes: readonly (string | null)[],
): ReadonlySet<string> {
  const numeros = new Set<string>();
  for (const n of notes) {
    const m = n?.match(/^Avoir sur (.+)$/);
    if (m) numeros.add(m[1].trim());
  }
  return numeros;
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

/**
 * Ce que les avoirs retirent à chaque PRODUIT, d'après leurs lignes
 * (`avoir_items`) : un avoir partiel est réparti ligne par ligne par la
 * base, dans l'ordre du ticket. Sert au classement des produits vendus.
 */
export function avoirsParProduit(
  avoirs: readonly AvoirDeVente[],
  lignes: readonly { avoir_id: string; product_id: string | null; total: number | null }[],
): Map<string, number> {
  const retenus = new Set(avoirs.map((a) => a.id).filter(Boolean) as string[]);
  const parProduit = new Map<string, number>();
  for (const l of lignes) {
    if (!l.product_id || !retenus.has(l.avoir_id)) continue;
    parProduit.set(l.product_id, (parProduit.get(l.product_id) ?? 0) + Number(l.total ?? 0));
  }
  return parProduit;
}

/**
 * Le même effet, produit par produit : ce que chaque avoir retire au
 * chiffre d'affaires (`ca`) et à la marge (`marge`) de chaque produit,
 * d'après ses lignes. Sur une facture dont l'avoir a remis les articles en
 * stock, le coût d'achat du produit sur ce ticket revient : la marge ne
 * perd que la marge de la vente. La somme des marges retirées égale
 * `effetDesAvoirsSurLaMarge` quand chaque avoir a ses lignes.
 */
export function effetDesAvoirsParProduit(
  avoirs: readonly AvoirDeVente[],
  lignes: readonly { avoir_id: string; product_id: string | null; total: number | null }[],
  ventes: readonly {
    id: string;
    ticketId?: string | null;
    productId?: string;
    totalAchatRef: number;
  }[],
  facturesRemisesEnStock: ReadonlySet<string> = new Set(),
): Map<string, { ca: number; marge: number }> {
  const parId = new Map(avoirs.filter((a) => a.id).map((a) => [a.id as string, a]));
  const effets = new Map<string, { ca: number; marge: number }>();
  for (const l of lignes) {
    const a = parId.get(l.avoir_id);
    if (!a || !l.product_id) continue;
    const total = Number(l.total ?? 0);
    let coutRemis = 0;
    if (a.facture_numero && facturesRemisesEnStock.has(a.facture_numero) && a.ticket_id) {
      for (const v of ventes)
        if ((v.ticketId ?? v.id) === a.ticket_id && v.productId === l.product_id)
          coutRemis += v.totalAchatRef;
    }
    const deja = effets.get(l.product_id) ?? { ca: 0, marge: 0 };
    effets.set(l.product_id, { ca: deja.ca + total, marge: deja.marge + total - coutRemis });
  }
  return effets;
}
