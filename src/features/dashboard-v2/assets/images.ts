/**
 * Les illustrations du tableau de bord, recadrées depuis les captures de
 * la maquette (`docs/maquette/dashboard-tantana.html`).
 */
import heroJour from "./hero-jour.jpg";
import heroNuit from "./hero-nuit.jpg";

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
 * LES PHOTOGRAPHIES DU TABLEAU DE BORD
 *
 * De vraies photos (Unsplash, licence libre), servies par leur CDN qui
 * les recadre et les compresse à la largeur demandée : rien ne pèse sur
 * le paquet de l'application. Leur adresse est stable — un identifiant
 * de photo, jamais une image « au hasard ».
 *
 * Si l'une ne charge pas (réseau coupé, CDN injoignable), l'illustration
 * locale posée dessous reste visible : le haut de page et les bannières
 * ne sont jamais vides.
 */
export interface Photo {
  /** L'identifiant Unsplash, sans le préfixe `photo-`. */
  id: string;
  /** Le point de cadrage, en `object-position`. */
  cadrage: string;
}

/** L'adresse d'une photo, à une largeur donnée. */
export const urlPhoto = (id: string, largeur: number, qualite = 70): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largeur}&q=${qualite}`;

/** Le `srcset` d'une photo : le navigateur prend la largeur qu'il lui faut. */
export const srcsetPhoto = (id: string, largeurs: number[]): string =>
  largeurs.map((l) => `${urlPhoto(id, l)} ${l}w`).join(", ");

/**
 * LA NATURE DU HAUT DE PAGE, DE JOUR ET DE NUIT
 *
 * Deux séries de vraies photos, chacune prise à son heure :
 *  - le jour : vallées tropicales, forêt dense, lémuriens, cascade —
 *    la nature telle qu'on la vit à Madagascar ;
 *  - le soir : de vraies photos de crépuscule et de nuit — l'allée des
 *    baobabs au coucher du soleil, pirogue sur la mer dorée, palmiers à
 *    contre-jour, voie lactée au-dessus de la forêt. Jamais une photo de
 *    jour assombrie.
 *
 * Chaque jour, la bannière en prend cinq dans la série du moment, en
 * décalant le point de départ : la combinaison change d'un jour à
 * l'autre.
 */
export const HERO_PAYSAGES_JOUR: Photo[] = [
  { id: "1541637593725-923467404d17", cadrage: "50% 55%" },
  { id: "1562550745-f54f73011c70", cadrage: "50% 42%" },
  { id: "1681196488666-096a2d8f3b25", cadrage: "50% 60%" },
  { id: "1693357483341-204143afdeb7", cadrage: "50% 55%" },
  { id: "1599998372764-ac8cbb604f21", cadrage: "50% 50%" },
  { id: "1546146020-f11a39e6c061", cadrage: "50% 30%" },
  { id: "1433086966358-54859d0ed716", cadrage: "50% 50%" },
  { id: "1699622595987-9974344baed5", cadrage: "50% 60%" },
];

export const HERO_PAYSAGES_SOIR: Photo[] = [
  { id: "1677667495307-10e01bd9530f", cadrage: "50% 35%" },
  { id: "1585335740623-f7a1f0c446eb", cadrage: "50% 60%" },
  { id: "1659944984855-776187144baf", cadrage: "50% 50%" },
  { id: "1602174423520-daa2d87175a0", cadrage: "50% 55%" },
  { id: "1444080748397-f442aa95c3e5", cadrage: "50% 40%" },
  { id: "1483168527879-c66136b56105", cadrage: "50% 50%" },
  { id: "1579426922688-8b4607285cd2", cadrage: "50% 55%" },
  { id: "1695236267549-0732e078655f", cadrage: "50% 50%" },
  { id: "1601606046870-12a2c4543555", cadrage: "50% 60%" },
  { id: "1513165533842-2a0dd8b51a74", cadrage: "50% 45%" },
];

/** Le soir, pour les photos : de 18 h à 6 h, tant qu'il fait nuit dehors. */
export const estLaNuitDehors = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 6;

/**
 * Les cinq photos du moment : la série du jour ou celle du soir, à partir
 * d'un point de départ qui avance de trois chaque jour.
 */
export function paysagesDuMoment(d: Date, combien = 5): Photo[] {
  const serie = estLaNuitDehors(d) ? HERO_PAYSAGES_SOIR : HERO_PAYSAGES_JOUR;
  // Avant 6 h, c'est encore la nuit de la veille : mêmes photos.
  const ref = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() < 6 ? 1 : 0));
  const jour = Math.floor(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()) / 86_400_000);
  const depart = (jour * 3) % serie.length;
  return Array.from(
    { length: Math.min(combien, serie.length) },
    (_, k) => serie[(depart + k) % serie.length],
  );
}

/** Une photo par grande section, chacune en rapport avec son sujet. */
export const PHOTOS_SECTIONS = {
  operations: {
    id: "1501854140801-50d01698950b",
    cadrage: "50% 60%",
  },
  ventes: {
    id: "1556741533-6e6a62bd8b49",
    cadrage: "50% 50%",
  },
  argent: {
    id: "1579621970563-ebec7560ff3e",
    cadrage: "50% 75%",
  },
  stock: {
    id: "1553413077-190dd305871c",
    cadrage: "50% 55%",
  },
  fournisseurs: {
    id: "1494412574643-ff11b0a5c1c3",
    cadrage: "50% 50%",
  },
} satisfies Record<string, Photo>;

/**
 * « Inspiration du moment » : toutes les photos du dossier `plantes/`,
 * dans l'ordre de leur nom. Il suffit d'y déposer une photo (JPG, PNG ou
 * WebP) pour qu'elle entre dans la rotation, sans rien toucher d'autre.
 */
const fichiersPlantes = import.meta.glob("./plantes/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;
export const PHOTOS_PLANTES: string[] = Object.keys(fichiersPlantes)
  .sort()
  .map((k) => fichiersPlantes[k]);

/**
 * Les trois photos du jour : chaque jour prend les trois suivantes du
 * dossier, et la série recommence une fois le dossier parcouru. Avec
 * vingt et une photos, aucun trio ne revient avant trois semaines.
 */
export function plantesDuJour(d: Date, photos: string[] = PHOTOS_PLANTES): string[] {
  if (photos.length === 0) return [];
  const jour = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  const depart = (jour * 3) % photos.length;
  return [0, 1, 2].map((k) => photos[(depart + k) % photos.length]);
}

/** Lundi = 0 … dimanche = 6, l'index de `HERO_PHOTOS`. */
export const indexDuJour = (d: Date): number => (d.getDay() + 6) % 7;
