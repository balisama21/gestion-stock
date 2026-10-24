/**
 * LE NIF ET LE STAT, DEUX NUMÉROS DISTINCTS
 *
 * Le NIF (numéro d'identification fiscale) et le STAT (numéro
 * statistique) ne sont pas le même identifiant, et une facture doit
 * pouvoir montrer l'un et l'autre, chacun sous son nom.
 *
 * ── UNE SEULE COLONNE, ET C'EST VOULU ──────────────────────────────
 *
 * La boutique n'a qu'une colonne pour les deux, `stores.nif_stat`. Plutôt
 * qu'une migration, les deux numéros y sont écrits sous une forme lisible
 * par une personne comme par ce module : « NIF 123 · STAT 456 ». Une
 * valeur saisie avant ce découpage, sans mot-clé, reste ce qu'elle
 * était — un numéro unique — et s'imprime comme avant, « NIF/STAT … ».
 * Rien n'est réécrit tant que la boutique ne touche pas à ces champs.
 */

export interface NifStat {
  nif: string;
  stat: string;
  /** Une valeur d'avant le découpage : un seul numéro, sans précision. */
  libre: string;
}

const SEPARATEUR = " · ";

/** Les deux numéros, lus dans la colonne de la boutique. */
export function lireNifStat(brut: string | null | undefined): NifStat {
  const v = (brut ?? "").trim();
  if (!v) return { nif: "", stat: "", libre: "" };

  // « NIF/STAT 123 », « NIF & STAT : 123 » : l'ancien libellé commun,
  // parfois recopié dans la valeur. Ce n'est pas un découpage.
  const commun = v.match(/^NIF\s*(?:\/|&|et)\s*STAT\s*:?\s*(.*)$/i);
  if (commun) return { nif: "", stat: "", libre: commun[1].trim() };

  const nif = v.match(/\bNIF\b\s*:?\s*(.*?)\s*(?=[·|;,]|\bSTAT\b|$)/i);
  const stat = v.match(/\bSTAT\b\s*:?\s*(.*?)\s*(?=[·|;,]|\bNIF\b|$)/i);
  if (!nif && !stat) return { nif: "", stat: "", libre: v };
  return { nif: nif?.[1].trim() ?? "", stat: stat?.[1].trim() ?? "", libre: "" };
}

/** Ce qui s'écrit dans la colonne. Deux numéros vides donnent une valeur vide. */
export function ecrireNifStat(nif: string, stat: string): string {
  return [nif.trim() && `NIF ${nif.trim()}`, stat.trim() && `STAT ${stat.trim()}`]
    .filter(Boolean)
    .join(SEPARATEUR);
}

/** Vrai quand la valeur distingue déjà le NIF du STAT. */
export const estDetaille = (brut: string | null | undefined): boolean => {
  const l = lireNifStat(brut);
  return !l.libre && Boolean(l.nif || l.stat);
};

/**
 * La valeur telle qu'elle se lit sur un document, sans libellé devant :
 * « NIF 123 · STAT 456 » une fois découpée, le numéro seul sinon.
 */
export function valeurFiscale(brut: string | null | undefined): string {
  const l = lireNifStat(brut);
  return l.libre ? insecable(l.libre) : texteFiscal(brut);
}

/**
 * Un numéro ne se coupe pas en fin de ligne : « 46101 11 » en haut et
 * « 2020 0 00123 » en dessous ne se recopient plus. Les espaces d'un
 * numéro, et celle qui le lie à son libellé, deviennent insécables ; la
 * ligne ne se coupe qu'entre le NIF et le STAT.
 */
const insecable = (v: string) => v.replace(/ /g, "\u00a0");

/** La ligne complète, libellé compris : ce qu'un document imprime. */
export function texteFiscal(brut: string | null | undefined): string {
  const l = lireNifStat(brut);
  if (l.libre) return insecable(`NIF/STAT ${l.libre}`);
  return [l.nif && insecable(`NIF ${l.nif}`), l.stat && insecable(`STAT ${l.stat}`)]
    .filter(Boolean)
    .join(SEPARATEUR);
}
