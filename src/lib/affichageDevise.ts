/**
 * La devise dans laquelle les montants s'AFFICHENT.
 *
 * Les montants restent enregistrés dans la devise de tenue des comptes
 * (la principale) ; seul l'affichage est converti, au taux du jour.
 * État de module et non contexte React : `formatCurrency` et les
 * formateurs des documents sont des fonctions appelées de partout.
 */
export interface DeviseDeTenue {
  code: string;
  symbole: string;
  decimales: number;
}

export interface DeviseDAffichage extends DeviseDeTenue {
  nom: string;
  /** Valeur d'une unité de cette devise, dans la devise de tenue. */
  taux: number;
}

let tenue: DeviseDeTenue = { code: "MGA", symbole: "Ar", decimales: 0 };
let affichage: DeviseDAffichage | null = null;

export function definirDevises(t: DeviseDeTenue, a: DeviseDAffichage | null): void {
  tenue = t;
  affichage = a && a.code !== t.code && a.taux > 0 ? a : null;
}

/**
 * La conversion à appliquer : celle qu'un document impose, sinon celle de l'écran.
 *
 * `undefined` — rien d'imposé : la devise d'affichage de la boutique.
 * `null` — la devise de tenue, sans conversion, quoi que dise l'écran.
 * Une devise — celle-là, pour ce document seulement (une proforma en euros).
 */
export type ConversionImposee = DeviseDAffichage | null | undefined;

const effective = (o: ConversionImposee): DeviseDAffichage | null =>
  o === undefined ? affichage : o && o.code !== tenue.code && o.taux > 0 ? o : null;

/** Vrai quand l'affichage diffère de la devise de tenue. */
export const conversionActive = (o?: ConversionImposee): boolean => effective(o) !== null;

export const deviseDeTenue = (): DeviseDeTenue => tenue;

export const deviseAffichee = (o?: ConversionImposee): DeviseDeTenue & { nom?: string } =>
  effective(o) ?? tenue;

/** Un montant enregistré, exprimé dans la devise d'affichage. */
export const versAffichage = (montant: number, o?: ConversionImposee): number => {
  const a = effective(o);
  return a ? montant / a.taux : montant;
};

/** Le symbole des champs de saisie : on saisit toujours dans la devise de tenue. */
export const symboleDeSaisie = (): string => tenue.symbole;
