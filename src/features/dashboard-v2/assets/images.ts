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

/** Les paysages du haut de page, qui défilent en fondu. */
export const HERO_PAYSAGES: Photo[] = [
  {
    id: "1501785888041-af3ef285b470",
    cadrage: "50% 60%",
  },
  {
    id: "1464822759023-fed622ff2c3b",
    cadrage: "50% 45%",
  },
  {
    id: "1470071459604-3b5ec3a7fe05",
    cadrage: "50% 55%",
  },
  {
    id: "1439066615861-d1af74d74000",
    cadrage: "50% 55%",
  },
  {
    id: "1506905925346-21bda4d32df4",
    cadrage: "50% 40%",
  },
];

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
