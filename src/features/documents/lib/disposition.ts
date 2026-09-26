import type { ModeleDocument } from "./reglages";
import { TYPES_DOCUMENT, type TypeDocumentV3 } from "./typesDocument";

/**
 * MODE LIBRE — la position de chaque bloc sur la feuille, en millimètres.
 *
 * Rangé dans `personnalisation.documents.libre`. Une clé de bloc absente
 * reprend la position du modèle de départ : un bloc ajouté plus tard au
 * catalogue trouve sa place sans migration.
 */

export const FEUILLE = { l: 210, h: 297 } as const;
export const TAILLE_MIN = 5;

export type CleBloc =
  | "fond"
  | "logo"
  | "nom"
  | "emetteur"
  | "titre"
  | "reperes"
  | "tampon"
  | "destinataire"
  | "tableau"
  | "totaux"
  | "lettres"
  | "mentions"
  | "paiement"
  | "signatures"
  | "motDeFin"
  | "pied";

export type Alignement = "gauche" | "centre" | "droite";

export interface BlocPose {
  x: number;
  y: number;
  l: number;
  h: number;
  masque?: boolean;
  /** Répété en haut ou en bas de chaque page quand le document en compte plusieurs. */
  repete?: boolean;
  align?: Alignement;
  /** Texte clair, pour un bloc posé sur le bandeau de couleur. */
  inverse?: boolean;
}

export interface Disposition {
  id: string;
  nom: string;
  type: TypeDocumentV3;
  base: ModeleDocument;
  blocs: Partial<Record<string, BlocPose>>;
  /** Ticket de caisse : l'ordre des sections, de haut en bas. */
  colonne?: ColonneTicket;
}

export type CleTicket = "entete" | "infos" | "articles" | "totaux" | "pied" | "codeBarres";

export interface ColonneTicket {
  ordre: CleTicket[];
  masques: CleTicket[];
}

export const SECTIONS_TICKET: { cle: CleTicket; nom: string; verrouille?: boolean }[] = [
  { cle: "entete", nom: "En-tête de la boutique", verrouille: true },
  { cle: "infos", nom: "Ticket, date, client", verrouille: true },
  { cle: "articles", nom: "Articles", verrouille: true },
  { cle: "totaux", nom: "Totaux", verrouille: true },
  { cle: "pied", nom: "Message et mention légale", verrouille: true },
  { cle: "codeBarres", nom: "Code-barres" },
];

export const ORDRE_TICKET: CleTicket[] = SECTIONS_TICKET.map((s) => s.cle);

export interface ReglagesLibres {
  dispositions: Record<string, Disposition>;
  /** La disposition utilisée par chaque type. Absent = mode simple. */
  parType: Partial<Record<TypeDocumentV3, string>>;
}

export const LIBRE_PAR_DEFAUT: ReglagesLibres = { dispositions: {}, parType: {} };

export interface BlocCatalogue {
  cle: CleBloc;
  nom: string;
  /** Mention obligatoire : se déplace, ne se masque pas, passe devant les autres. */
  verrouille?: boolean;
}

export const BLOCS: BlocCatalogue[] = [
  { cle: "fond", nom: "Bandeau de couleur" },
  { cle: "logo", nom: "Logo" },
  { cle: "nom", nom: "Nom de la boutique", verrouille: true },
  { cle: "emetteur", nom: "Coordonnées de la boutique" },
  { cle: "titre", nom: "Titre du document" },
  { cle: "reperes", nom: "Numéro et date", verrouille: true },
  { cle: "tampon", nom: "Tampon de paiement" },
  { cle: "destinataire", nom: "Client" },
  { cle: "tableau", nom: "Tableau des lignes", verrouille: true },
  { cle: "totaux", nom: "Totaux", verrouille: true },
  { cle: "lettres", nom: "Montant en lettres" },
  { cle: "mentions", nom: "Conditions" },
  { cle: "paiement", nom: "Coordonnées de paiement" },
  { cle: "signatures", nom: "Signatures" },
  { cle: "motDeFin", nom: "Mot de fin" },
  { cle: "pied", nom: "Pied de page" },
];

const CLES = new Set<string>(BLOCS.map((b) => b.cle));

