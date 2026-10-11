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
  /**
   * L'identifiant Unsplash, sans le préfixe `photo-` — ou, pour une photo
   * importée dans les paramètres, son identifiant en base.
   */
  id: string;
  /** Le point de cadrage, en `object-position`. */
  cadrage: string;
  /** Une photo importée : son adresse directe, déjà à la bonne taille. */
  url?: string;
}

/** L'adresse d'une photo, à une largeur donnée. */
export const urlPhoto = (id: string, largeur: number, qualite = 70): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${largeur}&q=${qualite}`;

/** L'adresse à afficher, qu'il s'agisse d'une photo livrée ou importée. */
export const sourcePhoto = (p: Photo, largeur: number): string => p.url ?? urlPhoto(p.id, largeur);

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
 * TRENTE ET UNE PHOTOS PAR SÉRIE, un mois entier : chaque jour, la
 * bannière en montre cinq, et la série avance de cinq le lendemain. La
 * photo de tête change donc tous les jours pendant trente et un jours,
 * deux jours qui se suivent ne partagent aucune photo, puis la boucle
 * recommence. L'ordre est mélangé une fois pour toutes, pour que chaque
 * jour mêle paysages, animaux, cascades et fleurs.
 *
 * Les photos importées par le créateur de la plateforme (Paramètres →
 * Photos du haut de page) prennent la suite de celles-ci dans la boucle.
 */
export const HERO_PAYSAGES_JOUR: Photo[] = [
  { id: "1541637593725-923467404d17", cadrage: "50% 55%" },
  { id: "1699622595987-9974344baed5", cadrage: "50% 60%" },
  { id: "1521706862577-47b053587f91", cadrage: "50% 50%" },
  { id: "1464419014442-769c523d575b", cadrage: "50% 50%" },
  { id: "1549615567-101937a79124", cadrage: "50% 50%" },
  { id: "1599998372764-ac8cbb604f21", cadrage: "50% 50%" },
  { id: "1732003060139-d75ee1883cb9", cadrage: "50% 50%" },
  { id: "1500622944204-b135684e99fd", cadrage: "50% 50%" },
  { id: "1595224162232-4dee7b8fd18b", cadrage: "50% 50%" },
  { id: "1562550745-f54f73011c70", cadrage: "50% 42%" },
  { id: "1598563352765-85f7971070a7", cadrage: "50% 50%" },
  { id: "1759827767985-b14b62b04d43", cadrage: "50% 50%" },
  { id: "1513137389744-267d0b623771", cadrage: "50% 50%" },
  { id: "1593285942976-70dbd769a590", cadrage: "50% 50%" },
  { id: "1546146020-f11a39e6c061", cadrage: "50% 30%" },
  { id: "1750615745167-09d610d30d54", cadrage: "50% 50%" },
  { id: "1610805177214-885738d255f1", cadrage: "50% 50%" },
  { id: "1569622296640-38737c1d82de", cadrage: "50% 50%" },
  { id: "1681196488666-096a2d8f3b25", cadrage: "50% 60%" },
  { id: "1627900355526-f77d70cc6887", cadrage: "50% 50%" },
  { id: "1530215078880-605aa750b7bb", cadrage: "50% 50%" },
  { id: "1681738623292-3a755d6c8611", cadrage: "50% 50%" },
  { id: "1552302781-db5b474f4b93", cadrage: "50% 50%" },
  { id: "1433086966358-54859d0ed716", cadrage: "50% 50%" },
  { id: "1560851691-ebb64b584d3d", cadrage: "50% 50%" },
  { id: "1444290679983-dd3aabf671ec", cadrage: "50% 50%" },
  { id: "1542536686-cdc0f32ae997", cadrage: "50% 50%" },
  { id: "1693357483341-204143afdeb7", cadrage: "50% 55%" },
  { id: "1732003195816-8e76bfc6f4a6", cadrage: "50% 50%" },
  { id: "1553602932-f93f674a9aaa", cadrage: "50% 50%" },
  { id: "1623385521200-ac42d87723d3", cadrage: "50% 50%" },
];

export const HERO_PAYSAGES_SOIR: Photo[] = [
  { id: "1677667495307-10e01bd9530f", cadrage: "50% 35%" },
  { id: "1695236267549-0732e078655f", cadrage: "50% 50%" },
  { id: "1597711002271-db32de5ff02b", cadrage: "50% 50%" },
  { id: "1781428269398-0c044f7060c5", cadrage: "50% 50%" },
  { id: "1633116910392-54218a9ef732", cadrage: "50% 50%" },
  { id: "1444080748397-f442aa95c3e5", cadrage: "50% 40%" },
  { id: "1571043281665-9debfed10719", cadrage: "50% 50%" },
  { id: "1597426061335-e50c8697630b", cadrage: "50% 50%" },
  { id: "1680708610902-76440fac1105", cadrage: "50% 50%" },
  { id: "1585335740623-f7a1f0c446eb", cadrage: "50% 60%" },
  { id: "1601606046870-12a2c4543555", cadrage: "50% 60%" },
  { id: "1637231775524-2ce65aaadcc0", cadrage: "50% 50%" },
  { id: "1781429235783-65a985cbd0f0", cadrage: "50% 50%" },
  { id: "1510564742958-fb9337aa669e", cadrage: "50% 50%" },
  { id: "1483168527879-c66136b56105", cadrage: "50% 50%" },
  { id: "1672841828482-45faa4c70e50", cadrage: "50% 50%" },
  { id: "1593704273477-8a0280c1c237", cadrage: "50% 50%" },
  { id: "1604617329741-e7540714dc59", cadrage: "50% 50%" },
  { id: "1659944984855-776187144baf", cadrage: "50% 50%" },
  { id: "1513165533842-2a0dd8b51a74", cadrage: "50% 45%" },
  { id: "1591862264319-f00c75a0af32", cadrage: "50% 50%" },
  { id: "1501164071995-0929702fd3ba", cadrage: "50% 50%" },
  { id: "1624645384435-5d9fab1a3a23", cadrage: "50% 50%" },
  { id: "1579426922688-8b4607285cd2", cadrage: "50% 55%" },
  { id: "1605207693166-394b929e8a1a", cadrage: "50% 50%" },
  { id: "1704684150861-8f7a89335e64", cadrage: "50% 50%" },
  { id: "1589790272257-8c0f79c221da", cadrage: "50% 50%" },
  { id: "1602174423520-daa2d87175a0", cadrage: "50% 55%" },
  { id: "1460627390041-532a28402358", cadrage: "50% 50%" },
  { id: "1506404523803-9f9fa45e066e", cadrage: "50% 50%" },
  { id: "1704589946424-b64cef22a5e2", cadrage: "50% 50%" },
];

/** Le soir, pour les photos : de 18 h à 6 h, tant qu'il fait nuit dehors. */
export const estLaNuitDehors = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 6;

/** Le premier jour de la boucle des photos, comme celui des phrases. */
const DEBUT_PAYSAGES = Date.UTC(2026, 9, 11);

/** De combien la série avance chaque jour : autant que de photos montrées. */
const PAS_PAYSAGES = 5;

/**
 * Les cinq photos du moment : la série du jour ou celle du soir (photos
 * livrées, puis photos importées), à partir du rang du jour dans la boucle.
 */
export function paysagesDuMoment(
  d: Date,
  ajoutees: { jour: Photo[]; soir: Photo[] } = { jour: [], soir: [] },
  combien = PAS_PAYSAGES,
): Photo[] {
  const nuit = estLaNuitDehors(d);
  const serie = nuit
    ? [...HERO_PAYSAGES_SOIR, ...ajoutees.soir]
    : [...HERO_PAYSAGES_JOUR, ...ajoutees.jour];
  // Avant 6 h, c'est encore la nuit de la veille : mêmes photos.
  const ref = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - (d.getHours() < 6 ? 1 : 0));
  const rang = Math.round((ref - DEBUT_PAYSAGES) / 86_400_000);
  const n = serie.length;
  const depart = (((rang * PAS_PAYSAGES) % n) + n) % n;
  return Array.from({ length: Math.min(combien, n) }, (_, k) => serie[(depart + k) % n]);
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
