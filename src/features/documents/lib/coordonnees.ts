/**
 * LES COORDONNÉES, LIGNE PAR LIGNE, EN MODE LIBRE
 *
 * Le mode simple compose l'adresse, le téléphone, l'e-mail en quelques
 * lignes de texte. Sur la feuille libre, chacun se règle à part : son
 * ordre, un libellé devant (« Tél. : »), sur sa propre ligne ou accolé à
 * la précédente, masqué. La VALEUR vient toujours de la fiche.
 */

export interface ChampTiers {
  cle: string;
  nom: string;
  valeur: string;
  /** NIF/STAT : exigé sur une facture, il ne se masque pas. */
  obligatoire?: boolean;
  /** Composé en chasse fixe, comme le numéro fiscal. */
  fiscal?: boolean;
}

export interface PresentationCoordonnees {
  ordre?: string[];
  masques?: string[];
  /** Accolée à la ligne précédente (`true`) ou seule sur la sienne (`false`). */
  accole?: Record<string, boolean>;
}

/** Ce qui sortait déjà groupé en mode simple le reste tant qu'on n'a rien demandé. */
const ACCOLES_PAR_DEFAUT = new Set(["entete.email"]);

/** Libellés proposés quand on en ajoute un. */
export const LIBELLES_SUGGERES: Record<string, string> = {
  "entete.telephone": "Tél. : ",
  "entete.email": "E-mail : ",
  "entete.adresse": "Adresse : ",
  "tiers.telephone": "Tél. : ",
  "tiers.adresse": "Adresse : ",
  "tiers.ville": "",
  "tiers.contact": "À l'attention de ",
};

export const cleLibelle = (cle: string) => `libelle:${cle}`;

export const estAccolee = (p: PresentationCoordonnees | undefined, cle: string) =>
  p?.accole?.[cle] ?? ACCOLES_PAR_DEFAUT.has(cle);

/** Tous les champs, dans l'ordre choisi ; ceux que l'ordre ne connaît pas gardent leur rang. */
export function champsOrdonnes(
  champs: ChampTiers[],
  p: PresentationCoordonnees | undefined,
): ChampTiers[] {
  const ordre = p?.ordre ?? [];
  const rang = (c: ChampTiers, i: number) => {
    const r = ordre.indexOf(c.cle);
    return r === -1 ? ordre.length + i : r;
  };
  return champs
    .map((c, i) => ({ c, r: rang(c, i), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

/** Les lignes à imprimer : chaque ligne porte un ou plusieurs champs. */
export function lignesPresentees(
  champs: ChampTiers[],
  p: PresentationCoordonnees | undefined,
): ChampTiers[][] {
  const masques = new Set(p?.masques ?? []);
  const lignes: ChampTiers[][] = [];
  for (const c of champsOrdonnes(champs, p)) {
    if (masques.has(c.cle) && !c.obligatoire) continue;
    const derniere = lignes.at(-1);
    if (derniere && estAccolee(p, c.cle)) derniere.push(c);
    else lignes.push([c]);
  }
  return lignes;
}

/** Monte ou descend un champ d'un rang parmi ceux qui s'affichent. */
export function deplacerChamp(
  champs: ChampTiers[],
  p: PresentationCoordonnees | undefined,
  cle: string,
  sens: -1 | 1,
): PresentationCoordonnees {
  const masques = new Set(p?.masques ?? []);
  const ordre = champsOrdonnes(champs, p).map((c) => c.cle);
  const visibles = ordre.filter((c) => !masques.has(c));
  const i = visibles.indexOf(cle);
  const j = i + sens;
  if (i === -1 || j < 0 || j >= visibles.length) return { ...p, ordre };
  const voisin = visibles[j];
  const a = ordre.indexOf(cle);
  const b = ordre.indexOf(voisin);
  [ordre[a], ordre[b]] = [ordre[b], ordre[a]];
  return { ...p, ordre };
}

export function masquerChamp(
  p: PresentationCoordonnees | undefined,
  cle: string,
  masque: boolean,
): PresentationCoordonnees {
  const actuels = new Set(p?.masques ?? []);
  if (masque) actuels.add(cle);
  else actuels.delete(cle);
  return { ...p, masques: [...actuels] };
}

export function accolerChamp(
  p: PresentationCoordonnees | undefined,
  cle: string,
  accole: boolean,
): PresentationCoordonnees {
  return { ...p, accole: { ...p?.accole, [cle]: accole } };
}

const objet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const cleValide = (v: unknown): v is string => typeof v === "string" && /^[\w.-]{1,60}$/.test(v);

export function lirePresentation(brut: unknown): PresentationCoordonnees | undefined {
  if (!objet(brut)) return undefined;
  const p: PresentationCoordonnees = {};
  if (Array.isArray(brut.ordre)) p.ordre = brut.ordre.filter(cleValide).slice(0, 40);
  if (Array.isArray(brut.masques)) p.masques = brut.masques.filter(cleValide).slice(0, 40);
  if (objet(brut.accole)) {
    const a: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(brut.accole)) {
      if (cleValide(k) && typeof v === "boolean") a[k] = v;
    }
    if (Object.keys(a).length > 0) p.accole = a;
  }
  return Object.keys(p).length > 0 ? p : undefined;
}
