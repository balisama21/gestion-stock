import type { Database } from "./database.types";

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
  };
};

export const TYPES_PRODUIT = [
  { valeur: "revendu", libelle: "Revendu", aide: "Acheté puis revendu tel quel." },
  { valeur: "service", libelle: "Service", aide: "Une prestation, sans stock." },
  { valeur: "fabrique", libelle: "Fabriqué", aide: "Produit sur commande." },
] as const;

/** Quelques unités courantes, sans fermer la saisie. */
export const UNITES = ["pièce", "kg", "g", "litre", "ml", "mètre", "carton", "sac", "paquet"];

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
  return categories
    .filter((c) => !c.parent_id && c.actif)
    .sort(trier)
    .flatMap((racine) => [
      { id: racine.id, libelle: racine.nom },
      ...categories
        .filter((c) => c.parent_id === racine.id && c.actif)
        .sort(trier)
        .map((c) => ({ id: c.id, libelle: `${racine.nom} › ${c.nom}` })),
    ]);
};
