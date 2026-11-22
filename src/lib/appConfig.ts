export const APP_NAME = "Tantana Suite";
export const APP_TAGLINE = "Toute votre entreprise, dans un seul logiciel.";
// Sous l'icône d'une application installée, le système tronque au-delà
// d'une douzaine de caractères : « Tantana » seul y tient sans coupure.
export const APP_SHORT_NAME = "Tantana";

/**
 * Référencement de Tantana Suite : son adresse officielle (canonical,
 * sitemap, données structurées) et le titre que Google affiche. Les
 * marques clientes ont les leurs, tirés de leur fiche (`lib/seo.ts`).
 */
export const APP_URL = "https://tantana-suite.com";
//
// Les mots que l'on tape dans Google viennent en tête : le nom, puis
// « logiciel de gestion de stock », « caisse », « Madagascar ». Au-delà
// d'une soixantaine de signes, Google coupe : l'essentiel est avant.
export const APP_TITRE_SEO = `${APP_NAME} — Logiciel de gestion de stock et de caisse à Madagascar`;

/**
 * Accroche posée dans le titre principal (`<h1>`) de la vitrine : le nom
 * du logiciel et ce qu'il fait, que Google lit comme le sujet de la page.
 */
export const APP_ACCROCHE_SEO = `${APP_NAME} · Stock, caisse et facturation`;

/**
 * Numéro par lequel joindre l'administrateur.
 *
 * Affiché à qui a oublié son mot de passe : tant qu'aucun domaine n'est
 * vérifié, le service d'envoi n'écrit qu'à une seule adresse, et la
 * réinitialisation passe donc par une personne.
 */
export const APP_SUPPORT_PHONE = "+261 38 97 234 12";
