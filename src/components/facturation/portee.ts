import type { Sale } from "../../types";
import type { Devis } from "../../lib/devis";

/**
 * QUI VOIT QUOI.
 *
 * « Un vendeur voit seulement ses propres documents. »
 *
 * La portée se pose sur les LIGNES, avant que la page n'en fasse des
 * pièces — et non sur un filtre de l'écran, qu'il suffirait de changer
 * pour retrouver la facture d'un collègue. C'est la même mécanique que
 * les modules Ventes, Clients et Commandes, et elle est écrite ici
 * plutôt que dans l'écran d'accueil pour qu'on puisse la vérifier.
 *
 * ── DEUX RATTACHEMENTS, PARCE QUE LES PIÈCES N'EN ONT PAS QU'UN ────
 *
 * Une vente porte le NOM du vendeur, saisi au comptoir. Un devis porte
 * l'IDENTIFIANT de qui l'a établi. Ce n'est pas une incohérence à
 * corriger : au comptoir, le vendeur est souvent quelqu'un qui n'a pas
 * de compte — c'est le propriétaire qui saisit pour lui.
 */

/** Les ventes de cette personne, ou toutes quand la portée est large. */
export function ventesDeLaPortee(sales: Sale[], voitTout: boolean, moiNom: string): Sale[] {
  if (voitTout) return sales;
  if (!moiNom) return [];
  return sales.filter((v) => v.vendeur === moiNom);
}

/** Les offres établies par cette personne, ou toutes. */
export function offresDeLaPortee(
  quotes: Devis[],
  voitTout: boolean,
  monId: string | null,
): Devis[] {
  if (voitTout) return quotes;
  if (!monId) return [];
  return quotes.filter((q) => q.created_by === monId);
}

/**
 * Le classeur des factures reçues appartient à la boutique entière.
 *
 * Il n'a ni vendeur ni auteur qui vaille : une facture fournisseur
 * arrive au nom du commerce. Une personne en portée « mes documents »
 * ne le voit donc pas du tout, plutôt que d'en voir une part arbitraire.
 */
export const voitLesFacturesRecues = (voitTout: boolean): boolean => voitTout;
