import { etatDeStock, type ReglagesAlertesStock } from "./prealerteStock";
import type { ProduitARecommander } from "./bonDeCommande";

/**
 * Niveau cible et quantité à commander.
 *
 * Réglage éteint (défaut) : le comportement historique, 2 × seuil.
 * Allumé : le niveau cible de la fiche (`stock_max`), sinon la règle
 * de la boutique (multiple du seuil ou seuil + écart).
 */

type ReglagesCible = Pick<ReglagesAlertesStock, "reapproActive" | "reapproMode" | "reapproValeur">;

const arrondir = (n: number) => Math.round(n * 1000) / 1000;

export function niveauCibleParRegle(seuil: number, r: ReglagesCible): number {
  const mode = r.reapproActive ? r.reapproMode : "multiple";
  const valeur = r.reapproActive ? r.reapproValeur : 2;
  const brut = mode === "ecart" ? seuil + valeur : seuil * valeur;
  // Le epsilon évite 10 × 1,1 = 11,000…02 → 12.
  return Math.ceil(brut - 1e-9);
}

export function cibleRenseignee(cible: number | null | undefined, r: ReglagesCible): boolean {
  return r.reapproActive && cible != null && Number.isFinite(cible) && cible > 0;
}

export function niveauCible(
  seuil: number,
  cible: number | null | undefined,
  r: ReglagesCible,
): number {
  return cibleRenseignee(cible, r) ? (cible as number) : niveauCibleParRegle(seuil, r);
}

/** Jamais négative ; un stock négatif augmente la quantité, comme il se doit. */
export function quantiteACommander(
  stock: number,
  seuil: number,
  cible: number | null | undefined,
  r: ReglagesCible,
): number {
  return Math.max(0, arrondir(niveauCible(seuil, cible, r) - stock));
}

/* ── La feuille de réapprovisionnement ─────────────────────────── */

export interface LigneReappro {
  id: string;
  produit: string;
  reference: string;
  stock: number;
  seuil: number;
  cible: number;
  /** Faux quand la cible vient de la règle de la boutique. */
  cibleDeLaFiche: boolean;
  quantite: number;
  unite: string | null;
  fournisseur: string;
}

/** Uniquement ce qui est SOUS le seuil — la préalerte n'y entre pas. */
export function lignesDeReappro(
  produits: ProduitARecommander[],
  r: ReglagesAlertesStock,
): LigneReappro[] {
  return produits
    .filter((p) => etatDeStock(p.stockActuel, p.seuilAlerte, r) === "sous_le_seuil")
    .map((p) => ({
      id: p.id,
      produit: p.nom,
      reference: (p.numero || p.sku || "").trim(),
      stock: p.stockActuel,
      seuil: p.seuilAlerte,
      cible: niveauCible(p.seuilAlerte, p.niveauCible, r),
      cibleDeLaFiche: cibleRenseignee(p.niveauCible, r),
      quantite: quantiteACommander(p.stockActuel, p.seuilAlerte, p.niveauCible, r),
      unite: p.unite?.trim() || null,
      fournisseur: (p.fournisseur || "").trim(),
    }))
    .sort(
      (a, b) => a.stock / a.seuil - b.stock / b.seuil || a.produit.localeCompare(b.produit, "fr"),
    );
}

export interface GroupeFournisseur {
  /** Vide pour les produits sans fournisseur. */
  fournisseur: string;
  lignes: LigneReappro[];
}

const cleFournisseur = (nom: string) => nom.trim().toLocaleLowerCase("fr");

/** Groupes par ordre alphabétique, « sans fournisseur » en dernier ; l'ordre des lignes est gardé. */
export function grouperParFournisseur(lignes: LigneReappro[]): GroupeFournisseur[] {
  const groupes = new Map<string, GroupeFournisseur>();
  for (const l of lignes) {
    const cle = cleFournisseur(l.fournisseur);
    const g = groupes.get(cle) ?? { fournisseur: l.fournisseur, lignes: [] };
    g.lignes.push(l);
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) =>
    !a.fournisseur ? 1 : !b.fournisseur ? -1 : a.fournisseur.localeCompare(b.fournisseur, "fr"),
  );
}

export function nombreDeFournisseurs(lignes: LigneReappro[]): number {
  return new Set(lignes.map((l) => cleFournisseur(l.fournisseur))).size;
}

/* ── Les rangées de la feuille imprimée ────────────────────────── */

export type RangeeFeuille =
  { type: "groupe"; fournisseur: string; nombre: number } | { type: "ligne"; ligne: LigneReappro };

export function rangeesDeLaFeuille(lignes: LigneReappro[], grouper: boolean): RangeeFeuille[] {
  if (!grouper) return lignes.map((ligne) => ({ type: "ligne", ligne }));
  return grouperParFournisseur(lignes).flatMap((g): RangeeFeuille[] => [
    { type: "groupe", fournisseur: g.fournisseur, nombre: g.lignes.length },
    ...g.lignes.map((ligne): RangeeFeuille => ({ type: "ligne", ligne })),
  ]);
}

/** Un titre de groupe ne reste pas seul en bas d'une page : il passe à la suivante. */
export function recollerLesGroupes(pages: number[][], rangees: RangeeFeuille[]): number[][] {
  const res = pages.map((p) => [...p]);
  for (let i = 0; i < res.length - 1; i++) {
    const page = res[i];
    while (page.length > 1 && rangees[page[page.length - 1]]?.type === "groupe") {
      res[i + 1].unshift(page.pop() as number);
    }
  }
  return res;
}

/** Le fournisseur en cours au début d'une page, pour le rappeler en tête. */
export function groupeEnCours(rangees: RangeeFeuille[], premierIndice: number): string | null {
  if (rangees[premierIndice]?.type !== "ligne") return null;
  for (let i = premierIndice - 1; i >= 0; i--) {
    const r = rangees[i];
    if (r.type === "groupe") return r.fournisseur;
  }
  return null;
}