/** Les marges de chaque modèle, en mm : c'est sur elles que les blocs s'aimantent. */
export const MARGES: Record<ModeleDocument, { x: number; y: number }> = {
  classique: { x: 15, y: 14 },
  bandeau: { x: 15, y: 14 },
  epure: { x: 15, y: 15 },
  compact: { x: 12, y: 12 },
};
export const estVerrouille = (cle: string) => BLOCS.find((b) => b.cle === cle)?.verrouille === true;

/* ── Cachets et signatures : des blocs de plus, un par image placée ── */

export type CleCachet = `cachet:${string}`;
export type ClePosee = CleBloc | CleCachet;
/** Les blocs du catalogue, toujours là, et les cachets placés. */
export type Blocs = Record<CleBloc, BlocPose> & { [cle: CleCachet]: BlocPose };

export const cleCachet = (id: string): CleCachet => `cachet:${id}`;
export const estCleCachet = (cle: string): cle is CleCachet => /^cachet:[\w-]{1,64}$/.test(cle);
export const idDuCachet = (cle: CleCachet) => cle.slice(7);

/** Les clés posées, dans l'ordre : le catalogue, puis les cachets. */
export const clesPosees = (blocs: Blocs): ClePosee[] => [
  ...BLOCS.map((b) => b.cle),
  ...(Object.keys(blocs).filter(estCleCachet) as CleCachet[]),
];

/** Au-dessus des blocs ordinaires, sous les mentions obligatoires. */
export const niveauDuBloc = (cle: ClePosee): 1 | 2 | 3 =>
  estVerrouille(cle) ? 3 : estCleCachet(cle) ? 2 : 1;
export const nomDuBloc = (cle: string) => BLOCS.find((b) => b.cle === cle)?.nom ?? cle;

/* ── Positions de départ, relevées sur chaque modèle ─────────────── */

type Depart = Record<CleBloc, BlocPose>;

const BAS_COMMUN = {
  lettres: { x: 15, y: 212, l: 92, h: 14 },
  mentions: { x: 15, y: 228, l: 92, h: 16 },
  paiement: { x: 15, y: 246, l: 92, h: 12 },
  signatures: { x: 15, y: 259, l: 180, h: 10 },
  motDeFin: { x: 15, y: 269, l: 180, h: 7 },
  pied: { x: 15, y: 277, l: 180, h: 8, repete: true },
};

