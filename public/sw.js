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

const VERSION = "tantana-v6";
const CACHE_STATIQUE = `${VERSION}-statique`;
const CACHE_POLICES = `${VERSION}-polices`;

// Les fichiers d'assets portent une empreinte dans leur nom : un contenu
// modifié change de nom. Ils sont donc immuables, et les garder en cache
// ne peut jamais donner une version périmée.
//
// LE MANIFESTE N'EN EST PAS UN, et il était pourtant dans cette liste.
// `/manifest.webmanifest` garde son nom quoi qu'il contienne : mis au
// cache immuable, la version du jour de l'installation y restait pour
// toujours. C'est par là que le navigateur apprend la couleur de la
// barre d'état d'une application installée — la changer ne servait donc
// à rien, le téléphone continuait de lire l'ancienne. Il passe au
// réseau d'abord, et ne retombe sur le cache que hors ligne.
const estAssetImmuable = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/assets/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname));

const estManifeste = (url) =>
  url.origin === self.location.origin && url.pathname.endsWith(".webmanifest");

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

  // Le manifeste : réseau d'abord, cache en secours. Le navigateur le
  // relit régulièrement pour savoir si l'application installée a changé
  // d'icône, de nom ou de couleur ; lui servir une copie figée revient
  // à lui cacher ces changements.
  if (estManifeste(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_STATIQUE);
        try {
          const reponse = await fetch(request, { cache: "no-cache" });
          if (reponse.ok) cache.put(request, reponse.clone());
          return reponse;
        } catch (echec) {
          const enCache = await cache.match(request);
          if (enCache) return enCache;
          throw echec;
        }
      })(),
    );
    return;
  }

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
