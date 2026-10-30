import type { Database } from "./database.types";
import { conditionnementsVersBase, type Conditionnement } from "./conditionnements";

/**
 * Ce qui décrit un produit, par opposition à ce qui le compte.
 *
 * Types et fonctions pures seulement : le composant qui les affiche vit
 * à côté. Un module qui exporte les deux perd le rechargement à chaud,
 * et le serveur de développement reste ouvert pendant qu'on travaille.
 */

type Categorie = Database["public"]["Tables"]["categories"]["Row"];

/** Ce que le formulaire manipule, en chaînes de saisie. */
export interface ValeursDetails {
  sku: string;
  code_barres: string;
  category_id: string;
  supplier_id: string;
  description: string;
  unite: string;
  tva_rate: string;
  stock_max: string;
  type_produit: string;
  statut: string;
  /** Carton, sac, pack… : voir `lib/conditionnements.ts`. */
  conditionnements: Conditionnement[];
}

export const DETAILS_VIDES: ValeursDetails = {
  sku: "",
  code_barres: "",
  category_id: "",
  supplier_id: "",
  description: "",
  unite: "",
  tva_rate: "",
  stock_max: "",
  type_produit: "revendu",
  statut: "actif",
  conditionnements: [],
};

/** Ce que la base attend, une fois les chaînes vides ramenées à `null`. */
export const detailsVersBase = (v: ValeursDetails) => {
  const vide = (s: string) => (s.trim() === "" ? null : s.trim());
  const nombre = (s: string) => (s.trim() === "" ? null : Number(s));
  return {
    sku: vide(v.sku),
    code_barres: vide(v.code_barres),
    category_id: vide(v.category_id),
    supplier_id: vide(v.supplier_id),
    description: vide(v.description),
    unite: vide(v.unite),
    tva_rate: nombre(v.tva_rate),
    stock_max: nombre(v.stock_max),
    type_produit: v.type_produit,
    statut: v.statut,
    conditionnements: conditionnementsVersBase(v.conditionnements),
  };
};

export const TYPES_PRODUIT = [
  { valeur: "revendu", libelle: "Revendu", aide: "Acheté puis revendu tel quel." },
  { valeur: "service", libelle: "Service", aide: "Une prestation, sans stock." },
  { valeur: "fabrique", libelle: "Fabriqué", aide: "Produit sur commande." },
] as const;

/**
 * Les unités de base courantes, sans fermer la saisie.
 *
 * L'unité de base est celle dans laquelle le stock se compte : la plus
 * petite quantité que l'on vend. Ce qui en contient plusieurs — carton,
 * sac, pack — se déclare comme conditionnement, avec son nombre.
 */
export const UNITES = [
  "pièce",
  "kg",
  "g",
  "litre",
  "ml",
  "mètre",
  "m²",
  "boîte",
  "bouteille",
  "sachet",
  "paquet",
  "sac",
  "carton",
  "rouleau",
  "paire",
  "lot",
];

/** Les conditionnements que l'on propose d'un geste. */
export const CONDITIONNEMENTS_COURANTS = [
  "carton",
  "pack",
  "paquet",
  "sac",
  "boîte",
  "lot",
  "douzaine",
];

/**
 * Les catégories mises à plat pour une liste déroulante.
 *
 * Une sous-catégorie est nommée par son chemin complet — « Alimentaire
 * › Huiles » — plutôt qu'indentée. L'indentation dans un `<option>`
 * suppose des espaces insécables, que le navigateur seul rend
 * correctement et qui n'ont rien à faire dans du texte ; le chemin, lui,
 * se lit partout et lève l'ambiguïté entre deux sous-catégories
 * homonymes rangées sous des familles différentes.
 */
export const optionsCategories = (categories: Categorie[]): { id: string; libelle: string }[] => {
  const trier = (a: Categorie, b: Categorie) =>
    a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr");
  // La table porte toutes les listes : sans ce filtre, on proposerait
  // « Loyer » et « Grossiste » pour ranger un produit.
  const siennes = categories.filter((c) => (c.usage ?? "produit") === "produit");
  return siennes
    .filter((c) => !c.parent_id && c.actif)
    .sort(trier)
    .flatMap((racine) => [
      { id: racine.id, libelle: racine.nom },
      ...siennes
        .filter((c) => c.parent_id === racine.id && c.actif)
        .sort(trier)
        .map((c) => ({ id: c.id, libelle: `${racine.nom} › ${c.nom}` })),
    ]);
};

/** Le nom de chaque catégorie de produit — chemin compris —, par identifiant. */
export const nomsDesCategories = (categories: Categorie[]): Map<string, string> =>
  new Map(optionsCategories(categories).map((o) => [o.id, o.libelle]));

/**
 * Une catégorie et ses sous-catégories : choisir « Alimentaire » ramène
 * aussi ce qui est rangé sous « Alimentaire › Huiles ».
 */
export const categorieEtSesEnfants = (categories: Categorie[], id: string): Set<string> =>
  new Set([id, ...categories.filter((c) => c.parent_id === id).map((c) => c.id)]);
