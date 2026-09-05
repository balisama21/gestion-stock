/**
 * Enregistrement du service worker.
 *
 * Fait à la main parce que le projet est rendu côté serveur : il n'y a
 * aucun `index.html` statique où vite-plugin-pwa aurait pu injecter son
 * script d'enregistrement.
 *
 * Uniquement en production. En développement, un service worker se met
 * entre le navigateur et le serveur de Vite, intercepte le rechargement
 * à chaud et fait apparaître des versions figées de fichiers qu'on vient
 * de modifier — on passe alors des heures à déboguer un code qui n'est
 * plus celui qui s'exécute.
 */
export function enregistrerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  // Après le chargement : l'enregistrement entre en concurrence avec le
  // téléchargement des ressources de la page, et rien ne presse.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Un enregistrement refusé — navigation privée, réglage du
      // navigateur — n'empêche pas l'application de fonctionner. Elle
      // perd seulement l'installation et la mise en cache.
    });
  });
}

/** Vrai quand l'application tourne déjà installée, hors du navigateur. */
export function estInstallee(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari sur iOS n'expose pas `display-mode` et utilise ce drapeau
    // propriétaire, non standard, absent des types du DOM.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Vrai sur iPhone et iPad, y compris les iPad qui se déclarent en Mac. */
export function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ annonce un Macintosh ; l'écran tactile le trahit.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Événement d'installation de Chrome, capté au plus tôt.
 *
 * Chrome émet `beforeinstallprompt` très tôt après le chargement —
 * souvent AVANT que React n'ait monté le composant qui l'attend. Un
 * écouteur posé dans un `useEffect` arrive alors trop tard et la
 * bannière ne s'affiche jamais. Le défaut est sournois : il ne se voit
 * pas en développement, où le rechargement à chaud remonte les
 * composants après coup.
 *
 * L'écouteur est donc installé dès l'évaluation de ce module, et
 * l'événement conservé. Le composant vient le chercher quand il est
 * prêt, qu'il soit arrivé avant ou après lui.
 */
export interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let evenementRetenu: EvenementInstallation | null = null;
const abonnes = new Set<(e: EvenementInstallation) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Écarte la fenêtre native de Chrome : c'est notre bannière qui
    // décidera du moment, et elle seule.
    e.preventDefault();
    evenementRetenu = e as EvenementInstallation;
    abonnes.forEach((fn) => fn(evenementRetenu as EvenementInstallation));
  });

  window.addEventListener("appinstalled", () => {
    evenementRetenu = null;
  });
}

/** Événement déjà capté, s'il est arrivé avant le montage du composant. */
export function evenementInstallationCapte(): EvenementInstallation | null {
  return evenementRetenu;
}

/** S'abonne aux événements à venir. Renvoie de quoi se désabonner. */
export function surEvenementInstallation(
  fn: (e: EvenementInstallation) => void,
): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}
