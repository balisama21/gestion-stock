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
 * ── Sans photo, l'INITIALE ──
 *
 * Un produit sans photo porte la premiere lettre de son nom. La place
 * n'est plus laissee vide : une colonne de blancs ne disait pas
 * « ce produit n'a pas de photo », elle donnait l'impression que
 * l'ecran n'avait pas fini de charger.
 *
 * SIMPLEMENT UNE LETTRE, et c'est voulu : pas de carre, pas d'aplat,
 * pas de couleur. Le carre a initiale colore qu'on voit partout
 * ailleurs enfreindrait la regle de la maison — le rouge, l'orange, le
 * bleu et le violet sont reserves aux badges de statut, le vert aux
 * actions. L'initiale se pose donc en gris discret, a la place exacte
 * qu'aurait occupee la photo.
 *
 * LA PLACE RESTE LA MEME, et cela porte tout : la lettre occupe
 * exactement les dimensions de la photo qu'elle remplace. Sans cela,
 * les lignes sans photo verraient leur texte glisser vers la gauche et
 * la liste cesserait de s'aligner — l'oeil trebuche a chaque saut, et
 * une colonne de noms en dents de scie se lit mal.
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
 * retombe sur l'initiale plutot que sur la petite icone d'image brisee
 * du navigateur.
 */

/**
 * La lettre a montrer, ou rien quand le nom n'en donne aucune.
 *
 * `trim()` d'abord : un nom saisi avec une espace devant donnerait une
 * case vide, ce qui ressemblerait a une panne. Un nom qui commence par
 * un chiffre garde son chiffre — « 500ml Huile » affiche « 5 », ce qui
 * reste un reperage utile.
 */
const initialeDe = (nom: string): string => nom.trim().charAt(0).toUpperCase();
export const VignetteProduit: React.FC<VignetteProduitProps> = ({
  nom,
  chemin,
  taille = 36,
  className = "",
}) => {
  const [echec, setEchec] = useState(false);
  const cote = { width: taille, height: taille };

  if (!chemin || echec) {
    const lettre = initialeDe(nom);
    return (
      <span
        style={{
          ...cote,
          // Proportionnelle au cote : la meme vignette sert a 36 pixels
          // dans une liste et bien plus grand dans une fiche produit.
          fontSize: Math.round(taille * 0.42),
          lineHeight: 1,
        }}
        title={nom}
        // Decoratif : le nom du produit est ecrit juste a cote, et une
        // lecture d'ecran qui annoncerait « H » avant « Huile » ne
        // ferait que begayer.
        aria-hidden="true"
        className={`flex shrink-0 select-none items-center justify-center font-medium text-muted-foreground ${className}`}
      >
        {lettre}
      </span>
    );
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
