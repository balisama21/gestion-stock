import type { Json } from "./database.types";

/**
 * Les paramètres métier d'une boutique, stockés en clé/valeur dans
 * `parametres_boutique`. Une clé absente de la base vaut son défaut :
 * ajouter un paramètre, c'est ajouter une entrée ici, sans migration.
 */
export interface DefinitionParametre {
  libelle: string;
  aide: string;
  type: "pourcentage" | "nombre" | "texte" | "booleen" | "liste" | "carte";
  defaut: number | string | boolean | string[] | Record<string, string[]>;
  min?: number;
  max?: number;
}

export const PARAMETRES = {
  commission_taux: {
    libelle: "Taux de commission",
    aide: "Proposé quand vous ajoutez une commission à une vente. Vous pouvez toujours corriger le montant vente par vente.",
    type: "pourcentage",
    defaut: 5,
    min: 0,
    max: 100,
  },
  devises_affichees: {
    libelle: "Montants aussi en",
    aide: "Les devises dont l'équivalent s'affiche sous les prix : caisse, produits, achats.",
    type: "liste",
    defaut: [] as string[],
  },
  devise_affichage: {
    libelle: "Afficher les montants en",
    aide: "Tous les montants de l’application et des documents sont convertis au taux du jour. Ils restent enregistrés dans la devise de tenue des comptes.",
    type: "texte",
    defaut: "",
  },
  devises_documents: {
    libelle: "Sur les documents",
    aide: "Par type de document, les devises dont l'équivalent s'imprime sous chaque prix et sous le total.",
    type: "carte",
    defaut: {} as Record<string, string[]>,
  },
} satisfies Record<string, DefinitionParametre>;

export type CleParametre = keyof typeof PARAMETRES;
export type ValeursParametres = Partial<Record<string, Json>>;

export function lireParametre<K extends CleParametre>(
  valeurs: ValeursParametres,
  cle: K,
): (typeof PARAMETRES)[K]["defaut"] {
  const v = valeurs[cle];
  const def = PARAMETRES[cle].defaut;
  if (v === undefined || v === null || typeof v !== typeof def) return def;
  if (Array.isArray(v) !== Array.isArray(def)) return def;
  return v as (typeof PARAMETRES)[K]["defaut"];
}
