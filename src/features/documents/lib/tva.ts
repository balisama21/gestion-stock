/**
 * LA TVA, LIGNE PAR LIGNE
 *
 * Trois endroits portent un taux : la fiche produit, sa catégorie, la
 * boutique. Le premier renseigné l'emporte, dans cet ordre — le même
 * que pour le taux de marge. Un taux de 0 est un taux : un produit
 * exonéré ne retombe pas sur les 20 % de la boutique.
 *
 * Ce fichier ne calcule aucun prix. Il dit quelle part d'un total
 * DÉJÀ ENREGISTRÉ est de la taxe, taux par taux — voir `totauxDeVente`
 * pour la raison qui fait extraire la TVA au lieu de l'ajouter.
 */

/** Ce qu'il faut savoir d'un produit pour lui trouver son taux. */
export interface ProduitTva {
  id: string;
  /** Le taux de la fiche. `null` : celui de la catégorie, puis de la boutique. */
  tvaRate: number | null;
  /** Le taux de sa catégorie, quand elle en porte un. */
  tvaCategorie?: number | null;
}

const taux = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

/**
 * Le taux d'un produit : le sien, sinon celui de sa catégorie, sinon
 * celui de la boutique. Une ligne sans produit — une ligne libre d'un
 * devis, un avoir sans détail — prend celui de la boutique.
 */
export function tauxDuProduit(
  productId: string | null | undefined,
  produits: readonly ProduitTva[],
  tauxBoutique: number,
): number {
  const p = productId ? produits.find((x) => x.id === productId) : undefined;
  return taux(p?.tvaRate) ?? taux(p?.tvaCategorie) ?? taux(tauxBoutique) ?? 0;
}

/**
 * Les taux figés à l'émission d'une pièce, ligne par ligne.
 *
 * Une pièce émise se réimprime telle qu'elle est partie, même si la
 * fiche d'un produit change de taux entre-temps. `"avant"` : la pièce
 * est partie avant que chaque ligne ait son taux. Elle ressort alors
 * comme à l'époque — au taux de la boutique pour une vente, sans TVA
 * pour les autres pièces, qui n'en montraient pas.
 */
export type TauxFiges = Readonly<Record<string, number>> | "avant";

/** La part d'un taux dans le total. */
export interface TvaParTaux {
  taux: number;
  /** La base hors taxe des lignes à ce taux. */
  horsTaxe: number;
  montant: number;
}

/**
 * La TVA comprise dans un total, ventilée par taux.
 *
 * Chaque groupe de lignes de même taux donne sa taxe par extraction,
 * arrondie à l'unité, et sa base par soustraction : `horsTaxe +
 * montant` vaut exactement la somme des lignes du groupe, et la somme
 * des groupes vaut exactement le total.
 *
 * `null` quand la ventilation mentirait : une ligne sans taux ou sans
 * montant, ou des lignes dont la somme n'est pas le total annoncé — un
 * avoir d'un montant libre, par exemple. Mieux vaut pas de TVA qu'une
 * TVA calculée sur autre chose que ce que le client paie.
 */
export function ventilerTva(
  lignes: readonly { tva: number | null; total: number | null }[],
  total: number,
): TvaParTaux[] | null {
  if (lignes.length === 0) return null;
  const parTaux = new Map<number, number>();
  let somme = 0;
  for (const l of lignes) {
    if (l.tva === null || l.total === null) return null;
    parTaux.set(l.tva, (parTaux.get(l.tva) ?? 0) + l.total);
    somme += l.total;
  }
  if (Math.abs(somme - total) > 0.005) return null;

  return [...parTaux.entries()]
    .sort(([a], [b]) => b - a)
    .map(([t, ttc]) => {
      const montant = t > 0 ? Math.round(ttc - ttc / (1 + t / 100)) : 0;
      return { taux: t, horsTaxe: ttc - montant, montant };
    });
}
