import type { Sale } from "../types";
import { dateDuJour } from "./dates";

/**
 * CE QU'UNE COMMANDE DOIT ENCORE, ET CE QU'ELLE PÈSE.
 *
 * Une commande annulée garde en base son `reste_a_payer` : `set_order_status`
 * rembourse ce qui avait été versé et libère le stock, mais ne remet pas
 * la colonne à zéro. Chaque écran devait donc écarter les annulées lui-même,
 * et ils ne le faisaient pas tous — le tableau de bord les filtrait sous le
 * nom « annulee », un statut qui n'existe pas (l'énumération `order_status`
 * dit `annule`), et comptait ainsi une commande annulée comme argent à
 * recevoir.
 *
 * Tout écran qui additionne des commandes passe par ici.
 */

/** La valeur de l'énumération `order_status` pour une commande annulée. */
export const COMMANDE_ANNULEE = "annule";

export function commandeAnnulee(o: { statut_commande: string | null }): boolean {
  return o.statut_commande === COMMANDE_ANNULEE;
}

/** Ce qui reste à encaisser : zéro pour une commande annulée. */
export function resteDuCommande(o: {
  statut_commande: string | null;
  reste_a_payer: number | null;
}): number {
  return commandeAnnulee(o) ? 0 : Math.max(0, o.reste_a_payer ?? 0);
}

/** La valeur de l'énumération `order_status` pour une commande livrée. */
export const COMMANDE_LIVREE = "livre";

export function commandeLivree(o: { statut_commande: string | null }): boolean {
  return o.statut_commande === COMMANDE_LIVREE;
}

/**
 * LE CHIFFRE D'AFFAIRES D'UNE COMMANDE : À LA LIVRAISON, PAS AVANT.
 *
 * Règle décidée le 18 octobre. Une commande en attente ou en cours ne
 * fait que RÉSERVER du stock : rien n'est encore vendu, et le client peut
 * annuler. Le jour où elle est livrée, la marchandise est sortie — c'est
 * une vente, payée ou non, exactement comme une vente à crédit au
 * comptoir. Annulée, elle ne compte pas (une annulation après livraison
 * rembourse et remet en stock : la vente disparaît).
 *
 * Avant, la page Commandes et la fiche client comptaient toutes les
 * commandes non annulées, livrées ou non ; le tableau de bord, le Bilan et
 * Ventes n'en comptaient aucune. Les deux règles divergeaient.
 */
export function montantCommande(o: {
  statut_commande: string | null;
  montant_total: number;
}): number {
  return commandeLivree(o) ? o.montant_total : 0;
}

/** Ce que les calculs lisent d'une commande et de ses lignes. */
export interface CommandePourChiffres {
  id: string;
  numero: string;
  statut_commande: string | null;
  client_id: string | null;
  owner_id: string | null;
  updated_at: string;
  items?: {
    id: string;
    product_id: string | null;
    designation: string;
    quantite: number;
    prix_vente_unit: number;
    prix_achat_unit: number;
    total_vente: number;
    total_achat_ref: number;
    marge_totale: number;
  }[];
}

/** Le préfixe des lignes de vente issues d'une commande livrée. */
export const PREFIXE_COMMANDE = "commande:";

/**
 * Les commandes livrées, traduites en lignes de vente POUR LES CALCULS :
 * chiffre d'affaires, marge, courbe, meilleurs produits, sorties de stock,
 * total acheté d'un client. Une ligne par article, comme un ticket.
 *
 * La date est celle de la LIVRAISON — l'instant où la base a sorti la
 * marchandise du stock (mouvement « commande_livraison »), ramené au jour
 * local. À défaut (commande sans article suivi en stock), la dernière
 * mise à jour de la commande.
 *
 * Ces lignes ne s'affichent pas dans la liste des ventes et ne portent
 * aucune créance (`soldeDu` à zéro) : ce que la commande doit encore se
 * lit sur la commande elle-même (`resteDuCommande`), jamais deux fois.
 */
export function lignesDesCommandesLivrees(
  commandes: readonly CommandePourChiffres[],
  livreeLe: ReadonlyMap<string, string>,
): Sale[] {
  const lignes: Sale[] = [];
  for (const o of commandes) {
    if (!commandeLivree(o)) continue;
    const instant = livreeLe.get(o.id) ?? o.updated_at;
    const date = dateDuJour(new Date(instant));
    for (const it of o.items ?? []) {
      lignes.push({
        id: `${PREFIXE_COMMANDE}${o.id}:${it.id}`,
        numero: o.numero,
        date,
        productId: it.product_id ?? "",
        designation: it.designation,
        quantite: it.quantite,
        prixVenteUnit: it.prix_vente_unit,
        totalVente: it.total_vente,
        prixAchatUnitRef: it.prix_achat_unit ?? 0,
        totalAchatRef: it.total_achat_ref ?? 0,
        margeTotale: it.marge_totale ?? 0,
        vendeur: "",
        clientId: o.client_id,
        ticketId: `${PREFIXE_COMMANDE}${o.id}`,
        commission: 0,
        montantPaye: 0,
        montantRembourse: 0,
        montantAvoire: 0,
        soldeDu: 0,
        statutCredit: "Payé",
        auteurId: o.owner_id,
        saisieLe: instant,
        origine: "commande",
      });
    }
  }
  return lignes;
}
