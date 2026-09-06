import type { Database } from "./database.types";

/**
 * Les champs qu'une entreprise ajoute elle-même à ses fiches.
 *
 * Ce fichier ne contient que des types et des fonctions pures : les
 * composants qui les affichent vivent à côté. La séparation n'est pas
 * cosmétique — un module qui exporte à la fois des composants et des
 * fonctions perd le rechargement à chaud, et le serveur de
 * développement reste ouvert pendant qu'on travaille.
 */

export type ChampPerso = Database["public"]["Tables"]["custom_field_definitions"]["Row"];
export type EntiteChamp = "client" | "produit" | "fournisseur" | "prestataire";

/** Les valeurs telles qu'elles vivent dans la colonne `champs_perso`. */
export type ValeursPerso = Record<string, string | number | boolean | null>;

export const ENTITES_CHAMPS: { valeur: EntiteChamp; libelle: string }[] = [
  { valeur: "client", libelle: "Clients" },
  { valeur: "produit", libelle: "Produits" },
  { valeur: "fournisseur", libelle: "Fournisseurs" },
  { valeur: "prestataire", libelle: "Prestataires" },
];

export const TYPES_CHAMPS: { valeur: string; libelle: string }[] = [
  { valeur: "texte", libelle: "Texte" },
  { valeur: "texte_long", libelle: "Texte long" },
  { valeur: "nombre", libelle: "Nombre" },
  { valeur: "date", libelle: "Date" },
  { valeur: "booleen", libelle: "Oui / Non" },
  { valeur: "liste", libelle: "Liste de choix" },
];

export const libelleTypeChamp = (v: string): string =>
  TYPES_CHAMPS.find((t) => t.valeur === v)?.libelle ?? v;

/** Ce que la colonne JSON contient, ramené à une forme sûre. */
export const lireValeurs = (brut: unknown): ValeursPerso => {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  return brut as ValeursPerso;
};

/** Les définitions actives d'une entité, dans leur ordre d'affichage. */
export const champsDe = (definitions: ChampPerso[], entite: EntiteChamp): ChampPerso[] =>
  definitions
    .filter((c) => c.entite === entite && c.actif)
    .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, "fr"));

/**
 * Le premier champ obligatoire resté vide, ou `null` si tout est rempli.
 *
 * La base ne valide pas ce contenu — c'est le prix du stockage en JSON,
 * assumé dans la migration. La vérification se fait donc ici, à la
 * saisie, et doit être appelée par chaque formulaire.
 */
export const champObligatoireManquant = (
  definitions: ChampPerso[],
  entite: EntiteChamp,
  valeurs: ValeursPerso,
): ChampPerso | null =>
  champsDe(definitions, entite).find((c) => {
    if (!c.obligatoire) return false;
    // Faux est une réponse, pas une absence de réponse.
    if (c.type === "booleen") return false;
    const v = valeurs[c.cle];
    return v === undefined || v === null || String(v).trim() === "";
  }) ?? null;

/** Une valeur, telle qu'on la lit dans une fiche. */
export const valeurEnClair = (champ: ChampPerso, valeur: ValeursPerso[string]): string | null => {
  if (valeur === undefined || valeur === null || valeur === "") return null;
  if (champ.type === "booleen") return valeur ? "Oui" : "Non";
  if (champ.type === "date") {
    const d = new Date(String(valeur));
    return Number.isNaN(d.getTime()) ? String(valeur) : d.toLocaleDateString("fr-FR");
  }
  if (champ.type === "nombre") return new Intl.NumberFormat("fr-FR").format(Number(valeur));
  return String(valeur);
};

/**
 * Fabrique la clé technique à partir du libellé.
 *
 * Elle doit satisfaire la contrainte de la base — une minuscule, puis
 * des minuscules, chiffres ou tirets bas — et elle est figée une fois le
 * champ créé : renommer « Code douane » en « Code tarifaire » ne doit pas
 * égarer les valeurs déjà saisies.
 */
export const cleDepuisLibelle = (libelle: string): string => {
  // La plage retirée est celle des marques diacritiques combinantes,
  // U+0300 à U+036F : après normalisation NFD, « é » devient « e » suivi
  // d'un accent séparé, et c'est cet accent que l'on jette.
  const sansAccent = libelle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nettoye = sansAccent
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 39);
  // La contrainte impose une lettre en tête : « 2e adresse » donnerait
  // sinon une clé refusée par la base.
  return /^[a-z]/.test(nettoye) ? nettoye : `c_${nettoye}`.slice(0, 39);
};
