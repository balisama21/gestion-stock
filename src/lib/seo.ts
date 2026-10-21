import { APP_SUPPORT_PHONE, APP_URL } from "./appConfig";
import { urlImage } from "./landingMarque";
import { DOMAINES_PAR_DEFAUT, estHoteParDefaut, normaliserHote, type Marque } from "./marque";
import { ESSAI_JOURS, PRIX_MENSUEL } from "./offres";

/**
 * Référencement naturel, domaine par domaine.
 *
 * Chaque domaine se présente à Google sous sa propre identité : sur
 * mg-kinvest.com, titre, description, adresse canonique, image de
 * partage et données structurées sont ceux de la marque cliente ; sur
 * tantana-suite.com, ceux du logiciel. Jamais l'un chez l'autre.
 *
 * Tout part de la marque déjà résolue pour l'hôte (`server.ts` côté
 * serveur, le cache côté client) : aucune requête de plus.
 */

/** Description de Tantana dans les résultats de recherche (~160 signes utiles). */
export const DESCRIPTION_PAR_DEFAUT =
  "Logiciel de gestion tout-en-un pour commerces et PME : stock, ventes, clients, " +
  `facturation, trésorerie et équipe, sur ordinateur et sur mobile. Essai gratuit de ${ESSAI_JOURS} jours.`;

/** Chemins publics, ceux que liste le sitemap. Le reste est privé (`noindex`). */
export const PAGES_PUBLIQUES = ["/"];

/** Pour les pages privées : lien d'invitation, nouveau mot de passe. */
export const ROBOTS_PRIVE = "noindex, nofollow";

const estCliente = (m: Marque | null): m is Marque => !!m && !m.parDefaut;

/**
 * Ce que Google peut indexer : les domaines de Tantana, et ceux d'une
 * marque cliente connue. Jamais localhost, les aperçus `*.netlify.app`
 * (copies du site), ni un domaine dont la marque n'a pu être lue — il
 * s'afficherait aux couleurs de Tantana.
 */
export function hoteIndexable(hote: string, marque: Marque | null): boolean {
  const h = normaliserHote(hote);
  return estCliente(marque) ? !estHoteParDefaut(h) : DOMAINES_PAR_DEFAUT.includes(h);
}

/**
 * Adresse officielle du site, sans `/` final. Marque cliente : son
 * domaine, sans `www.` (c'est sous cette forme qu'il est déclaré dans
 * `custom_domains`). Sinon, toujours tantana-suite.com : un aperçu
 * Netlify renvoie ainsi Google vers le vrai site.
 */
export function origineDe(hote: string, marque: Marque | null): string {
  return estCliente(marque) && !estHoteParDefaut(hote)
    ? `https://${normaliserHote(hote)}`
    : APP_URL;
}

const absolue = (url: string, origine: string): string =>
  url.startsWith("/") ? origine + url : url;

/** Ce que Google affiche sous le titre. */
export function descriptionDe(m: Marque): string {
  if (m.parDefaut) return DESCRIPTION_PAR_DEFAUT;
  return m.landing?.sousTitre || m.slogan || m.landing?.titre || m.nom;
}

export interface ImagePartage {
  url: string;
  alt: string;
  /** Vrai : une photo, montrée en grand dans l'aperçu ; faux : un logo carré. */
  grande: boolean;
}

/** Image des aperçus (WhatsApp, Facebook, X…) et des données structurées. */
export function imageDePartage(m: Marque, origine: string): ImagePartage | null {
  if (m.parDefaut) return { url: `${APP_URL}/icon-512.png`, alt: m.nom, grande: false };
  const photo = m.landing?.photo;
  if (photo) {
    const url = urlImage(photo, 1200);
    // Unsplash recadre au format des aperçus (1,91:1).
    return {
      url: url.includes("images.unsplash.com") ? `${url}&h=630` : absolue(url, origine),
      alt: m.landing?.titre || m.nom,
      grande: true,
    };
  }
  return m.logoUrl ? { url: absolue(m.logoUrl, origine), alt: m.nom, grande: false } : null;
}

type Meta = { name: string; content: string } | { property: string; content: string };

/**
 * Métas communes à toutes les pages : description, consigne aux robots
 * et aperçus de partage. Le titre et l'adresse canonique sont posés à
 * part (`titreDePage`, `lienCanonique`).
 */
export function metasDeReferencement(m: Marque, hote: string, titre: string): Meta[] {
  const origine = origineDe(hote, m);
  const description = descriptionDe(m);
  const image = imageDePartage(m, origine);
  return [
    { name: "description", content: description },
    {
      name: "robots",
      content: hoteIndexable(hote, m)
        ? "index, follow, max-image-preview:large, max-snippet:-1"
        : ROBOTS_PRIVE,
    },
    { name: "author", content: m.nom },
    { property: "og:site_name", content: m.nom },
    { property: "og:locale", content: "fr_FR" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: titre },
    { property: "og:description", content: description },
    ...(image
      ? [
          { property: "og:image", content: image.url },
          { property: "og:image:alt", content: image.alt },
          { name: "twitter:image", content: image.url },
        ]
      : []),
    { name: "twitter:card", content: image?.grande ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: titre },
    { name: "twitter:description", content: description },
  ];
}

