import { useEffect, useState } from "react";

/**
 * LE DRAPEAU DE L'ORGANISATION v2
 *
 * Même mécanique que celui du tableau de bord (`dashboard-v2/drapeau.ts`),
 * sur une clé à part pour pouvoir régler l'un sans l'autre.
 *
 * ALLUMÉ PAR DÉFAUT POUR TOUT LE MONDE depuis le 16 octobre 2026, après la
 * mise en ligne. Quand il est baissé, les quatre écrans d'avant (Vue
 * d'ensemble, Tâches, Agenda, Rappels) reviennent inchangés, écritures
 * comprises, et le code de la v2 n'est même pas chargé.
 *
 *   VITE_ORGANISATION_V2 = "0"           → ÉTEINT pour tout le monde, au
 *                                          build (le retour arrière global)
 *   ?organisation_v2=0 / =1              → depuis un lien, sur un appareil ;
 *                                          le choix reste
 *   localStorage.organisation_v2 = "0"   → pour un seul navigateur
 *
 * L'adresse, puis le navigateur, l'emportent sur la variable du build.
 * Rien n'est stocké en base.
 */

const OUI = new Set(["1", "true", "oui", "on"]);
const NON = new Set(["0", "false", "non", "off"]);
const CLE = "organisation_v2";

/** Allumé sauf si le build dit explicitement non. */
const PAR_ENV = !NON.has(String(import.meta.env.VITE_ORGANISATION_V2 ?? "").toLowerCase());

/** Ce que ce navigateur-ci a retenu ; `null` s'il n'a rien dit. */
function parNavigateur(): boolean | null {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (brut === null) return null;
    const valeur = brut.toLowerCase();
    return OUI.has(valeur) ? true : NON.has(valeur) ? false : null;
  } catch {
    return null;
  }
}

/**
 * Ce que l'adresse demande. Le choix est retenu, puis le paramètre retiré
 * de la barre d'adresse sans recharger ni ajouter d'entrée d'historique.
 * Un « non » est retenu lui aussi : sans cela, il ne pourrait pas
 * l'emporter sur la variable du build après la première navigation.
 */
function parAdresse(): boolean | null {
  try {
    const url = new URL(window.location.href);
    const brut = url.searchParams.get(CLE);
    if (brut === null) return null;
    const valeur = brut.toLowerCase();
    const demande = OUI.has(valeur) ? true : NON.has(valeur) ? false : null;
    if (demande === null) return null;
    try {
      window.localStorage.setItem(CLE, demande ? "1" : "0");
    } catch {
      /* Navigation privée : le choix ne vaut que pour cette page-ci. */
    }
    url.searchParams.delete(CLE);
    window.history.replaceState(null, "", url.toString());
    return demande;
  } catch {
    return null;
  }
}

/** À appeler tôt, dans la coquille : le paramètre doit survivre à la connexion. */
export function useCaptureDuDrapeauOrganisation(): void {
  useEffect(() => {
    parAdresse();
  }, []);
}

/**
 * La v2 est-elle demandée ? Lue dans un effet et non pendant le rendu :
 * le serveur n'a ni `localStorage` ni barre d'adresse, et deux arbres
 * différents entre serveur et navigateur feraient tout redessiner.
 */
export function useOrganisationV2(): boolean {
  const [actif, setActif] = useState(PAR_ENV);
  useEffect(() => {
    setActif(parAdresse() ?? parNavigateur() ?? PAR_ENV);
  }, []);
  return actif;
}
