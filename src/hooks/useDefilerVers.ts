import { useCallback, useEffect, useState } from "react";

/**
 * Amener un élément à l'écran APRÈS le rendu qui l'affiche.
 *
 * Ouvrir une fiche, c'est d'abord un changement d'état (la sélection),
 * puis un rendu qui fait apparaître la fiche. Un défilement demandé au
 * moment du changement d'état — même dans un `requestAnimationFrame` —
 * part souvent avant ce rendu : l'élément n'existe pas encore, et sur
 * téléphone, où la fiche est SOUS la liste, on restait en haut de la page
 * sans voir ce qu'on venait d'ouvrir. L'effet, lui, s'exécute après.
 */
export function useDefilerVers(bloc: ScrollLogicalPosition = "start"): (idElement: string) => void {
  const [demande, setDemande] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    if (!demande) return;
    document.getElementById(demande.id)?.scrollIntoView({ behavior: "smooth", block: bloc });
  }, [demande, bloc]);

  return useCallback((id: string) => setDemande((d) => ({ id, n: (d?.n ?? 0) + 1 })), []);
}
