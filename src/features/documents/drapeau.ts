import { useEffect, useState } from "react";

/**
 * LE DRAPEAU QUI DÉCIDE QUELS DOCUMENTS SORTENT DE L'IMPRIMANTE
 *
 * Le logiciel tourne chez un client qui facture tous les jours. Tant
 * que ce drapeau est baissé, ce sont les reçus et factures actuels qui
 * s'impriment, strictement inchangés.
 *
 * Calqué sur `features/dashboard-v2/drapeau.ts`, volontairement : la
 * mécanique y a déjà servi, elle est comprise, et deux interrupteurs
 * qui se ressemblent s'expliquent une seule fois.
 *
 *   ?documents_v2=1                   → depuis un lien, sur n'importe
 *                                       quel appareil ; le choix reste
 *   localStorage.documents_v2 = "1"   → pour un seul navigateur
 *   VITE_DOCUMENTS_V2 = "1"           → pour tout le monde, au build
 *
 * Le paramètre d'adresse existe pour une raison précise : les deux
 * autres supposent une console, celle du navigateur ou celle du
 * serveur de build. Une facture se vérifie sur le téléphone du
 * comptoir, où ni l'une ni l'autre n'est à portée.
 *
 * Rien en base : le jour où la v2 devient la seule version, il n'y
 * aura ni colonne ni migration à défaire.
 */

/** Ce qui vaut « oui », pour ne pas piéger sur `"true"`. */
const OUI = new Set(["1", "true", "oui", "on"]);

/** Et ce qui éteint, pour revenir en arrière du même geste. */
const NON = new Set(["0", "false", "non", "off"]);

const CLE = "documents_v2";

/** Figé à la compilation : il ne changera pas pendant que la page vit. */
const PAR_ENV = OUI.has(String(import.meta.env.VITE_DOCUMENTS_V2 ?? "").toLowerCase());

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
 * Le choix est retenu puis le paramètre RETIRÉ de la barre d'adresse :
 * sans cela il se perdrait à la première navigation, et on le
 * partagerait sans le vouloir en envoyant un lien. `replaceState` ne
 * recharge rien et n'ajoute pas d'entrée dans l'historique.
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
 * À appeler le plus tôt possible dans la coquille de l'application :
 * sur un téléphone qui ouvre le lien sans session, le paramètre doit
 * survivre à l'écran de connexion.
 */
export function useCaptureDuDrapeauDocuments(): void {
  useEffect(() => {
    parAdresse();
  }, []);
}

/**
 * Les documents v2 sont-ils demandés ?
 *
 * On part de ce que le serveur sait — la variable du build — et le
 * reste arrive à la première image. Lire `localStorage` pendant le
 * rendu ferait diverger le serveur et le navigateur sur la même page,
 * et React jetterait tout l'affichage pour le refaire.
 *
 * L'adresse a le dernier mot, même sur la variable du build : c'est
 * elle qui permet d'éteindre la v2 depuis un téléphone quand elle est
 * allumée pour tout le monde.
 */
export function useDocumentsV2(): boolean {
  const [actif, setActif] = useState(PAR_ENV);

  useEffect(() => {
    setActif(parAdresse() ?? (PAR_ENV || parNavigateur()));
  }, []);

  return actif;
}
