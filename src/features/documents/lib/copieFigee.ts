import type { StoreSettings } from "../../../types";
import { cachetsPlaces, dispositionDuType } from "./disposition";
import { lireIdentite } from "./identite";
import { lireReglagesDocuments, type ReglagesDocuments } from "./reglages";
import { resoudreType, type TypeResolu } from "./resolveur";
import { lireTypes, type ReglagesType, type TypeDocumentV3 } from "./typesDocument";
import { lireLogoCopie, type LogoCopie } from "./logoFige";
import type { TauxFiges } from "./tva";

/**
 * LA COPIE FIGÉE D'UNE PIÈCE ÉMISE
 *
 * Rangée dans `document_emissions.snapshot` au premier tirage, relue à
 * chaque réimpression : la pièce se reconstruit avec l'identité, les
 * réglages, la mise en page, la disposition et les cachets du jour où elle
 * est partie. Les chiffres, eux, viennent toujours de la base : ils ne
 * changent pas.
 *
 * Le logo, qui pèse jusqu'à 2 Mo, n'y est pas recopié : la copie garde le
 * chemin de sa version dans le seau `logos`, rangée une fois pour toutes.
 * Voir `logoFige.ts`.
 *
 * Le taux de TVA de chaque ligne y est figé lui aussi. Les montants
 * viennent de la base, mais le taux vient de la fiche produit, que la
 * boutique peut changer demain : sans cela, la réimpression d'une
 * facture de janvier annoncerait une autre TVA que l'originale.
 */

type ChampBoutique =
  | "storeName"
  | "subtitle"
  | "address"
  | "phone"
  | "email"
  | "nifStat"
  | "receiptFooter"
  | "currencySymbol"
  | "tvaRate";

const CHAMPS_BOUTIQUE: ChampBoutique[] = [
  "storeName",
  "subtitle",
  "address",
  "phone",
  "email",
  "nifStat",
  "receiptFooter",
  "currencySymbol",
  "tvaRate",
];

export type BoutiqueFigee = Partial<Pick<StoreSettings, ChampBoutique | "logoUrl">>;

export interface CopieFigee {
  version: 2;
  emisLe: string;
  /** Repris de la version 1, pour qu'une lecture simple reste possible. */
  identite: ReglagesDocuments["identite"];
  type: TypeResolu;
  page: ReglagesDocuments["pages"][TypeDocumentV3] | null;
  /** Les réglages entiers, réduits à ce que cette pièce utilise. */
  reglages: ReglagesDocuments;
  boutique: BoutiqueFigee;
  /** Absent : le logo n'a pas pu être figé, celui du moment sera repris. */
  logo?: LogoCopie;
  /**
   * Le taux de TVA de chaque ligne, par identifiant de ligne.
   *
   * Absent d'une copie rangée avant que les lignes aient leur taux :
   * la pièce ressort alors comme elle est partie — voir `TauxFiges`.
   */
  taux?: Record<string, number>;
}

const versReglagesType = (r: TypeResolu): ReglagesType => ({
  titre: r.titre,
  prefixe: r.prefixe,
  modele: r.modele,
  couleur: r.couleur,
  echeance: r.echeance,
  validiteJours: r.validiteJours,
  motDeFin: r.motDeFin,
  conditions: r.conditions,
  piedDePage: r.piedDePage,
  commissionSeparee: r.commissionSeparee,
});

export function figer(
  reglages: ReglagesDocuments,
  boutique: StoreSettings | undefined,
  type: TypeDocumentV3,
  emisLe: string,
  logo?: LogoCopie,
  taux?: Record<string, number>,
): CopieFigee {
  const resolu = resoudreType(reglages, type);
  const libre = dispositionDuType(reglages.libre, type);
  const ticket = dispositionDuType(reglages.libre, "ticket");
  const places = new Set(libre ? cachetsPlaces(libre) : []);
  const page = reglages.pages[type] ?? null;

  const figes: ReglagesDocuments = {
    ...reglages,
    types: { [type]: versReglagesType(resolu) },
    pages: page ? { [type]: page } : {},
    libre: {
      dispositions: {
        ...(libre ? { [libre.id]: libre } : {}),
        ...(ticket ? { [ticket.id]: ticket } : {}),
      },
      parType: {
        ...(libre ? { [type]: libre.id } : {}),
        ...(ticket ? { ticket: ticket.id } : {}),
      },
    },
    cachets: reglages.cachets.filter((c) => places.has(c.id)),
  };

  const figee: BoutiqueFigee = {};
  for (const champ of CHAMPS_BOUTIQUE) {
    const v = boutique?.[champ];
    if (v !== undefined && v !== null) (figee as Record<string, unknown>)[champ] = v;
  }

  return {
    version: 2,
    emisLe,
    identite: reglages.identite,
    type: resolu,
    page,
    reglages: figes,
    boutique: figee,
    ...(logo ? { logo } : {}),
    ...(taux ? { taux } : {}),
  };
}

export interface PieceFigee {
  reglages: ReglagesDocuments;
  boutique: BoutiqueFigee;
  logo?: LogoCopie;
  /** `"avant"` : une copie rangée avant que les lignes aient leur taux. */
  taux: TauxFiges;
}

/** Les taux d'une copie, s'ils y sont et s'ils se lisent. */
function lireTaux(brut: unknown): TauxFiges {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return "avant";
  const sortie: Record<string, number> = {};
  for (const [id, v] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) sortie[id] = v;
  }
  return sortie;
}

function lireBoutique(brut: unknown): BoutiqueFigee {
  if (!brut || typeof brut !== "object") return {};
  const r = brut as Record<string, unknown>;
  const sortie: BoutiqueFigee = {};
  for (const champ of CHAMPS_BOUTIQUE) {
    const v = r[champ];
    if (champ === "tvaRate" ? typeof v === "number" : typeof v === "string") {
      (sortie as Record<string, unknown>)[champ] = v;
    }
  }
  return sortie;
}

/**
 * Les réglages avec lesquels reconstruire la pièce.
 *
 * Une copie de version 1 (avant le mode libre) ne portait que l'identité,
 * le type et la mise en page : elle s'applique sur les réglages actuels,
 * en mode simple, puisque la pièce est partie avant qu'une disposition
 * libre puisse exister.
 */
export function lireCopieFigee(
  brut: unknown,
  actuels: ReglagesDocuments,
  type: TypeDocumentV3,
): PieceFigee | null {
  if (!brut || typeof brut !== "object") return null;
  const r = brut as Record<string, unknown>;

  if (r.version === 2 && r.reglages && typeof r.reglages === "object") {
    return {
      reglages: lireReglagesDocuments(r.reglages),
      boutique: lireBoutique(r.boutique),
      logo: lireLogoCopie(r.logo),
      taux: lireTaux(r.taux),
    };
  }

  if (r.version === 1) {
    const typeFige = lireTypes({ [type]: r.type })[type];
    const types = { ...actuels.types };
    if (typeFige) types[type] = typeFige;
    const pages = { ...actuels.pages };
    const pageFigee = lireReglagesDocuments({ pages: { [type]: r.page } }).pages[type];
    if (pageFigee) pages[type] = pageFigee;
    else delete pages[type];
    const parType = { ...actuels.libre.parType };
    delete parType[type];
    return {
      reglages: {
        ...actuels,
        identite: r.identite ? lireIdentite(r.identite) : actuels.identite,
        types,
        pages,
        libre: { ...actuels.libre, parType },
      },
      boutique: {},
      taux: "avant",
    };
  }

  return null;
}