const DEPARTS: Record<ModeleDocument, Depart> = {
  classique: {
    fond: { x: 0, y: 0, l: 210, h: 50, masque: true },
    logo: { x: 15, y: 14, l: 13, h: 13 },
    nom: { x: 32, y: 14, l: 95, h: 13 },
    titre: { x: 130, y: 14, l: 65, h: 11, align: "droite" },
    reperes: { x: 130, y: 26, l: 65, h: 28, align: "droite" },
    tampon: { x: 160, y: 56, l: 35, h: 9, align: "droite" },
    emetteur: { x: 15, y: 68, l: 85, h: 32 },
    destinataire: { x: 110, y: 68, l: 85, h: 32 },
    tableau: { x: 15, y: 106, l: 180, h: 100 },
    totaux: { x: 117, y: 212, l: 78, h: 34 },
    ...BAS_COMMUN,
  },
  bandeau: {
    fond: { x: 0, y: 0, l: 210, h: 50 },
    logo: { x: 15, y: 12, l: 13, h: 13, inverse: true },
    nom: { x: 32, y: 12, l: 95, h: 13, inverse: true },
    emetteur: { x: 15, y: 28, l: 110, h: 18, inverse: true },
    titre: { x: 130, y: 26, l: 65, h: 13, align: "droite", inverse: true },
    reperes: { x: 120, y: 56, l: 75, h: 28, align: "droite" },
    tampon: { x: 160, y: 86, l: 35, h: 9, align: "droite" },
    destinataire: { x: 15, y: 56, l: 95, h: 32 },
    tableau: { x: 15, y: 98, l: 180, h: 108 },
    totaux: { x: 115, y: 212, l: 80, h: 34 },
    ...BAS_COMMUN,
    motDeFin: { x: 15, y: 272, l: 180, h: 7 },
    pied: { x: 0, y: 283, l: 210, h: 14, repete: true, inverse: true },
  },
  epure: {
    fond: { x: 0, y: 0, l: 210, h: 50, masque: true },
    logo: { x: 15, y: 15, l: 13, h: 13 },
    nom: { x: 32, y: 15, l: 95, h: 13 },
    titre: { x: 130, y: 15, l: 65, h: 12, align: "droite" },
    reperes: { x: 130, y: 29, l: 65, h: 28, align: "droite" },
    tampon: { x: 160, y: 58, l: 35, h: 9, align: "droite", masque: true },
    emetteur: { x: 15, y: 66, l: 85, h: 32 },
    destinataire: { x: 110, y: 66, l: 85, h: 32 },
    tableau: { x: 15, y: 104, l: 180, h: 102 },
    totaux: { x: 117, y: 212, l: 78, h: 30 },
    lettres: { x: 15, y: 246, l: 180, h: 10 },
    mentions: { x: 15, y: 212, l: 92, h: 18 },
    paiement: { x: 15, y: 231, l: 92, h: 12 },
    signatures: { x: 15, y: 258, l: 180, h: 10 },
    motDeFin: { x: 15, y: 269, l: 180, h: 7 },
    pied: { x: 15, y: 277, l: 180, h: 8, repete: true },
  },
  compact: {
    fond: { x: 0, y: 0, l: 210, h: 50, masque: true },
    logo: { x: 12, y: 12, l: 10, h: 10 },
    nom: { x: 25, y: 12, l: 110, h: 10 },
    emetteur: { x: 12, y: 24, l: 125, h: 12 },
    titre: { x: 140, y: 12, l: 58, h: 9, align: "droite" },
    tampon: { x: 163, y: 23, l: 35, h: 8, align: "droite" },
    destinataire: { x: 12, y: 40, l: 95, h: 28 },
    reperes: { x: 120, y: 40, l: 78, h: 26, align: "droite" },
    tableau: { x: 12, y: 72, l: 186, h: 150 },
    lettres: { x: 12, y: 226, l: 100, h: 14 },
    totaux: { x: 128, y: 226, l: 70, h: 30 },
    mentions: { x: 12, y: 242, l: 100, h: 14 },
    paiement: { x: 12, y: 257, l: 100, h: 10 },
    signatures: { x: 12, y: 268, l: 186, h: 10 },
    motDeFin: { x: 12, y: 279, l: 90, h: 7 },
    pied: { x: 108, y: 279, l: 90, h: 8, align: "droite", repete: true },
  },
};

export const blocsDeDepart = (base: ModeleDocument): Record<CleBloc, BlocPose> =>
  structuredClone(DEPARTS[base]);

/* ── Contraintes ─────────────────────────────────────────────────── */

const arrondi = (n: number) => Math.round(n * 10) / 10;

/** Ramène un bloc dans la feuille, avec une taille minimale. */
export function contraindre(b: BlocPose): BlocPose {
  const l = arrondi(Math.min(FEUILLE.l, Math.max(TAILLE_MIN, b.l)));
  const h = arrondi(Math.min(FEUILLE.h, Math.max(TAILLE_MIN, b.h)));
  return {
    ...b,
    l,
    h,
    x: arrondi(Math.min(FEUILLE.l - l, Math.max(0, b.x))),
    y: arrondi(Math.min(FEUILLE.h - h, Math.max(0, b.y))),
  };
}

/** Les blocs à poser : le départ du modèle, recouvert de ce que la boutique a déplacé. */
export function blocsResolus(d: Disposition): Blocs {
  const depart = blocsDeDepart(d.base);
  const sortie = {} as Blocs;
  for (const { cle, verrouille } of BLOCS) {
    const b = contraindre({ ...depart[cle], ...d.blocs[cle] });
    if (verrouille) delete b.masque;
    sortie[cle] = b;
  }
  for (const [cle, b] of Object.entries(d.blocs)) {
    if (estCleCachet(cle) && b) sortie[cle] = contraindre(b);
  }
  return sortie;
}

/* ── Redimensionnement et aimantation ────────────────────────────── */

