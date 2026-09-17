import { useEffect, useState } from "react";

/**
 * LE DRAPEAU QUI DÉCIDE QUEL TABLEAU DE BORD S'AFFICHE
 *
 * Le logiciel tourne chez un client. La refonte ne doit donc jamais
 * être « en ligne à moitié » : tant que le drapeau est baissé, c'est
 * l'ancien tableau de bord qui s'affiche, inchangé, et le nouveau ne
 * charge même pas son code.
 *
 * DEUX INTERRUPTEURS, ET AUCUN EN BASE.
 *
 *   localStorage.dashboard_v2 = "1"   → pour un seul navigateur
 *   VITE_DASHBOARD_V2 = "1"           → pour tout le monde, au build
 *
 * Rien n'est stocké en base : le jour où la v2 devient la seule
 * version, il n'y aura ni colonne ni migration à défaire.
 */

/** Valeurs acceptées comme « oui », pour ne pas piéger sur `"true"`. */
const OUI = new Set(["1", "true", "oui", "on"]);

const CLE = "dashboard_v2";

/**
 * L'interrupteur du build. Lu une fois : `import.meta.env` est figé à la
 * compilation, il ne changera pas pendant que la page vit.
 */
const PAR_ENV = OUI.has(String(import.meta.env.VITE_DASHBOARD_V2 ?? "").toLowerCase());

/** Ce que ce navigateur-ci en dit. Peut échouer : navigation privée. */
function parNavigateur(): boolean {
  try {
    return OUI.has(String(window.localStorage.getItem(CLE) ?? "").toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Le tableau de bord v2 est-il demandé ?
 *
 * POURQUOI UN EFFET ET NON UNE SIMPLE LECTURE. Les pages sont rendues
 * sur le serveur, qui n'a pas de `localStorage`. Lire le drapeau
 * pendant le rendu ferait dire au serveur « v1 » et au navigateur
 * « v2 » sur la même page : React verrait les deux arbres diverger et
 * jetterait tout l'affichage pour le refaire. On part donc de ce que le
 * serveur sait — la variable du build — et le choix du navigateur
 * arrive juste après, à la première image, sans rien casser.
 */
export function useDashboardV2(): boolean {
  const [actif, setActif] = useState(PAR_ENV);

  useEffect(() => {
    if (!PAR_ENV) setActif(parNavigateur());
  }, []);

  return actif;
}
