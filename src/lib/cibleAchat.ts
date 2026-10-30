/**
 * QUEL PRODUIT UN ACHAT RECHARGE
 *
 * L'écran des achats désigne le produit lui-même (`productId`). Cet
 * identifiant est envoyé tel quel, même absent de la liste locale : un
 * produit créé à l'instant par « Nouveau produit » n'y figure pas encore,
 * la liste se rafraîchit après. C'est la base qui vérifie qu'il
 * appartient à la boutique, et qui refuse sinon (« Produit introuvable
 * dans cette boutique »).
 *
 * Sans identifiant, on retombe sur l'ancienne correspondance par nom,
 * prix et fournisseur ; à défaut, l'achat crée le produit.
 */

interface ProduitConnu {
  id: string;
  designation: string;
  prixAchat: number;
  fournisseur: string;
}

export const cibleDeLAchat = <P extends ProduitConnu>(
  achat: {
    productId?: string | null;
    designation: string;
    prixAchatUnit: number;
    fournisseur: string;
  },
  produits: P[],
): { productId: string | null; produit: P | null } => {
  if (achat.productId) {
    return {
      productId: achat.productId,
      produit: produits.find((p) => p.id === achat.productId) ?? null,
    };
  }
  const produit =
    produits.find(
      (p) =>
        p.designation.toLowerCase() === achat.designation.toLowerCase() &&
        Math.abs(p.prixAchat - achat.prixAchatUnit) < 0.01 &&
        p.fournisseur.toLowerCase() === achat.fournisseur.toLowerCase(),
    ) ?? null;
  return { productId: produit?.id ?? null, produit };
};
