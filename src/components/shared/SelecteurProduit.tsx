import React, { useMemo } from "react";
import { SelecteurListe, type OptionDeSelecteur } from "./SelecteurListe";
import { formatCurrency, getProductLabel } from "../../utils/formulas";
import type { Product } from "../../types";

/** Un produit tel que le sélecteur le montre. Chaque écran dit ce qu'il en garde. */
export interface ProduitAChoisir {
  id: string;
  nom: string;
  /** « P087 ». */
  numero?: string | null;
  /** Le prix qui a un sens sur cet écran : de vente à la caisse, d'achat au réassort. */
  prix?: number | null;
  /** Absent, pas de pastille : la facture d'achat n'a que faire du stock. */
  stock?: number | null;
  seuil?: number | null;
  /** Retrouvés par la recherche sans être affichés : SKU, code-barres. */
  codes?: (string | null | undefined)[];
}

/**
 * Le produit du catalogue, prêt pour le sélecteur.
 *
 * `prix` choisit le prix montré ; `null` n'en montre aucun — le prix
 * d'achat est un secret commercial, il ne s'affiche que là où l'on
 * achète.
 */
export const versProduitAChoisir = (
  p: Product,
  produits: Product[],
  { prix = "vente", stock = true }: { prix?: "vente" | "achat" | null; stock?: boolean } = {},
): ProduitAChoisir => ({
  id: p.id,
  nom: getProductLabel(p, produits),
  numero: p.numero,
  prix: prix === "vente" ? p.prixVenteDefaut : prix === "achat" ? p.prixAchat : null,
  stock: stock ? p.stockDisponible : null,
  seuil: p.seuilAlerte,
  codes: [p.sku, p.codeBarres],
});

const pastilleDe = (stock: number, seuil: number | null | undefined) =>
  stock <= 0
    ? { texte: "Rupture", ton: "vide" as const }
    : {
        texte: `${stock} en stock`,
        ton: stock <= (seuil ?? 0) ? ("bas" as const) : ("ok" as const),
      };

interface SelecteurProduitProps {
  produits: ProduitAChoisir[];
  /** L'identifiant choisi ; chaîne vide quand rien ne l'est. */
  valeur: string;
  onChange: (id: string) => void;
  /** Absent, l'appelant pose son propre `<label htmlFor={id}>`. */
  label?: string;
  id?: string;
  /** Le choix vide : « Ligne libre », « Choisir un produit existant ». */
  libelleVide?: string;
  placeholder?: string;
  aide?: React.ReactNode;
  compact?: boolean;
}

/**
 * Choisir un produit du catalogue.
 *
 * Le nom seul, lisible ; la référence et le prix en petit dessous ; le
 * stock en pastille colorée. On retrouve un produit en tapant son nom,
 * sa référence ou son code-barres. Remplace les listes déroulantes où
 * tout tenait sur une ligne : « [P087] Sac kraft (réf 1 800 Ar |
 * disponible 40) », illisible sur un téléphone.
 */
export const SelecteurProduit: React.FC<SelecteurProduitProps> = ({
  produits,
  valeur,
  onChange,
  label,
  id,
  libelleVide,
  placeholder = "Chercher un produit, une référence…",
  aide,
  compact,
}) => {
  const options = useMemo<OptionDeSelecteur[]>(
    () =>
      produits.map((p) => ({
        id: p.id,
        nom: p.nom,
        detail:
          [p.numero, p.prix != null ? formatCurrency(p.prix) : null].filter(Boolean).join(" · ") ||
          null,
        pastille: p.stock != null ? pastilleDe(p.stock, p.seuil) : null,
        motsCles: [p.numero, ...(p.codes ?? [])].filter(Boolean).join(" ") || null,
      })),
    [produits],
  );

  return (
    <SelecteurListe
      id={id}
      label={label}
      options={options}
      valeur={valeur || null}
      onChange={(choix) => onChange(choix ?? "")}
      libelleVide={libelleVide}
      placeholder={placeholder}
      aide={aide}
      compact={compact}
      messageVide="Aucun produit ne correspond."
    />
  );
};
