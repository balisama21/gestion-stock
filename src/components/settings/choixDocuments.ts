import type { ChoixLogo, ModeleDocument } from "../../features/documents/lib/reglages";

/**
 * Les choix que les écrans de réglage proposent.
 *
 * Ils vivent à part parce que deux écrans les affichent désormais :
 * les réglages de la boutique, et ceux d'un type de document qui s'en
 * écarte. Une seule liste, donc une seule couleur à ajouter le jour
 * où il en faut une de plus.
 */

export const MODELES_DOCUMENT: { cle: ModeleDocument; nom: string; note: string }[] = [
  { cle: "classique", nom: "Classique", note: "Le plus attendu" },
  { cle: "bandeau", nom: "Bandeau", note: "Marqué, coloré" },
  { cle: "epure", nom: "Épuré", note: "Sobre, à empattements" },
  { cle: "compact", nom: "Compact", note: "Beaucoup d'articles" },
];

export const COULEURS_DOCUMENT: { valeur: string; nom: string }[] = [
  { valeur: "#0E7C5A", nom: "Vert" },
  { valeur: "#1F4E79", nom: "Bleu nuit" },
  { valeur: "#3A72A6", nom: "Bleu clair" },
  { valeur: "#7A4B2A", nom: "Brun" },
  { valeur: "#8E2F3C", nom: "Bordeaux" },
  { valeur: "#2B3038", nom: "Ardoise" },
];

export const LOGOS_DOCUMENT: { cle: ChoixLogo; nom: string }[] = [
  { cle: "auto", nom: "Logo, ou initiales à défaut" },
  { cle: "initiales", nom: "Initiales seulement" },
  { cle: "aucun", nom: "Rien du tout" },
];
