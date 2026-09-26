import type { Json } from "./database.types";

/**
 * Les paramètres métier d'une boutique, stockés en clé/valeur dans
 * `parametres_boutique`. Une clé absente de la base vaut son défaut :
 * ajouter un paramètre, c'est ajouter une entrée ici, sans migration.
 */
export interface DefinitionParametre {
  libelle: string;
  aide: string;
  type: "pourcentage" | "nombre" | "texte" | "booleen";
  defaut: number | string | boolean;
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
  return v as (typeof PARAMETRES)[K]["defaut"];
}
