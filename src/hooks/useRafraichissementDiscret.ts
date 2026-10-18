import { useEffect, useRef } from "react";

/**
 * Relire les données en silence, pour que ce que font les AUTRES arrive.
 *
 * Sans cela, la vente qu'un vendeur enregistre sur son téléphone
 * n'apparaissait chez le gérant — ni dans ses chiffres, ni dans sa
 * cloche — qu'au prochain rechargement complet de la page.
 *
 * Seulement quand l'onglet est visible : un téléphone posé sur le
 * comptoir toute la journée n'a aucune raison d'interroger la base en
 * boucle. Au retour au premier plan, on relit une fois, sans attendre.
 */
export function useRafraichissementDiscret(
  relire: () => void,
  intervalleMs: number,
  actif: boolean,
): void {
  const courant = useRef(relire);
  courant.current = relire;

  useEffect(() => {
    if (!actif) return;
    let dernier = Date.now();
    const tenter = () => {
      if (document.visibilityState !== "visible") return;
      // Deux déclencheurs rapprochés (retour d'onglet + battement) ne
      // font qu'une lecture.
      if (Date.now() - dernier < 5_000) return;
      dernier = Date.now();
      courant.current();
    };
    const battement = window.setInterval(tenter, intervalleMs);
    document.addEventListener("visibilitychange", tenter);
    window.addEventListener("focus", tenter);
    return () => {
      window.clearInterval(battement);
      document.removeEventListener("visibilitychange", tenter);
      window.removeEventListener("focus", tenter);
    };
  }, [intervalleMs, actif]);
}