/** Le coin saisi : nord-ouest, nord-est, sud-ouest, sud-est. */
export type Poignee = "no" | "ne" | "so" | "se";

const bordGauche = (p: Poignee) => p === "no" || p === "so";
const bordHaut = (p: Poignee) => p === "no" || p === "ne";

/** Tire un coin : le coin opposé ne bouge pas, le bloc garde sa taille minimale. */
export function redimensionner(b: BlocPose, p: Poignee, dx: number, dy: number): BlocPose {
  let g = b.x;
  let d = b.x + b.l;
  let h = b.y;
  let bas = b.y + b.h;
  if (bordGauche(p)) g = Math.min(d - TAILLE_MIN, Math.max(0, g + dx));
  else d = Math.max(g + TAILLE_MIN, Math.min(FEUILLE.l, d + dx));
  if (bordHaut(p)) h = Math.min(bas - TAILLE_MIN, Math.max(0, h + dy));
  else bas = Math.max(h + TAILLE_MIN, Math.min(FEUILLE.h, bas + dy));
  return contraindre({ ...b, x: g, y: h, l: d - g, h: bas - h });
}

export interface Guide {
  axe: "x" | "y";
  /** Position de la ligne, en mm. */
  pos: number;
}

export interface Cibles {
  x: number[];
  y: number[];
}

