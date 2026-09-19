import { useEffect, useState } from "react";

/**
 * LE DRAPEAU QUI DÉCIDE QUEL TABLEAU DE BORD S'AFFICHE
 *
 * Le logiciel tourne chez un client. La refonte ne doit donc jamais
 * être « en ligne à moitié » : tant que le drapeau est baissé, c'est
 * l'ancien tableau de bord qui s'affiche, inchangé, et le nouveau ne
 * charge même pas son code.
 *
 * TROIS INTERRUPTEURS, ET AUCUN EN BASE.
 *
 *   ?dashboard_v2=1                   → depuis un lien, sur n'importe
 *                                       quel appareil ; le choix reste
 *   localStorage.dashboard_v2 = "1"   → pour un seul navigateur
 *   VITE_DASHBOARD_V2 = "1"           → pour tout le monde, au build
 *
 * POURQUOI LE PARAMÈTRE D'ADRESSE. Les deux autres supposent une
 * console — celle du navigateur, ou celle du serveur de build. Sur un
 * téléphone, ni l'une ni l'autre n'est à portée, et c'est précisément
 * là qu'on veut regarder l'écran. Un lien suffit désormais.
 *
 * Rien n'est stocké en base : le jour où la v2 devient la seule
 * version, il n'y aura ni colonne ni migration à défaire.
 */

/** Valeurs acceptées comme « oui », pour ne pas piéger sur `"true"`. */
const OUI = new Set(["1", "true", "oui", "on"]);

/** Et celles qui éteignent, pour pouvoir revenir en arrière du même geste. */
const NON = new Set(["0", "false", "non", "off"]);

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
 * Ce que l'adresse demande, s'il y a quelque chose.
 *
 * Le choix est ENREGISTRÉ puis le paramètre RETIRÉ de la barre
 * d'adresse : sans cela, le drapeau se perdrait à la première
 * navigation, et l'adresse resterait encombrée d'un réglage technique
 * qu'on partagerait sans le vouloir. `replaceState` ne recharge rien et
 * n'ajoute pas d'entrée dans l'historique — le bouton « retour »
 * continue de faire ce qu'on attend de lui.
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
      if (demande) window.localStorage.setItem(CLE, "1");
      else window.localStorage.removeItem(CLE);
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

/**
 * Capture le choix venu de l'adresse, le retient, et nettoie la barre.
 *
 * À APPELER LE PLUS TÔT POSSIBLE, dans la coquille de l'application, et
 * non dans l'écran d'accueil : celui-ci ne se monte qu'une fois la
 * personne connectée. Sur un téléphone qui ouvre le lien sans session
 * ouverte, le paramètre doit survivre à l'écran de connexion — et
 * certaines façons de se connecter passent par une redirection qui
 * l'emporterait. Lu à l'ouverture de la page, il est à l'abri.
 */
export function useCaptureDuDrapeau(): void {
  useEffect(() => {
    parAdresse();
  }, []);
}

/**
 * Le tableau de bord v2 est-il demandé ?
 *
 * POURQUOI UN EFFET ET NON UNE SIMPLE LECTURE. Les pages sont rendues
 * sur le serveur, qui n'a ni `localStorage` ni la barre d'adresse du
 * navigateur. Lire le drapeau pendant le rendu ferait dire au serveur
 * « v1 » et au navigateur « v2 » sur la même page : React verrait les
 * deux arbres diverger et jetterait tout l'affichage pour le refaire.
 * On part donc de ce que le serveur sait — la variable du build — et le
 * reste arrive juste après, à la première image, sans rien casser.
 *
 * L'ADRESSE A LE DERNIER MOT, même sur la variable du build : c'est
 * elle qui permet d'éteindre la v2 depuis un téléphone quand elle est
 * allumée pour tout le monde.
 */
export function useDashboardV2(): boolean {
  const [actif, setActif] = useState(PAR_ENV);

  useEffect(() => {
    // `useCaptureDuDrapeau` a déjà transformé un éventuel paramètre
    // d'adresse en choix retenu ; il ne reste qu'à le lire.
    setActif(parAdresse() ?? (PAR_ENV || parNavigateur()));
  }, []);

  return actif;
}
