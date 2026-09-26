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
}

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
export const estVerrouille = (cle: string) => BLOCS.find((b) => b.cle === cle)?.verrouille === true;
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
export function blocsResolus(d: Disposition): Record<CleBloc, BlocPose> {
  const depart = blocsDeDepart(d.base);
  const sortie = {} as Record<CleBloc, BlocPose>;
  for (const { cle, verrouille } of BLOCS) {
    const b = contraindre({ ...depart[cle], ...d.blocs[cle] });
    if (verrouille) delete b.masque;
    sortie[cle] = b;
  }
  return sortie;
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
      if (!CLES.has(cle)) continue;
      const lu = lireBloc(b, cle);
      if (lu) blocs[cle] = lu;
    }
  }
  const nom = typeof brut.nom === "string" && brut.nom.trim() ? brut.nom : "Disposition";
  return { id, nom, type, base, blocs };
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
  return { id: nouvelId(), nom, type, base, blocs: blocsDeDepart(base) };
}

export function dupliquerDisposition(d: Disposition, nom: string): Disposition {
  return { ...structuredClone(d), id: nouvelId(), nom };
}

/** Revient aux positions du modèle de départ. Le nom et le type restent. */
export function reinitialiserDisposition(d: Disposition): Disposition {
  return { ...d, blocs: blocsDeDepart(d.base) };
}

export function poserBloc(d: Disposition, cle: CleBloc, patch: Partial<BlocPose>): Disposition {
  const actuel = blocsResolus(d)[cle];
  const suite = contraindre({ ...actuel, ...patch });
  if (estVerrouille(cle)) delete suite.masque;
  return { ...d, blocs: { ...d.blocs, [cle]: suite } };
}

/** La disposition qu'utilise ce type, ou `null` en mode simple. */
export function dispositionDuType(libre: ReglagesLibres, type: TypeDocumentV3): Disposition | null {
  const id = libre.parType[type];
  return id ? (libre.dispositions[id] ?? null) : null;
}
