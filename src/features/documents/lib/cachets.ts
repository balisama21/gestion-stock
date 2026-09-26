/**
 * Les cachets et signatures d'une boutique, rangés dans
 * `personnalisation.documents.cachets`. L'image vit dans le seau privé
 * `cachets`, sous `<boutique>/<id>.png`, et n'est jamais remplacée :
 * un document émis garde celle qu'il portait.
 */

export interface Cachet {
  id: string;
  nom: string;
  /** Chemin dans le seau `cachets`. */
  chemin: string;
  /** Taille du PNG, en pixels. */
  largeur: number;
  hauteur: number;
  /** De 0,2 à 1. */
  opacite: number;
  creeLe: string;
}

/** Résolution visée à l'impression : au-delà de cette largeur, l'image se verrait floue. */
export const DPI_IMPRESSION = 300;

export const largeurNetteMm = (c: Pick<Cachet, "largeur">) =>
  Math.round(((c.largeur / DPI_IMPRESSION) * 25.4 * 10) / 10);

const CHEMIN = /^[0-9a-f-]{36}\/[\w-]+\.png$/i;

export function lireCachets(brut: unknown): Cachet[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const sortie: Cachet[] = [];
  for (const c of brut) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    if (typeof r.id !== "string" || vus.has(r.id)) continue;
    if (typeof r.chemin !== "string" || !CHEMIN.test(r.chemin)) continue;
    const largeur = Number(r.largeur);
    const hauteur = Number(r.hauteur);
    if (!(largeur > 0 && hauteur > 0)) continue;
    const opacite = Number(r.opacite);
    vus.add(r.id);
    sortie.push({
      id: r.id,
      nom: typeof r.nom === "string" && r.nom.trim() ? r.nom : "Cachet",
      chemin: r.chemin,
      largeur: Math.round(largeur),
      hauteur: Math.round(hauteur),
      opacite: Number.isFinite(opacite) ? Math.min(1, Math.max(0.2, opacite)) : 1,
      creeLe: typeof r.creeLe === "string" ? r.creeLe : "",
    });
  }
  return sortie;
}

/** La résolution réelle d'un cachet posé sur `largeurMm` : en dessous de 200 ppp, il se verra flou. */
export const pppEffectif = (c: Pick<Cachet, "largeur">, largeurMm: number) =>
  Math.round(c.largeur / (Math.max(1, largeurMm) / 25.4));

export const PPP_MINIMUM = 200;
