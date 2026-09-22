import type { Sale } from "../../types";

/**
 * UN PAIEMENT SUR UNE FACTURE, ET DES LIGNES EN DESSOUS.
 *
 * Une facture est un ticket ; la base, elle, tient le solde LIGNE PAR
 * LIGNE, et `add_payment` s'adresse à une ligne. Encaisser une facture
 * revient donc à répartir la somme reçue sur ses lignes.
 *
 * ── DANS L'ORDRE DU TICKET, EN SOLDANT CHACUNE ─────────────────────
 *
 * C'est exactement ce que fait déjà `create_sale_ticket` pour l'acompte
 * versé au comptoir : la première ligne est soldée avant qu'on entame
 * la suivante. Répartir au prorata laisserait toutes les lignes
 * partiellement dues, et personne ne saurait plus dire ce qui a été
 * payé.
 *
 * ── LE RESTE NE PEUT PAS DEVENIR NÉGATIF ───────────────────────────
 *
 * Ce qui dépasse le total dû n'est pas réparti : la base refuserait de
 * toute façon — un garde-fou anti-surpaiement existe depuis la phase 1
 * — et un appel voué à échouer est un message d'erreur pour rien.
 */

export interface PartDePaiement {
  saleId: string;
  montant: number;
}

export function repartirLePaiement(ventes: Sale[], montant: number): PartDePaiement[] {
  let reste = Math.max(0, montant);
  const parts: PartDePaiement[] = [];

  for (const v of ventes) {
    if (reste <= 0) break;
    const du = Math.max(0, v.soldeDu);
    if (du <= 0) continue;
    const part = Math.min(reste, du);
    parts.push({ saleId: v.id, montant: part });
    reste -= part;
  }

  return parts;
}

/** Ce que le ticket doit encore, toutes lignes confondues. */
export const resteDuTicket = (ventes: Sale[]): number =>
  ventes.reduce((n, v) => n + Math.max(0, v.soldeDu), 0);

export const MODES_DE_PAIEMENT = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "mobile_money", libelle: "Mobile Money" },
  { valeur: "virement", libelle: "Virement" },
  { valeur: "cheque", libelle: "Chèque" },
] as const;
