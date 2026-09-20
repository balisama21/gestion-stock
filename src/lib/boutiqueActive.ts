/**
 * LA DERNIÈRE BOUTIQUE OUVERTE, RETENUE PAR NAVIGATEUR
 *
 * Un compte peut avoir plusieurs boutiques ; on revient normalement
 * dans celle qu'on a quittée. Cette mémoire vivait dans
 * `useWorkspace.ts`, écrite à trois endroits et effacée à aucun — et
 * c'est ce qui rendait une boutique expirée inévitable : la clé
 * continuait de la désigner, chaque reconnexion y ramenait, et l'écran
 * de blocage n'offrait aucun moyen d'en changer. Sortie ici pour que
 * la déconnexion puisse l'oublier sans importer tout l'espace de
 * travail — `useWorkspace` importe déjà `useAuth`, l'inverse aurait
 * fermé le cercle.
 *
 * TOUT EST ENVELOPPÉ DANS UN `try` : en navigation privée, lire
 * `localStorage` lève au lieu de rendre `null`. Sans mémoire, on
 * retombe sur la première boutique du compte, ce qui est un défaut de
 * confort, pas une panne.
 */

const CLE = "balsama-active-store-id";

const cleDe = (userId: string) => `${CLE}:${userId}`;

export function lireBoutiqueActive(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cleDe(userId));
  } catch {
    return null;
  }
}

export function retenirBoutiqueActive(userId: string, storeId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleDe(userId), storeId);
  } catch {
    /* sans mémoire, le choix vaut pour cette visite */
  }
}

export function oublierBoutiqueActive(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cleDe(userId));
  } catch {
    /* rien à oublier */
  }
}
