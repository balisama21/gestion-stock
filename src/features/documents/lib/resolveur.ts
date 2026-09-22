import type { Echeance } from "./format";
import type { ModeleDocument, ReglagesDocuments } from "./reglages";
import { pageResolue, resoudrePage, type MiseEnPage, type PageResolue } from "./miseEnPage";
import { DEFAUTS_TYPE, type ReglagesType, type TypeDocumentV3 } from "./typesDocument";

/**
 * LA CASCADE DES RÉGLAGES
 *
 *   défauts du logiciel → identité et réglages de la boutique (N1)
 *   → réglages du type (N2) → mise en page (N3, à venir)
 *   → surcharge ponctuelle d'un document → copie figée d'un document émis
 *
 * Chaque niveau ne stocke QUE ses écarts. Un niveau qui ne dit rien
 * laisse passer celui d'au-dessus, et c'est ce qui permet de changer
 * une valeur par défaut du logiciel sans repasser sur les boutiques.
 *
 * Tout ce qui construit un document passe par ici, et par ici
 * seulement : c'est le seul endroit où l'ordre de priorité est écrit,
 * donc le seul à corriger s'il change.
 */

export interface TypeResolu {
  type: TypeDocumentV3;
  titre: string;
  prefixe: string;
  modele: ModeleDocument;
  couleur: string;
  echeance: Echeance;
  /** Devis et proforma. Ailleurs, la valeur n'est pas consultée. */
  validiteJours: number;
  motDeFin: string;
  conditions: string;
  piedDePage: string;
  /** Facture avec commission : la détailler, ou la laisser comprise. */
  commissionSeparee: boolean;
}

/** La boutique a-t-elle ouvert l'éditeur de ce type ? */
export function estPersonnalise(reglages: ReglagesDocuments, type: TypeDocumentV3): boolean {
  return reglages.types[type] !== undefined;
}

/**
 * Les réglages d'un type, tous niveaux confondus.
 *
 * Le préfixe de la facture est le seul à avoir une histoire : il
 * existait déjà sous la clé `prefixeFacture`, réglé par des boutiques
 * en service. Il reste donc consulté avant le défaut du logiciel,
 * sans quoi une boutique qui avait choisi « F- » se réveillerait avec
 * « FAC- ».
 */
export function resoudreType(reglages: ReglagesDocuments, type: TypeDocumentV3): TypeResolu {
  const d = DEFAUTS_TYPE[type];
  const n2: ReglagesType = reglages.types[type] ?? {};

  const prefixeBoutique = type === "facture" ? reglages.prefixeFacture : undefined;

  return {
    type,
    titre: n2.titre ?? d.titre,
    prefixe: n2.prefixe ?? prefixeBoutique ?? d.prefixe,
    modele: n2.modele ?? reglages.modele,
    couleur: n2.couleur ?? reglages.couleur,
    echeance: n2.echeance ?? reglages.echeance,
    validiteJours: n2.validiteJours ?? d.validiteJours ?? 30,
    motDeFin: n2.motDeFin ?? d.motDeFin ?? reglages.motDeFin,
    conditions: n2.conditions ?? d.conditions,
    piedDePage: n2.piedDePage ?? reglages.piedDePage,
    commissionSeparee: n2.commissionSeparee ?? d.commissionSeparee ?? true,
  };
}

/**
 * Ce qu'on écrit dans l'enregistrement quand la boutique clique sur
 * « Personnaliser ce document ».
 *
 * Les valeurs héritées sont recopiées telles quelles : à partir de là,
 * un champ vidé veut dire vide, et non « comme la boutique ». C'est le
 * prix de la clarté — l'écran montre exactement ce qui s'imprimera.
 */
export function ouvrirPersonnalisation(
  reglages: ReglagesDocuments,
  type: TypeDocumentV3,
): ReglagesType {
  const r = resoudreType(reglages, type);
  const d = DEFAUTS_TYPE[type];
  const ouvert: ReglagesType = {
    titre: r.titre,
    prefixe: r.prefixe,
    modele: r.modele,
    couleur: r.couleur,
    motDeFin: r.motDeFin,
    conditions: r.conditions,
    piedDePage: r.piedDePage,
  };
  if (type === "facture") ouvert.echeance = r.echeance;
  if (d.validiteJours !== undefined) ouvert.validiteJours = r.validiteJours;
  if (d.commissionSeparee !== undefined) ouvert.commissionSeparee = r.commissionSeparee;
  return ouvert;
}

/* ─────────────────────────────────────────────────────────────
 * Niveau 3 — la mise en page
 * ───────────────────────────────────────────────────────────── */

/** La boutique a-t-elle ouvert l'éditeur de mise en page de ce type ? */
export function pagePersonnalisee(reglages: ReglagesDocuments, type: TypeDocumentV3): boolean {
  // La présence de la clé suffit : ouvrir l'éditeur sans rien changer
  // encore est un état en soi, et il doit survivre à l'enregistrement.
  return reglages.pages[type] !== undefined;
}

/**
 * Ce que ce type de document affiche, tous niveaux empilés.
 *
 * Les interrupteurs de la boutique — TVA, NIF, montant en lettres,
 * tampon, signature, conditions — restent la valeur PAR DÉFAUT des
 * éléments correspondants. La mise en page du type l'emporte quand
 * elle dit quelque chose : c'est la cascade, et elle évite d'avoir
 * deux interrupteurs qui se contredisent pour une même ligne.
 */
export function resoudreMiseEnPage(reglages: ReglagesDocuments, type: TypeDocumentV3): PageResolue {
  const page: MiseEnPage = reglages.pages[type] ?? {};
  return pageResolue(resoudrePage(page, reglages.options, type));
}
