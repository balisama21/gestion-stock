import React, { useState } from "react";
import { adresseVignetteProduit } from "../../lib/stockageFichiers";
import { teinteDe } from "../../lib/teintes";

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
 * ── Sans photo, l'INITIALE sur sa pastille ──
 *
 * Un produit sans photo porte la premiere lettre de son nom, en blanc,
 * sur un fond colore a coins arrondis. La place n'est plus laissee
 * vide : une colonne de blancs ne disait pas « ce produit n'a pas de
 * photo », elle donnait l'impression que l'ecran n'avait pas fini de
 * charger.
 *
 * LA COULEUR VIENT DU NOM, par `teinteDe`, la meme fonction qui colore
 * les avatars des vendeurs et des clients. Un article garde donc sa
 * teinte d'un chargement a l'autre et d'un ecran a l'autre, ce qui en
 * fait un repere utilisable. Elle ne dit RIEN de l'etat de la ligne :
 * ce n'est pas une couleur de statut, seulement de reconnaissance.
 *
 * UN CERCLE, comme les avatars des vendeurs et des clients. J'avais
 * d'abord pose un carre a coins arrondis, en me disant qu'un objet ne
 * se represente pas comme une personne et que la difference de forme
 * aiderait a les distinguer. L'utilisateur a tranche pour le cercle :
 * une seule forme de vignette dans toute l'application se retient
 * mieux qu'une regle a deux cas, et les rapports de taille de `.av`
 * sont deja calibres pour un disque.
 *
 * LA PLACE RESTE LA MEME, et cela porte tout : la pastille occupe
 * exactement les dimensions de la photo qu'elle remplace. Sans cela,
 * les lignes sans photo verraient leur texte glisser vers la gauche et
 * la liste cesserait de s'aligner — l'oeil trebuche a chaque saut, et
 * une colonne de noms en dents de scie se lit mal.
 *
 * LA PHOTO, ELLE, N'EST PAS ENCADREE. Quand elle existe, elle se pose
 * toujours nue sur la page, sans fond ni coin arrondi. Ce n'est pas un
 * oubli : une pastille est une convention qui remplace une image
 * absente, pas un cadre qu'on imposerait a une image presente.
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
    return (
      <span
        style={{
          ...cote,
          background: teinteDe(nom),
          borderRadius: "50%",
          // La taille suit le cote : la meme vignette sert a 36 pixels
          // dans une liste et bien plus grand dans une fiche. Le
          // rapport est celui de `.av` — 13 px de texte pour 36 de
          // cote — pour que les deux vignettes soient de la meme
          // famille.
          fontSize: Math.round(taille * 0.36),
          lineHeight: 1,
        }}
        title={nom}
        // Decoratif : le nom du produit est ecrit juste a cote, et une
        // lecture d'ecran qui annoncerait « H » avant « Huile » ne
        // ferait que begayer.
        aria-hidden="true"
        className={`flex shrink-0 select-none items-center justify-center font-bold text-white ${className}`}
      >
        {initialeDe(nom)}
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
