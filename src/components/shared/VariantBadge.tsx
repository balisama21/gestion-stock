import React from "react";
import { formatCurrency } from "../../utils/formulas";

interface VariantBadgeProps {
  /**
   * Prix d'achat qui distingue cette entrée de ses homonymes, ou `null`
   * quand le produit est seul de son nom. Vient de `getProductVariant`,
   * `getSaleVariant` ou `getPurchaseVariant`.
   */
  prix: number | null;
  /**
   * Faux quand l'utilisateur n'a pas le droit de voir les prix d'achat.
   * Le badge disparaît alors entièrement : mieux vaut ne pas distinguer
   * deux variantes que révéler un prix négocié.
   */
  autorise?: boolean;
}

/**
 * Marque discrète posée à côté du nom d'un produit qui existe en
 * plusieurs versions.
 *
 * Elle remplace l'indice en chiffres subscript collé au nom
 * (« Savon₁₀₀₀ »), qui avait deux défauts : il apparaissait sur des
 * produits sans aucune variante, et le chiffre brut ne disait pas à quoi
 * il correspondait.
 *
 * Le prix d'achat a été retenu parce qu'il est le vrai discriminant —
 * c'est lui qui sépare deux entrées de même nom, dans le code comme dans
 * les données — qu'il est toujours renseigné, et qu'il parle au
 * commerçant : « le parfum à 1 000 » et non « le parfum ₁₀₀₀ ».
 *
 * Deux règles à respecter chez l'appelant :
 * — jamais sur un document remis à un client : le prix d'achat est la
 *   marge du magasin, elle ne le regarde pas ;
 * — jamais sans la permission correspondante, d'où `autorise`.
 */
export const VariantBadge: React.FC<VariantBadgeProps> = ({ prix, autorise = true }) => {
  if (prix === null || !autorise) return null;

  return (
    <span
      className="app-badge app-badge-neutral shrink-0 px-1.5 py-0 text-[10px] font-medium"
      title="Ce produit existe en plusieurs versions — voici son prix d'achat"
    >
      {formatCurrency(prix)}
    </span>
  );
};
