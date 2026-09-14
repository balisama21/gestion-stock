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
  /** Le nom du produit, porte en infobulle sur la photo. */
  nom: string;
  /** Le chemin de la photo dans le stockage. Nul = pas de photo. */
  chemin?: string | null;
  /** Côté en pixels. 36 dans une liste, plus grand dans une fiche. */
  taille?: number;
  className?: string;
}

/**
 * La vignette d'un produit — la photo seule, ou rien.
 *
 * ── Ni cadre, ni fond ──
 *
 * La photo se pose directement sur la page. Pas de filet, pas d'aplat
 * gris derriere, pas de coin arrondi : rien qui dise « ceci est une
 * miniature ». Un produit detoure flotte alors sur le blanc, comme sur
 * les catalogues en ligne ; une photo ordinaire se montre telle
 * qu'elle est, sans qu'on lui ait dessine une boite autour.
 *
 * `object-contain` et non `cover` : sans cadre, plus rien ne delimite
 * la zone dans laquelle recadrer, et un produit ampute de ses bords se
 * verrait d'autant plus. L'adresse demandee au stockage porte le meme
 * `resize=contain`, pour que le rognage ne revienne pas par le serveur.
 *
 * ── Sans photo, RIEN ──
 *
 * Plus de carre a initiale. Un produit sans photo ne recoit aucune
 * forme, aucun trait, aucune lettre.
 *
 * La PLACE, elle, reste. C'est une nuance, et elle porte tout : le
 * span garde sa taille mais ne peint rien. Sans cela, les lignes sans
 * photo verraient leur texte glisser vers la gauche et la liste
 * cesserait de s'aligner — l'oeil trebuche a chaque saut, et une
 * colonne de noms en dents de scie se lit mal. Une place vide ne se
 * voit pas ; un decalage, si.
 *
 * ── Le poids ──
 *
 * L'adresse demandee porte la taille voulue : le serveur renvoie une
 * miniature, pas la photo d'origine. Sur un cliche reel de la
 * boutique, 132 631 octets deviennent 1 927 — soixante-neuf fois
 * moins. Cela compte pour une liste de vingt lignes ouverte en donnees
 * mobiles.
 *
 * ── Quand l'image ne vient pas ──
 *
 * Fichier efface du stockage, reseau coupe, adresse perimee : on
 * retombe sur la place vide plutot que sur la petite icone d'image
 * brisee du navigateur.
 */
export const VignetteProduit: React.FC<VignetteProduitProps> = ({
  nom,
  chemin,
  taille = 36,
  className = "",
}) => {
  const [echec, setEchec] = useState(false);
  const cote = { width: taille, height: taille };

  if (!chemin || echec) {
    return <span style={cote} aria-hidden="true" className={`shrink-0 ${className}`} />;
  }

  return (
    <img
      // Le double de la taille d'affichage : sur un ecran dense, une
      // miniature a l'echelle exacte parait floue.
      src={adresseVignetteProduit(chemin, taille * 2)}
      alt=""
      title={nom}
      width={taille}
      height={taille}
      style={cote}
      loading="lazy"
      decoding="async"
      onError={() => setEchec(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
};
