/*
 * Service worker de Tantana Suite.
 *
 * Écrit à la main plutôt que produit par vite-plugin-pwa : dans la
 * chaîne de compilation de TanStack Start, qui construit séparément un
 * paquet client et un paquet serveur, le plugin dépose bien son
 * manifeste mais ne génère aucun service worker. Le manifeste reste donc
 * déclaré dans vite.config.ts ; seul ce fichier est écrit à part.
 *
 * Il a deux rôles, et volontairement pas un de plus :
 *
 *   1. rendre l'application installable — un navigateur exige un service
 *      worker actif avant de proposer l'ajout à l'écran d'accueil ;
 *   2. éviter de retélécharger les fichiers statiques à chaque
 *      ouverture, ce qui compte sur une connexion mobile.
 *
 * Ce qu'il ne fait PAS, et pourquoi : il ne met en cache ni les pages ni
 * les données. Les pages sont rendues par le serveur, et les données
 * — stocks, soldes, paiements — viennent de Supabase. Servir une version
 * périmée d'un solde ferait prendre une décision sur un chiffre faux ;
 * une erreur franche vaut mieux. L'application ne fonctionne donc pas
 * hors ligne, et c'est un choix.
 */

const VERSION = "tantana-v3";
const CACHE_STATIQUE = `${VERSION}-statique`;
const CACHE_POLICES = `${VERSION}-polices`;

// Les fichiers d'assets portent une empreinte dans leur nom : un contenu
// modifié change de nom. Ils sont donc immuables, et les garder en cache
// ne peut jamais donner une version périmée.
const estAssetImmuable = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") ||
    /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname));

const estPolice = (url) =>
  url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com");

self.addEventListener("install", (event) => {
  // Prise de fonction immédiate : sans cela une nouvelle version resterait
  // en attente jusqu'à la fermeture de tous les onglets.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Navigations et appels de données : réseau, sans intermédiaire.
  if (request.mode === "navigate") return;
  if (url.hostname.endsWith(".supabase.co")) return;

  if (estAssetImmuable(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_STATIQUE);
        const enCache = await cache.match(request);
        if (enCache) return enCache;
        const reponse = await fetch(request);
        // Une réponse opaque ou en erreur n'a rien à faire en cache : elle
        // s'y figerait et masquerait un fichier réparé entre-temps.
        if (reponse.ok) cache.put(request, reponse.clone());
        return reponse;
      })(),
    );
    return;
  }

  if (estPolice(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_POLICES);
        const enCache = await cache.match(request);
        if (enCache) return enCache;
        const reponse = await fetch(request);
        if (reponse.ok || reponse.type === "opaque") cache.put(request, reponse.clone());
        return reponse;
      })(),
    );
  }
});
