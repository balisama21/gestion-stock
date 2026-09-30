import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from "./appConfig";
import { landingDepuisJson, type LandingMarque } from "./landingMarque";

/**
 * Marque blanche : l'identité affichée dépend du domaine visité.
 *
 * Chaîne : hôte → `get_public_branding` (RPC anon) → cache localStorage
 * → appliqué avant le rendu React par le script en ligne du `<head>`,
 * puis rafraîchi en arrière-plan par `MarqueProvider`.
 */

export interface Marque {
  nom: string;
  nomCourt: string;
  slogan: string;
  titre: string | null;
  logoUrl: string;
  faviconUrl: string;
  splashLogoUrl: string | null;
  splashFond: string | null;
  connexionImageUrl: string | null;
  connexionTitre: string | null;
  connexionSousTitre: string | null;
  couleurPrimaire: string | null;
  couleurPrimaireSombre: string | null;
  /** Page d'accueil propre à la marque ; `null` : connexion seule. */
  landing: LandingMarque | null;
  /** Vrai pour Tantana : le rendu d'origine s'applique tel quel. */
  parDefaut: boolean;
}

/** Icône vide : aucune requête, et surtout pas l'icône de Tantana. */
export const SANS_ICONE = "data:,";

export const MARQUE_PAR_DEFAUT: Marque = {
  nom: APP_NAME,
  nomCourt: APP_SHORT_NAME,
  slogan: APP_TAGLINE,
  titre: null,
  logoUrl: "/logo.svg",
  faviconUrl: "/favicon.ico",
  splashLogoUrl: null,
  splashFond: null,
  connexionImageUrl: null,
  connexionTitre: null,
  connexionSousTitre: null,
  couleurPrimaire: null,
  couleurPrimaireSombre: null,
  landing: null,
  parDefaut: true,
};

/** Ligne renvoyée par `get_public_branding`. */
export interface LigneMarquePublique {
  app_name: string;
  short_name: string | null;
  tagline: string | null;
  page_title: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  splash_logo_url: string | null;
  login_image_url: string | null;
  login_title: string | null;
  login_subtitle: string | null;
  primary_color: string | null;
  primary_color_dark: string | null;
  splash_background: string | null;
  /** Absent tant que la migration `marque_blanche_landing` n'est pas passée. */
  landing?: unknown;
}

export const CLE_CACHE_MARQUE = "tantana.marque.v1";
const DUREE_FRAICHEUR_MS = 5 * 60 * 1000;

interface CacheMarque {
  hote: string;
  marque: Marque | null;
  t: number;
}

export function normaliserHote(hote: string): string {
  return hote
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

/** localhost, IP, previews Netlify : toujours Tantana, sans requête. */
export function estHoteParDefaut(hote: string): boolean {
  const h = normaliserHote(hote);
  return (
    h === "" ||
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "[::1]" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) ||
    h.endsWith(".netlify.app") ||
    h.endsWith(".netlify.live")
  );
}

const HEX = /^#[0-9a-f]{6}$/i;
const URL_SURE = /^(https:\/\/|\/)[^"'\\\s()<>]+$/;
const url = (v: string | null): string | null => (v && URL_SURE.test(v) ? v : null);
const hex = (v: string | null): string | null => (v && HEX.test(v) ? v : null);

export function marqueDepuisLigne(l: LigneMarquePublique): Marque {
  return {
    nom: l.app_name,
    nomCourt: l.short_name || l.app_name,
    slogan: l.tagline ?? "",
    titre: l.page_title,
    // Sans image fournie : rien, plutôt que le logo de Tantana.
    logoUrl: url(l.logo_url) ?? "",
    faviconUrl: url(l.favicon_url) ?? url(l.logo_url) ?? SANS_ICONE,
    splashLogoUrl: url(l.splash_logo_url),
    splashFond: hex(l.splash_background),
    connexionImageUrl: url(l.login_image_url),
    connexionTitre: l.login_title,
    connexionSousTitre: l.login_subtitle,
    couleurPrimaire: hex(l.primary_color),
    couleurPrimaireSombre: hex(l.primary_color_dark),
    landing: landingDepuisJson(l.landing),
    parDefaut: false,
  };
}

function hoteCourant(): string {
  return typeof window === "undefined" ? "" : normaliserHote(window.location.hostname);
}

function lireCache(): CacheMarque | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_CACHE_MARQUE);
    if (!brut) return null;
    const c = JSON.parse(brut) as CacheMarque;
    return c && c.hote === hoteCourant() ? c : null;
  } catch {
    return null;
  }
}

