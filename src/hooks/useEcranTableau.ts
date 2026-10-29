import { useEffect, useState } from "react";

/**
 * Assez de place pour un tableau ?
 *
 * Sur PC, les listes deviennent des tableaux à colonnes ; sur téléphone
 * et tablette, elles restent des listes, que l'on lit au pouce. Le seuil
 * tient compte de la barre latérale : à 1180 px de fenêtre, il reste
 * environ 880 px pour le tableau.
 *
 * Sans `matchMedia` (tests, rendu serveur), c'est la liste : l'affichage
 * de toujours.
 */
const REQUETE = "(min-width: 1180px)";

const correspond = () =>
  typeof window !== "undefined" && window.matchMedia?.(REQUETE).matches === true;

export function useEcranTableau(): boolean {
  const [large, setLarge] = useState(correspond);

  useEffect(() => {
    const mql = window.matchMedia?.(REQUETE);
    if (!mql) return;
    const suivre = () => setLarge(mql.matches);
    suivre();
    mql.addEventListener?.("change", suivre);
    return () => mql.removeEventListener?.("change", suivre);
  }, []);

  return large;
}
