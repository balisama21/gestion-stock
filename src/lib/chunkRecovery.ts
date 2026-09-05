/**
 * Reprise après un déploiement.
 *
 * L'application est découpée en morceaux chargés à la demande, dont le
 * nom contient une empreinte du contenu. À chaque mise en ligne, ces
 * noms changent et les anciens fichiers disparaissent du serveur.
 *
 * Un onglet resté ouvert continue pourtant d'exécuter l'ancienne
 * version, et le premier clic qui déclenche un chargement différé
 * réclame un fichier qui n'existe plus. L'utilisateur voit alors une
 * erreur incompréhensible :
 *
 *   Failed to fetch dynamically imported module:
 *   .../assets/html2canvas-pro.esm-CsKucYx7.js
 *
 * Ce n'est pas une panne de l'application : c'est un onglet périmé. La
 * seule issue correcte est de recharger la page, ce qu'on fait ici
 * automatiquement — une fois, et une seule.
 *
 * Le garde-fou compte : sans lui, une vraie coupure réseau produirait la
 * même erreur et la page se rechargerait en boucle. Un jeton posé dans
 * `sessionStorage` limite la reprise à une tentative par onglet.
 */

const JETON = "balsama-rechargement-deploiement";

/** Reconnaît l'échec de chargement d'un morceau, quel que soit le navigateur. */
function estUnMorceauManquant(message: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Unable to preload CSS/i.test(message)
  );
}

/**
 * Tente de récupérer d'un morceau manquant en rechargeant la page.
 *
 * Renvoie `true` si un rechargement a été lancé — l'appelant n'a alors
 * rien d'autre à faire —, `false` si l'erreur doit être traitée
 * normalement.
 */
export function reprendreApresDeploiement(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  if (!estUnMorceauManquant(message)) return false;

  try {
    if (sessionStorage.getItem(JETON)) return false; // déjà tenté
    sessionStorage.setItem(JETON, "1");
  } catch {
    // Navigation privée ou stockage refusé : on recharge quand même,
    // au risque d'une seconde tentative. Mieux vaut cela qu'un écran
    // bloqué sur une erreur que l'utilisateur ne peut pas comprendre.
  }

  window.location.reload();
  return true;
}

/**
 * Branche la reprise sur les erreurs qui échappent au code applicatif :
 * un import différé déclenché par le routeur, par exemple, n'est pas
 * entouré d'un `try`.
 */
export function installerRepriseApresDeploiement(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reprendreApresDeploiement(new Error("Failed to fetch dynamically imported module"));
  });

  window.addEventListener("unhandledrejection", (e) => {
    if (reprendreApresDeploiement(e.reason)) e.preventDefault();
  });
}

/**
 * Message à montrer quand la reprise n'a pas eu lieu — deuxième échec
 * dans le même onglet, ou vraie coupure réseau.
 */
export function messageDErreurExport(erreur: unknown): string {
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  if (estUnMorceauManquant(message)) {
    return "Le téléchargement des outils d'export a échoué. Vérifiez votre connexion, puis rechargez la page.";
  }
  return message || "Le document n'a pas pu être exporté.";
}