export function ecrireCacheMarque(marque: Marque | null): void {
  memo = marque ?? MARQUE_PAR_DEFAUT;
  if (typeof window === "undefined") return;
  try {
    const c: CacheMarque = { hote: hoteCourant(), marque, t: Date.now() };
    window.localStorage.setItem(CLE_CACHE_MARQUE, JSON.stringify(c));
  } catch {
    /* navigation privée : la marque vaut pour cette visite */
  }
}

export function cacheMarqueFrais(): boolean {
  const c = lireCache();
  return c !== null && Date.now() - c.t < DUREE_FRAICHEUR_MS;
}

let memo: Marque | null = null;

/** Posé par `server.ts` : la marque de l'hôte de la requête en cours. */
type LecteurMarqueServeur = () => Marque | null | undefined;
const lecteurServeur = (): LecteurMarqueServeur | undefined =>
  (globalThis as { __marqueDeLaRequete?: LecteurMarqueServeur }).__marqueDeLaRequete;

/**
 * La marque connue à cet instant. Serveur : celle de l'hôte de la
 * requête (Tantana par défaut). Client : celle du cache.
 */
export function marqueCourante(): Marque {
  if (typeof window === "undefined") return lecteurServeur()?.() ?? MARQUE_PAR_DEFAUT;
  if (memo) return memo;
  memo = estHoteParDefaut(window.location.hostname)
    ? MARQUE_PAR_DEFAUT
    : (lireCache()?.marque ?? MARQUE_PAR_DEFAUT);
  return memo;
}

/**
 * La marque avec laquelle le serveur a rendu la page, transmise par le
 * script du `<head>` : l'état initial qui hydrate sans écart.
 */
export function marqueDuRendu(): Marque {
  if (typeof window === "undefined") return marqueCourante();
  return (window as { __marqueRendu?: Marque | null }).__marqueRendu ?? MARQUE_PAR_DEFAUT;
}

/** Manifeste PWA : fichier statique pour Tantana, généré par hôte sinon. */
export const MANIFESTE_PAR_DEFAUT = "/manifest.webmanifest";
export const MANIFESTE_DE_MARQUE = "/marque.webmanifest";
export const manifesteDe = (m: Marque): string =>
  m.parDefaut ? MANIFESTE_PAR_DEFAUT : MANIFESTE_DE_MARQUE;

/** Titre d'onglet ; `titreTantana` ne sert que pour la marque d'origine. */
export const titreDePage = (m: Marque, titreTantana: string): string =>
  m.parDefaut ? titreTantana : m.titre || m.nom;

/**
 * Applique une marque au document. AUTONOME (ni import, ni closure) :
 * son texte source est aussi injecté tel quel dans le `<head>` pour
 * s'exécuter avant React. `m === null` rétablit Tantana.
 */
