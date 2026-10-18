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

/** Le montant vendu : une commande annulée ne fait pas de chiffre d'affaires. */
export function montantCommande(o: {
  statut_commande: string | null;
  montant_total: number;
}): number {
  return commandeAnnulee(o) ? 0 : o.montant_total;
}