/** Les lignes qui attirent un bloc : bords et milieu de la feuille, marges, autres blocs. */
export function ciblesAimant(blocs: Blocs, sauf: ClePosee, base: ModeleDocument): Cibles {
  const m = MARGES[base];
  const x = [0, m.x, FEUILLE.l / 2, FEUILLE.l - m.x, FEUILLE.l];
  const y = [0, m.y, FEUILLE.h / 2, FEUILLE.h - m.y, FEUILLE.h];
  for (const cle of clesPosees(blocs)) {
    const b = blocs[cle];
    if (cle === sauf || b.masque) continue;
    x.push(b.x, b.x + b.l / 2, b.x + b.l);
    y.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { x, y };
}

function plusProche(points: number[], cibles: number[], seuil: number) {
  let meilleur: { delta: number; pos: number } | null = null;
  for (const p of points) {
    for (const c of cibles) {
      const delta = c - p;
      if (Math.abs(delta) <= seuil && (!meilleur || Math.abs(delta) < Math.abs(meilleur.delta))) {
        meilleur = { delta, pos: c };
      }
    }
  }
  return meilleur;
}

/** Colle un bloc déplacé à la ligne la plus proche, par son bord gauche, son milieu ou son bord droit. */
export function aimanterDeplacement(
  b: BlocPose,
  cibles: Cibles,
  seuil: number,
): { bloc: BlocPose; guides: Guide[] } {
  const sx = plusProche([b.x, b.x + b.l / 2, b.x + b.l], cibles.x, seuil);
  const sy = plusProche([b.y, b.y + b.h / 2, b.y + b.h], cibles.y, seuil);
  const guides: Guide[] = [];
  if (sx) guides.push({ axe: "x", pos: sx.pos });
  if (sy) guides.push({ axe: "y", pos: sy.pos });
  return {
    bloc: contraindre({ ...b, x: b.x + (sx?.delta ?? 0), y: b.y + (sy?.delta ?? 0) }),
    guides,
  };
}

/** Pendant un redimensionnement, seuls les bords tirés s'aimantent. */
export function aimanterRedimension(
  b: BlocPose,
  p: Poignee,
  cibles: Cibles,
  seuil: number,
): { bloc: BlocPose; guides: Guide[] } {
  const guides: Guide[] = [];
  const r = { ...b };
  const sx = plusProche([bordGauche(p) ? b.x : b.x + b.l], cibles.x, seuil);
  if (sx) {
    const l = bordGauche(p) ? b.l - sx.delta : b.l + sx.delta;
    if (l >= TAILLE_MIN) {
      if (bordGauche(p)) r.x = b.x + sx.delta;
      r.l = l;
      guides.push({ axe: "x", pos: sx.pos });
    }
  }
  const sy = plusProche([bordHaut(p) ? b.y : b.y + b.h], cibles.y, seuil);
  if (sy) {
    const h = bordHaut(p) ? b.h - sy.delta : b.h + sy.delta;
    if (h >= TAILLE_MIN) {
      if (bordHaut(p)) r.y = b.y + sy.delta;
      r.h = h;
      guides.push({ axe: "y", pos: sy.pos });
    }
  }
  return { bloc: contraindre(r), guides };
}

/* ── Ticket de caisse : une colonne ──────────────────────────────── */

const SECTIONS = new Set<string>(ORDRE_TICKET);
const verrouTicket = (cle: CleTicket) =>
  SECTIONS_TICKET.find((s) => s.cle === cle)?.verrouille === true;

/** L'ordre complet et les sections masquées, quoi que contienne l'enregistrement. */
export function colonneResolue(d: Pick<Disposition, "colonne"> | null): ColonneTicket {
  const ordre = (d?.colonne?.ordre ?? []).filter(
    (c, i, t) => SECTIONS.has(c) && t.indexOf(c) === i,
  );
  // Une section absente de l'enregistrement reprend sa place d'origine.
  ORDRE_TICKET.forEach((c, i) => {
    if (!ordre.includes(c)) ordre.splice(Math.min(i, ordre.length), 0, c);
  });
  const masques = (d?.colonne?.masques ?? []).filter(
    (c, i, t) => SECTIONS.has(c) && !verrouTicket(c) && t.indexOf(c) === i,
  );
  return { ordre, masques };
}

export function deplacerSection(d: Disposition, cle: CleTicket, rang: number): Disposition {
  const { ordre, masques } = colonneResolue(d);
  const suite = ordre.filter((c) => c !== cle);
  suite.splice(Math.max(0, Math.min(rang, suite.length)), 0, cle);
  return { ...d, colonne: { ordre: suite, masques } };
}

export function basculerSection(d: Disposition, cle: CleTicket): Disposition {
  const { ordre, masques } = colonneResolue(d);
  if (verrouTicket(cle)) return { ...d, colonne: { ordre, masques } };
  const suite = masques.includes(cle) ? masques.filter((c) => c !== cle) : [...masques, cle];
  return { ...d, colonne: { ordre, masques: suite } };
}

/* ── Lecture de la colonne JSON ──────────────────────────────────── */

const MODELES: ModeleDocument[] = ["classique", "bandeau", "epure", "compact"];
const ALIGNS: Alignement[] = ["gauche", "centre", "droite"];
const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const objet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function lireBloc(brut: unknown, cle: string): BlocPose | null {
  if (!objet(brut) || !nombre(brut.x) || !nombre(brut.y) || !nombre(brut.l) || !nombre(brut.h)) {
    return null;
  }
  const b: BlocPose = { x: brut.x, y: brut.y, l: brut.l, h: brut.h };
  if (brut.masque === true && !estVerrouille(cle)) b.masque = true;
  if (typeof brut.repete === "boolean") b.repete = brut.repete;
  if (typeof brut.inverse === "boolean") b.inverse = brut.inverse;
  if (ALIGNS.includes(brut.align as Alignement)) b.align = brut.align as Alignement;
  return contraindre(b);
}

function lireDisposition(brut: unknown, id: string): Disposition | null {
  if (!objet(brut)) return null;
  const type = brut.type as TypeDocumentV3;
  const base = brut.base as ModeleDocument;
  if (!TYPES_DOCUMENT.includes(type) || !MODELES.includes(base)) return null;
  const blocs: Disposition["blocs"] = {};
  if (objet(brut.blocs)) {
    for (const [cle, b] of Object.entries(brut.blocs)) {
      if (!CLES.has(cle) && !estCleCachet(cle)) continue;
      const lu = lireBloc(b, cle);
      if (lu) blocs[cle] = lu;
    }
  }
  const nom = typeof brut.nom === "string" && brut.nom.trim() ? brut.nom : "Disposition";
  const lue: Disposition = { id, nom, type, base, blocs };
  if (objet(brut.colonne)) {
    const liste = (v: unknown) =>
      Array.isArray(v) ? v.filter((c): c is CleTicket => typeof c === "string") : [];
    lue.colonne = colonneResolue({
      colonne: { ordre: liste(brut.colonne.ordre), masques: liste(brut.colonne.masques) },
    });
  }
  return lue;
}

export function lireLibre(brut: unknown): ReglagesLibres {
  if (!objet(brut)) return { dispositions: {}, parType: {} };
  const dispositions: Record<string, Disposition> = {};
  if (objet(brut.dispositions)) {
    for (const [id, d] of Object.entries(brut.dispositions)) {
      const lu = lireDisposition(d, id);
      if (lu) dispositions[id] = lu;
    }
  }
  const parType: ReglagesLibres["parType"] = {};
  if (objet(brut.parType)) {
    for (const [type, id] of Object.entries(brut.parType)) {
      const d = typeof id === "string" ? dispositions[id] : undefined;
      if (d && d.type === type) parType[type as TypeDocumentV3] = id as string;
    }
  }
  return { dispositions, parType };
}

/* ── Opérations ──────────────────────────────────────────────────── */

const nouvelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function creerDisposition(
  type: TypeDocumentV3,
  base: ModeleDocument,
  nom: string,
): Disposition {
  if (type === "ticket") {
    return { id: nouvelId(), nom, type, base, blocs: {}, colonne: colonneResolue(null) };
  }
  return { id: nouvelId(), nom, type, base, blocs: blocsDeDepart(base) };
}

export function dupliquerDisposition(d: Disposition, nom: string): Disposition {
  return { ...structuredClone(d), id: nouvelId(), nom };
}

/** Revient aux positions du modèle de départ. Le nom et le type restent. */
export function reinitialiserDisposition(d: Disposition): Disposition {
  if (d.type === "ticket") return { ...d, colonne: colonneResolue(null) };
  return { ...d, blocs: blocsDeDepart(d.base) };
}

export function poserBloc(d: Disposition, cle: ClePosee, patch: Partial<BlocPose>): Disposition {
  const actuel = blocsResolus(d)[cle];
  if (!actuel) return d;
  const suite = contraindre({ ...actuel, ...patch });
  if (estVerrouille(cle)) delete suite.masque;
  return { ...d, blocs: { ...d.blocs, [cle]: suite } };
}

/**
 * Place un cachet sur la feuille, à la hauteur des signatures, à droite :
 * c'est là qu'un tampon se pose sur un document papier. Sa taille suit
 * celle de l'image, sans la déformer.
 */
export function placerCachet(
  d: Disposition,
  c: { id: string; largeur: number; hauteur: number },
): Disposition {
  const ratio = c.hauteur / Math.max(1, c.largeur);
  let l = ratio > 0.6 ? 40 : 55;
  let h = l * ratio;
  if (h > 40) {
    h = 40;
    l = h / ratio;
  }
  const blocs = blocsResolus(d);
  const sig = blocs.signatures;
  const m = MARGES[d.base];
  const x = FEUILLE.l - m.x - l;
  const bas = sig.y + sig.h;
  // Sans mordre sur une mention obligatoire posée juste au-dessus (le total, souvent).
  const plafond = Math.max(
    0,
    ...BLOCS.filter((b) => b.verrouille)
      .map((b) => blocs[b.cle])
      .filter((b) => b.x < x + l && b.x + b.l > x && b.y + b.h <= bas && b.y + b.h > bas - h)
      .map((b) => b.y + b.h + 2),
  );
  if (bas - plafond < h) {
    h = Math.max(20, bas - plafond);
    l = h / ratio;
  }
  const b = contraindre({ x: FEUILLE.l - m.x - l, y: bas - h, l, h });
  return { ...d, blocs: { ...d.blocs, [cleCachet(c.id)]: b } };
}

export function retirerCachet(d: Disposition, id: string): Disposition {
  const blocs = { ...d.blocs };
  delete blocs[cleCachet(id)];
  return { ...d, blocs };
}

/** Les cachets que cette disposition place. */
export const cachetsPlaces = (d: Disposition): string[] =>
  Object.keys(d.blocs).filter(estCleCachet).map(idDuCachet);

/** La disposition qu'utilise ce type, ou `null` en mode simple. */
export function dispositionDuType(libre: ReglagesLibres, type: TypeDocumentV3): Disposition | null {
  const id = libre.parType[type];
  return id ? (libre.dispositions[id] ?? null) : null;
}
