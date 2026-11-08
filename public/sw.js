/*
 * Service worker de Tantana Suite.
 *
 * Écrit à la main plutôt que produit par vite-plugin-pwa : dans la
 * chaîne de compilation de TanStack Start, qui construit séparément un
 * paquet client et un paquet serveur, le plugin dépose bien son
 * manifeste mais ne génère aucun service worker. Le manifeste reste donc
 * déclaré dans vite.config.ts ; seul ce fichier est écrit à part.
 *
 * L’APK peut réutiliser le document public anonyme au démarrage.
 * Les données du compte et de la boutique sont toujours lues sur le réseau.
 */

const VERSION = "tantana-v7";
const CACHE_STATIQUE = `${VERSION}-statique`;
const CACHE_POLICES = `${VERSION}-polices`;
const cacheAccueil = VERSION + "-accueil";
const domaineTantana = self.location.hostname === "tantana-suite.com";

async function relireAccueil() {
  const response = await fetch("/", {
    credentials: "omit", cache: "no-cache", headers: { Accept: "text/html" },
  });
  if (response.ok && !response.redirected && response.headers.get("X-Tantana-Accueil-Public") === "1") {
    try { await (await caches.open(cacheAccueil)).put("/", response.clone()); }
    catch { /* Un cache plein ne doit pas bloquer le document reçu. */ }
  }
  return response;
}

self.addEventListener("message", event => {
  if (domaineTantana && event.data === "preparer-accueil-apk" &&
      event.source?.url && new URL(event.source.url).origin === self.location.origin) {
    event.waitUntil((async () => {
      const cached = await (await caches.open(cacheAccueil)).match("/");
      if (!cached) await relireAccueil();
    })().catch(() => {}));
  }
});

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

  // Seule l’entrée publique de l’APK peut être servie localement.
  if (domaineTantana && request.mode === "navigate" && url.origin === self.location.origin &&
      url.pathname === "/" && !url.search && request.cache !== "reload" &&
      !request.headers.has("authorization") &&
      / TantanaAndroid(?:Essai)?\//.test(request.headers.get("user-agent") || self.navigator.userAgent)) {
    const fresh = relireAccueil();
    event.waitUntil(fresh.then(() => {}, () => {}));
    event.respondWith((async () => {
      const cached = await caches.match("/", { cacheName: cacheAccueil }).catch(() => undefined);
      const age = Date.now() - Date.parse(cached?.headers.get("date") || "");
      return cached && age >= 0 && age < 86400000 ? cached : fresh;
    })());
    return;
  }
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

self.addEventListener("push", (event) => {
  const tag = event.data?.json()?.tag;
  if (typeof tag !== "string") return;
  event.waitUntil(self.registration.showNotification("Tantana · Rappel", {
    body: "Un rappel vous attend dans Organisation.",
    icon: "/icon-192.png", tag, data: { rappel: true },
  }));
});

self.addEventListener("notificationclick", (event) => {
  if (!event.notification.data?.rappel) return;
  event.notification.close();
  event.waitUntil((async () => {
    for (const client of await self.clients.matchAll({type:"window"})) {
      if (new URL(client.url).origin === self.location.origin) return client.focus();
    }
    return self.clients.openWindow("/");
  })());
});
