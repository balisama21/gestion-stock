import React, { useState } from "react";
import { adresseVignetteProduit } from "../../lib/stockageFichiers";

/**
 * Quelle photo sert de vignette, pour chaque produit.
 *
 * La première de la liste, c'est-à-dire celle dont l'`ordre` est le plus
 * petit — la même règle que dans la fiche produit, où l'étoile la
 * désigne. Une table de correspondance plutôt qu'une recherche par
 * ligne : un catalogue de deux cents produits ferait sinon deux cents
 * parcours de la liste des images à chaque rendu.
 */
export const vignettesParProduit = (
  images: { product_id: string | null; chemin: string; ordre: number }[],
): Map<string, string> => {
  const table = new Map<string, string>();
  for (const image of [...images].sort((a, b) => a.ordre - b.ordre)) {
    if (image.product_id && !table.has(image.product_id)) {
      table.set(image.product_id, image.chemin);
    }
  }
  return table;
};

interface VignetteProduitProps {
  /** De quoi tirer l'initiale quand il n'y a pas de photo. */
  nom: string;
  /** Le chemin de la photo dans le stockage. Nul = pas de photo. */
  chemin?: string | null;
  /** Côté en pixels. 36 dans une liste, plus grand dans une fiche. */
  taille?: number;
  className?: string;
}

/**
 * La vignette d'un produit, photo ou non.
 *
 * ── Les deux cas se ressemblent, exprès ──
 *
 * Un produit sans photo n'est pas un produit cassé : c'est le cas le
 * plus fréquent dans une boutique qui démarre. Il reçoit donc le même
 * carré, au même endroit, avec le même arrondi et le même filet — seul
 * le contenu change. Une liste où certaines lignes ont un visuel et
 * d'autres un trou ne s'aligne plus, et l'œil trébuche à chaque saut.
 *
 * L'initiale plutôt qu'un pictogramme de colis : le motif existe déjà
 * pour les vendeurs et les clients, il n'introduit donc aucun style
 * nouveau, et surtout deux produits différents ne se ressemblent pas —
 * ce qu'un colis gris répété vingt fois ne donne pas.
 *
 * ── Le poids ──
 *
 * L'adresse demandée porte la taille voulue : le serveur renvoie une
 * miniature, pas la photo d'origine. Sur un cliché réel de la boutique,
 * 132 631 octets deviennent 1 927 — soixante-neuf fois moins. Cela
 * compte pour une liste de vingt lignes ouverte en données mobiles.
 *
 * ── Quand l'image ne vient pas ──
 *
 * Fichier effacé du stockage, réseau coupé, adresse périmée : plutôt que
 * la petite icône d'image brisée du navigateur, on retombe sur le carré
 * à initiale. L'utilisateur voit une liste propre, pas une panne.
 */
export const VignetteProduit: React.FC<VignetteProduitProps> = ({
  nom,
  chemin,
  taille = 36,
  className = "",
}) => {
  const [echec, setEchec] = useState(false);
  const cote = { width: taille, height: taille };
  const forme = `shrink-0 rounded-lg border border-border ${className}`;

  if (!chemin || echec) {
    return (
      <span
        style={cote}
        aria-hidden="true"
        className={`${forme} flex items-center justify-center bg-muted font-medium text-muted-foreground`}
      >
        {nom.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      // Le double de la taille d'affichage : sur un écran dense, une
      // miniature à l'échelle exacte paraît floue.
      src={adresseVignetteProduit(chemin, taille * 2)}
      alt=""
      width={taille}
      height={taille}
      style={cote}
      loading="lazy"
      decoding="async"
      onError={() => setEchec(true)}
      className={`${forme} bg-muted object-cover`}
    />
  );
};