export function appliquerMarqueAuDocument(m: Marque | null): void {
  const d = document;
  const racine = d.documentElement;
  const ID_STYLE = "tantana-marque";
  let style = d.getElementById(ID_STYLE);

  const echapCss = (s: string): string =>
    s.replace(/[^a-zA-Z0-9 .,:;!?\-_/#%&=+]/g, (c) => "\\" + c.charCodeAt(0).toString(16) + " ");

  const texteClair = (h: string): boolean => {
    const n = parseInt(h.slice(1), 16);
    const lin = (v: number): number => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L < 0.2;
  };

  const lien = (rel: string): HTMLLinkElement => {
    let l = d.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!l) {
      l = d.createElement("link");
      l.rel = rel;
      d.head.appendChild(l);
    }
    return l;
  };

  if (!m || m.parDefaut) {
    if (style) style.remove();
    racine.removeAttribute("data-marque");
    return;
  }

  // Titre et icônes
  const titre = m.titre || m.nom;
  if (d.title !== titre) d.title = titre;
  const icone = lien("icon");
  icone.removeAttribute("type");
  icone.href = m.faviconUrl;
  lien("apple-touch-icon").href = m.faviconUrl;
  const metaApple = d.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (metaApple) metaApple.content = m.nomCourt;
  const manifeste = "/marque.webmanifest";
  const lienManifeste = lien("manifest");
  if (lienManifeste.getAttribute("href") !== manifeste) lienManifeste.href = manifeste;

  // Couleurs et splash, par variables CSS : aucun nœud React touché.
  const regles: string[] = [];
  const vars: string[] = [
    `--marque-nom:"${echapCss(m.nom)}"`,
    `--marque-slogan:"${echapCss(m.slogan)}"`,
    `--marque-logo:${m.splashLogoUrl || m.logoUrl ? `url("${m.splashLogoUrl || m.logoUrl}")` : "none"}`,
  ];
  if (m.splashFond) vars.push(`--marque-splash-fond:${m.splashFond}`);
  const c = m.couleurPrimaire;
  if (c) {
    const fg = texteClair(c) ? "#ffffff" : "#111418";
    vars.push(
      `--primary:${c}`,
      `--primary-foreground:${fg}`,
      `--primary-trait:color-mix(in oklab,${c} 55%,transparent)`,
      `--ring:color-mix(in oklab,${c} 40%,transparent)`,
      `--sidebar-primary:${c}`,
      `--sidebar-primary-foreground:${fg}`,
      `--sidebar-ring:color-mix(in oklab,${c} 40%,transparent)`,
    );
    const s = m.couleurPrimaireSombre || `color-mix(in oklab,${c} 72%,#ffffff)`;
    regles.push(
      `:root:root.dark,:root:root .dark{--primary:${s};--primary-foreground:#111418;` +
        `--primary-trait:color-mix(in oklab,${s} 55%,transparent);` +
        `--ring:color-mix(in oklab,${s} 50%,transparent);--sidebar-primary:${s};` +
        `--sidebar-primary-foreground:#111418;--sidebar-ring:color-mix(in oklab,${s} 50%,transparent)}`,
    );
  }
  regles.unshift(`:root:root{${vars.join(";")}}`);

  if (!style) {
    style = d.createElement("style");
    style.id = ID_STYLE;
  }
  style.textContent = regles.join("");
  // Toujours en dernier : passe après la feuille principale.
  d.head.appendChild(style);
  racine.setAttribute("data-marque", "client");
}

/**
 * Script à placer en tête de `<head>` : applique la marque avant le
 * premier rendu. `graine` est celle que le serveur a trouvée pour
 * l'hôte ; elle prime sur le cache et l'amorce dès la première visite.
 */
export function scriptMarqueAvantRendu(graine: Marque | null = null): string {
  // `<` échappé : le JSON ne peut pas fermer la balise <script>.
  const g = graine && !graine.parDefaut ? JSON.stringify(graine).replace(/</g, "\\u003c") : "null";
  return `(function(){try{
var g=${g};window.__marqueRendu=g;
var h=location.hostname.toLowerCase().replace(/:\\d+$/,"").replace(/\\.$/,"").replace(/^www\\./,"");
if(h==="localhost"||h==="[::1]"||/\\.localhost$/.test(h)||/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(h)||/\\.netlify\\.(app|live)$/.test(h))return;
var k=${JSON.stringify(CLE_CACHE_MARQUE)};
var c=JSON.parse(localStorage.getItem(k)||"null");
if(c&&c.hote!==h)c=null;
if(g){c={hote:h,marque:g,t:c?c.t:0};try{localStorage.setItem(k,JSON.stringify(c))}catch(e){}}
if(!c||!c.marque)return;
(${appliquerMarqueAuDocument.toString()})(c.marque);
}catch(e){}})();`;
}