/** Adresse canonique d'une page publique, sur le domaine de sa marque. */
export const lienCanonique = (m: Marque, hote: string, chemin = "/"): string =>
  origineDe(hote, m) + chemin;

/**
 * Données structurées (JSON-LD) de la page d'accueil.
 *
 * Tantana : l'éditeur, le site et le logiciel (`SoftwareApplication`).
 * Marque cliente avec sa page d'accueil : un commerce (`LocalBusiness`)
 * avec ses coordonnées et son catalogue ; sans page : une organisation.
 */
export function donneesStructurees(m: Marque, hote: string): Record<string, unknown> {
  const origine = origineDe(hote, m);
  const idOrganisation = `${origine}/#organisation`;
  const description = descriptionDe(m);
  const image = imageDePartage(m, origine);
  const logo = m.parDefaut
    ? `${APP_URL}/icon-512.png`
    : m.logoUrl
      ? absolue(m.logoUrl, origine)
      : undefined;
  const site = {
    "@type": "WebSite",
    "@id": `${origine}/#site`,
    url: `${origine}/`,
    name: m.nom,
    description,
    inLanguage: "fr",
    publisher: { "@id": idOrganisation },
  };

  if (m.parDefaut) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": idOrganisation,
          name: m.nom,
          url: `${origine}/`,
          logo,
          contactPoint: {
            "@type": "ContactPoint",
            telephone: APP_SUPPORT_PHONE,
            contactType: "customer support",
            availableLanguage: "French",
          },
        },
        site,
        {
          "@type": "SoftwareApplication",
          name: m.nom,
          url: `${origine}/`,
          description,
          image: logo,
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "Gestion de stock et de ventes",
          operatingSystem: "Web, Android, iOS, Windows, macOS",
          inLanguage: "fr",
          offers: {
            "@type": "Offer",
            price: PRIX_MENSUEL,
            priceCurrency: "MGA",
            description: `Abonnement mensuel, après ${ESSAI_JOURS} jours d'essai gratuit.`,
          },
          publisher: { "@id": idOrganisation },
        },
      ],
    };
  }

  const contact = m.landing?.contact ?? null;
  const catalogue = m.landing?.catalogue ?? null;
  const telephones = contact?.telephones ?? [];
  const emails = contact?.emails ?? [];
  const organisation: Record<string, unknown> = {
    "@type": m.landing ? "LocalBusiness" : "Organization",
    "@id": idOrganisation,
    name: m.nom,
    url: `${origine}/`,
    description,
    ...(logo ? { logo } : null),
    ...(image ? { image: image.url } : null),
    ...(telephones[0] ? { telephone: telephones[0] } : null),
    ...(emails[0] ? { email: emails[0] } : null),
    ...(contact?.adresse ? { address: contact.adresse } : null),
    ...(telephones.length > 1 || contact?.whatsapp
      ? {
          contactPoint: [
            ...telephones.map((telephone) => ({
              "@type": "ContactPoint",
              telephone,
              contactType: "customer service",
              availableLanguage: "French",
            })),
            ...(contact?.whatsapp
              ? [
                  {
                    "@type": "ContactPoint",
                    telephone: contact.whatsapp,
                    contactType: "customer service",
                    contactOption: "WhatsApp",
                  },
                ]
              : []),
          ],
        }
      : null),
    ...(catalogue
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: catalogue.titre || m.nom,
            itemListElement: catalogue.elements.map((e) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Product",
                name: e.titre,
                ...(e.texte ? { description: e.texte } : null),
                ...(e.image ? { image: absolue(urlImage(e.image, 800), origine) } : null),
              },
            })),
          },
        }
      : null),
  };
  return { "@context": "https://schema.org", "@graph": [organisation, site] };
}

/**
 * `robots.txt` du domaine visité. Un domaine indexable annonce son
 * propre sitemap ; les autres (aperçus Netlify, marque illisible)
 * ferment tout, pour ne jamais concurrencer le vrai site.
 */
export function robotsTxt(hote: string, marque: Marque | null): string {
  if (!hoteIndexable(hote, marque)) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\n\nSitemap: ${origineDe(hote, marque)}/sitemap.xml\n`;
}

/** `sitemap.xml` du domaine visité ; `null` : rien à indexer ici. */
export function sitemapXml(hote: string, marque: Marque | null): string | null {
  if (!hoteIndexable(hote, marque)) return null;
  const origine = origineDe(hote, marque);
  const urls = PAGES_PUBLIQUES.map((chemin) => `  <url><loc>${origine}${chemin}</loc></url>`);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

/**
 * Robots d'indexation et d'aperçu : à eux, une marque illisible vaut une
 * erreur passagère (503), jamais une page aux couleurs de Tantana.
 */
export const estRobot = (userAgent: string | null): boolean =>
  !!userAgent &&
  /bot\b|bot\/|crawler|spider|slurp|facebookexternalhit|whatsapp|embedly|preview/i.test(userAgent);
