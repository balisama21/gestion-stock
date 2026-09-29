/**
 * Les illustrations du tableau de bord, recadrées depuis les captures de
 * la maquette (`docs/maquette/dashboard-tantana.html`).
 */
import heroJour from "./hero-jour.jpg";
import heroNuit from "./hero-nuit.jpg";
import plante1 from "./plante-1.jpg";
import plante2 from "./plante-2.jpg";
import plante3 from "./plante-3.jpg";

export { default as inspirationFond } from "./inspiration-fond.jpg";
export { default as kpiVentes } from "./kpi-ventes.png";
export { default as kpiEntrees } from "./kpi-entrees.png";
export { default as kpiSorties } from "./kpi-sorties.png";
export { default as kpiStock } from "./kpi-stock.png";
export { default as kpiActivite } from "./kpi-activite.png";
export { default as tendanceVerte } from "./tendance-verte.png";
export { default as tendanceBleue } from "./tendance-bleue.png";
export { default as alerteOrange } from "./alerte-orange.png";
export { default as pressePapiers } from "./presse-papiers.png";
export { default as calendrierMini } from "./calendrier-mini.png";
export { default as apercuVentes } from "./apercu-ventes.png";
export { default as feuille } from "./feuille.png";

export { default as banniereOperations } from "./banniere-operations.webp";
export { default as banniereVentes } from "./banniere-ventes.webp";
export { default as banniereArgent } from "./banniere-argent.webp";
export { default as banniereStock } from "./banniere-stock.webp";
export { default as banniereFournisseurs } from "./banniere-fournisseurs.webp";

export { default as illCalendrier } from "./ill-calendrier.png";
export { default as illFeuille } from "./ill-feuille.png";
export { default as illCarton } from "./ill-carton.png";
export { default as illCamion } from "./ill-camion.png";
export { default as illClients } from "./ill-clients.png";
export { default as illTrophee } from "./ill-trophee.png";
export { default as illCroissance } from "./ill-croissance.png";
export { default as illFeuillesGauche } from "./ill-feuilles-gauche.png";
export { default as illPortefeuille } from "./ill-portefeuille.png";
export { default as illRupture } from "./ill-rupture.png";
export { default as illVideStock } from "./ill-vide-stock.png";
export { default as illVideArgent } from "./ill-vide-argent.png";

export { default as sparkEntrees } from "./spark-entrees.png";
export { default as sparkSorties } from "./spark-sorties.png";
export { default as sparkSolde } from "./spark-solde.png";
export { default as sparkCalendrier } from "./spark-calendrier.png";

export { default as leadValeurStock } from "./lead-valeur-stock.png";
export { default as leadRecommander } from "./lead-recommander.png";
export { default as leadRuptures } from "./lead-ruptures.png";
export { default as leadEtatStock } from "./lead-etat-stock.png";
export { default as leadEntreesSorties } from "./lead-entrees-sorties.png";
export { default as leadMouvements } from "./lead-mouvements.png";
export { default as leadTresorerie } from "./lead-tresorerie.png";
export { default as leadFournisseurs } from "./lead-fournisseurs.png";
export { default as leadPrestataires } from "./lead-prestataires.png";
export { default as leadCommandes } from "./lead-commandes.png";
export { default as leadPaiements } from "./lead-paiements.png";
export { default as leadFournisseursCarte } from "./lead-fournisseurs-carte.png";
export { default as leadPrestatairesCarte } from "./lead-prestataires-carte.png";

export { default as actCommande } from "./act-commande.png";
export { default as actPrestataire } from "./act-prestataire.png";
export { default as actPaiement } from "./act-paiement.png";
export { default as actAttente } from "./act-attente.png";

/**
 * Photo de fond du hero : une catégorie par jour (lundi = 0 … dimanche = 6),
 * chacune avec sa version jour et sa version nuit. Un seul jeu de photos
 * existe pour l'instant : les sept entrées le réutilisent en attendant.
 */
export const HERO_PHOTOS: { jour: string; nuit: string }[] = [
  { jour: heroJour, nuit: heroNuit }, // LUNDI    - catégorie 1
  { jour: heroJour, nuit: heroNuit }, // MARDI    - catégorie 2 (à remplacer)
  { jour: heroJour, nuit: heroNuit }, // MERCREDI - catégorie 3 (à remplacer)
  { jour: heroJour, nuit: heroNuit }, // JEUDI    - catégorie 4 (à remplacer)
  { jour: heroJour, nuit: heroNuit }, // VENDREDI - catégorie 5 (à remplacer)
  { jour: heroJour, nuit: heroNuit }, // SAMEDI   - catégorie 6 (à remplacer)
  { jour: heroJour, nuit: heroNuit }, // DIMANCHE - catégorie 7 (à remplacer)
];

/**
 * « Inspiration du moment » : trois photos par catégorie, une catégorie par
 * jour (lundi = 0 … dimanche = 6). Même principe que `HERO_PHOTOS`.
 */
export const PLANTES: [string, string, string][] = [
  [plante1, plante2, plante3], // LUNDI    - catégorie 1
  [plante1, plante2, plante3], // MARDI    - catégorie 2 (à remplacer)
  [plante1, plante2, plante3], // MERCREDI - catégorie 3 (à remplacer)
  [plante1, plante2, plante3], // JEUDI    - catégorie 4 (à remplacer)
  [plante1, plante2, plante3], // VENDREDI - catégorie 5 (à remplacer)
  [plante1, plante2, plante3], // SAMEDI   - catégorie 6 (à remplacer)
  [plante1, plante2, plante3], // DIMANCHE - catégorie 7 (à remplacer)
];

/** Lundi = 0 … dimanche = 6, l'index des deux tableaux ci-dessus. */
export const indexDuJour = (d: Date): number => (d.getDay() + 6) % 7;
