import React, { useEffect, useState } from "react";
import { adresseVignetteProduit } from "../../lib/stockageFichiers";
import {
  pastelDe,
  preparerVignette,
  vignetteConnue,
  type VignettePreparee,
} from "../../lib/vignetteDetouree";

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

/**
 * La lettre a montrer, ou rien quand le nom n'en donne aucune.
 *
 * `trim()` d'abord : un nom saisi avec une espace devant donnerait une
 * case vide, ce qui ressemblerait a une panne. Un nom qui commence par
 * un chiffre garde son chiffre — « 500ml Huile » affiche « 5 », ce qui
 * reste un reperage utile.
 */
const initialeDe = (nom: string): string => nom.trim().charAt(0).toUpperCase();
interface VignetteProduitProps {
  /** Le nom du produit, porte en infobulle sur la photo. */
  nom: string;
  /** Le chemin de la photo dans le stockage. Nul = pas de photo. */
  chemin?: string | null;
  /** Diamètre en pixels. 36 dans une liste, plus grand dans une fiche. */
  taille?: number;
  className?: string;
}

/**
 * La vignette d'un produit : un disque, le produit posé dedans.
 *
 * AVEC UNE PHOTO, le produit est détouré (voir `vignetteDetouree.ts`)
 * et posé sur un fond pâle tiré de sa propre couleur. Tant que le
 * détourage n'est pas prêt, ou si le stockage refuse la lecture, la
 * photo se fond dans le disque par un mélange « produit » : un fond
 * blanc prend la couleur du disque au lieu de dessiner un carré. Une
 * photo au fond trop chargé pour être retiré remplit le disque.
 *
 * SANS PHOTO, ou quand elle ne vient pas, l'initiale du produit sur le
 * même disque pâle, dans une encre de sa teinte. Le disque garde
 * exactement la place de la photo : la liste reste alignée.
 *
 * La couleur de secours vient du NOM, jamais du hasard : un article
 * garde sa teinte d'un écran et d'un chargement à l'autre.
 */
export const VignetteProduit: React.FC<VignetteProduitProps> = ({
  nom,
  chemin,
  taille = 36,
  className = "",
}) => {
  const [echec, setEchec] = useState(false);
  // Le double de la taille d'affichage : sur un écran dense, une
  // miniature à l'échelle exacte paraît floue.
  const url = chemin ? adresseVignetteProduit(chemin, Math.max(96, taille * 2)) : null;
  const [prete, setPrete] = useState<VignettePreparee | null | undefined>(() =>
    url ? vignetteConnue(url) : undefined,
  );

  useEffect(() => {
    if (!url) return;
    let actif = true;
    setPrete(vignetteConnue(url));
    void preparerVignette(url).then((r) => {
      if (actif) setPrete(r);
    });
    return () => {
      actif = false;
    };
  }, [url]);

  const secours = pastelDe(nom);
  const disque: React.CSSProperties = {
    width: taille,
    height: taille,
    background: prete?.fond ?? secours.fond,
  };
  const classes = `vignette-produit${className ? ` ${className}` : ""}`;

  if (!url || echec) {
    return (
      <span
        className={classes}
        style={{
          ...disque,
          color: secours.encre,
          fontSize: Math.round(taille * 0.4),
        }}
        title={nom}
        // Décoratif : le nom du produit est écrit juste à côté.
        aria-hidden="true"
      >
        {initialeDe(nom)}
      </span>
    );
  }

  const mode = prete ? (prete.detouree ? "detouree" : "pleine") : "fondue";
  return (
    <span className={`${classes} ${mode}`} style={disque} title={nom}>
      <img
        src={prete?.src ?? url}
        alt=""
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        onError={() => setEchec(true)}
      />
    </span>
  );
};
