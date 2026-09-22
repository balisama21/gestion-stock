import React from "react";
import { Infobulle } from "./Infobulle";

/**
 * LE MOT, ET SON EXPLICATION, ÉCRITS UNE SEULE FOIS.
 *
 * ── CE QUE « PRODUIT LIBRE » VOULAIT DIRE ──
 *
 * Rien, pour le client qui l'a signalé. Ce n'est pas une notion de la
 * base : c'est l'option vide du sélecteur de produit, dans une commande,
 * un devis ou une facture. La choisir veut dire « cette ligne ne
 * correspond à aucun produit du catalogue, je tape moi-même sa
 * désignation et son prix ».
 *
 * Le terme décrivait donc le MÉCANISME — un produit sans lien, libre de
 * toute fiche — au lieu de décrire ce que ça change pour le commerçant.
 * Et ce que ça change tient en deux points, que les quatre écrans
 * disaient chacun à leur façon : « Produit libre », « Ligne libre »,
 * « Hors catalogue », « Prestation — hors catalogue ».
 *
 * Le libellé retenu nomme le geste, l'aide dit la conséquence.
 */
export const LIBELLE_LIGNE_LIBRE = "Ligne libre — hors catalogue";

export const AideLigneLibre: React.FC = () => (
  <Infobulle sujet="les lignes hors catalogue">
    Une ligne que vous écrivez vous-même : désignation et prix libres, sans passer par une fiche
    produit. Elle ne bouge pas votre stock, et comme elle n&apos;a pas de prix d&apos;achat, aucune
    marge n&apos;est calculée dessus. Pratique pour une prestation, un frais de transport ou un
    article acheté pour l&apos;occasion.
  </Infobulle>
);

/** L'intitulé du champ, avec son point d'interrogation. */
export const EtiquetteAvecAideLigneLibre: React.FC<{
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ htmlFor, children }) => (
  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
    <label htmlFor={htmlFor}>{children}</label>
    <AideLigneLibre />
  </span>
);
