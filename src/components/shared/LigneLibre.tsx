import React from "react";
import { Infobulle } from "./Infobulle";

/**
 * « Produit libre » décrivait le mécanisme — une ligne sans fiche — au
 * lieu de dire ce que ça change : pas de stock touché, pas de marge
 * calculée. Le libellé nomme le geste, l'aide dit la conséquence.
 *
 * Écrit ici une seule fois pour les quatre écrans qui le disaient
 * chacun à leur façon.
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
