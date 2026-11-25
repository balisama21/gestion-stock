import type { Product } from "../types";

/**
 * LA PHARMACIE : TYPES ET RÈGLES
 *
 * Fonctions pures seulement. Les tables vivent dans la base (`pharma_*`,
 * migration 20261120195724) ; les écrans dans `components/pharmacie`.
 */

export type Regime = "libre" | "ordonnance" | "liste_I" | "liste_II" | "stupefiant";
export type Conservation = "ambiante" | "frais";

export const REGIMES: { valeur: Regime; libelle: string; court: string }[] = [
  { valeur: "libre", libelle: "Vente libre", court: "Libre" },
  { valeur: "ordonnance", libelle: "Sur ordonnance", court: "Ordonnance" },
  { valeur: "liste_I", libelle: "Liste I", court: "Liste I" },
  { valeur: "liste_II", libelle: "Liste II", court: "Liste II" },
  { valeur: "stupefiant", libelle: "Stupéfiant", court: "Stupéfiant" },
];

export const libelleRegime = (r: Regime | null | undefined) =>
  REGIMES.find((x) => x.valeur === r)?.libelle ?? "Vente libre";

/** Une ordonnance doit être présentée pour délivrer ce médicament. */
export const exigeOrdonnance = (r: Regime | null | undefined) => !!r && r !== "libre";

export const FORMES = [
  "Comprimé",
  "Gélule",
  "Sirop",
  "Suspension buvable",
  "Solution buvable",
  "Sachet",
  "Injectable",
  "Perfusion",
  "Pommade",
  "Crème",
  "Gel",
  "Collyre",
  "Gouttes",
  "Suppositoire",
  "Ovule",
  "Spray",
  "Inhalateur",
  "Patch",
  "Poudre",
  "Matériel",
];

export interface FichePharma {
  product_id: string;
  store_id: string;
  dci: string | null;
  dosage: string | null;
  forme: string | null;
  laboratoire: string | null;
  emplacement: string | null;
  regime: Regime;
  conservation: Conservation;
  notes: string | null;
}

export interface LotPharma {
  id: string;
  store_id: string;
  product_id: string;
  numero_lot: string | null;
  date_peremption: string | null;
  quantite_recue: number;
  quantite: number;
  prix_achat_unit: number | null;
  fournisseur: string | null;
  purchase_id: string | null;
  recu_le: string;
  cree_le: string;
}

export interface MouvementLot {
  id: string;
  lot_id: string;
  quantite: number;
  motif: "reception" | "stock_date" | "vente" | "retour" | "retrait" | "correction";
  detail: string | null;
  reference_type: string | null;
  reference_id: string | null;
  cree_le: string;
}

export interface OrganismePharma {
  client_id: string;
  store_id: string;
  taux: number;
  convention: string | null;
  actif: boolean;
}

export interface OrdonnancePharma {
  id: string;
  store_id: string;
  numero: number;
  date_delivrance: string;
  patient_nom: string;
  patient_age: string | null;
  patient_telephone: string | null;
  patient_client_id: string | null;
  prescripteur: string | null;
  date_prescription: string | null;
  organisme_id: string | null;
  matricule: string | null;
  part_organisme: number;
  ticket_id: string | null;
  notes: string | null;
  cree_le: string;
}

/* ── Péremptions ────────────────────────────────────────────────── */

export type Urgence = "perime" | "un_mois" | "trois_mois" | "six_mois" | "plus_tard" | "sans_date";

export const URGENCES: {
  cle: Urgence;
  titre: string;
  ton: "danger" | "warning" | "info" | "neutre";
}[] = [
  { cle: "perime", titre: "Périmés", ton: "danger" },
  { cle: "un_mois", titre: "Périment dans le mois", ton: "danger" },
  { cle: "trois_mois", titre: "Dans moins de 3 mois", ton: "warning" },
  { cle: "six_mois", titre: "Dans moins de 6 mois", ton: "info" },
  { cle: "plus_tard", titre: "Plus tard", ton: "neutre" },
  { cle: "sans_date", titre: "Sans date", ton: "neutre" },
];

const jourJ = (jour: string) => Date.parse(`${jour}T00:00:00Z`);
const ajouterMois = (jour: string, mois: number) => {
  const d = new Date(`${jour}T00:00:00Z`);
  const j = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + mois);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(j, dernier));
  return d.toISOString().slice(0, 10);
};

/** Où en est une date de péremption, vue d'aujourd'hui. */
export function urgence(datePeremption: string | null, aujourdhui: string): Urgence {
  if (!datePeremption) return "sans_date";
  if (datePeremption < aujourdhui) return "perime";
  if (datePeremption <= ajouterMois(aujourdhui, 1)) return "un_mois";
  if (datePeremption <= ajouterMois(aujourdhui, 3)) return "trois_mois";
  if (datePeremption <= ajouterMois(aujourdhui, 6)) return "six_mois";
  return "plus_tard";
}

/** Le nombre de jours avant la péremption (négatif : périmé depuis). */
export const joursAvant = (datePeremption: string, aujourdhui: string) =>
  Math.round((jourJ(datePeremption) - jourJ(aujourdhui)) / 86400000);

/** « périmé depuis 12 j », « dans 5 j », « dans 2 mois », « 03/2028 ». */
export function delaiLisible(datePeremption: string | null, aujourdhui: string): string {
  if (!datePeremption) return "sans date";
  const j = joursAvant(datePeremption, aujourdhui);
  if (j < 0) return `périmé depuis ${-j} j`;
  if (j === 0) return "périme aujourd'hui";
  if (j <= 45) return `dans ${j} j`;
  if (j <= 365) return `dans ${Math.round(j / 30)} mois`;
  return moisAnnee(datePeremption);
}

/** « 03/2028 » : c'est ainsi qu'une date de péremption est imprimée sur la boîte. */
export const moisAnnee = (jour: string) => {
  const [a, m] = jour.split("-");
  return `${m}/${a}`;
};

/** « 2028-03 » (saisie d'un mois) → dernier jour du mois, comme sur la boîte. */
export function finDeMois(mois: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mois.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const n = Number(m[2]);
  if (n < 1 || n > 12) return null;
  return new Date(Date.UTC(a, n, 0)).toISOString().slice(0, 10);
}

/** Les lots en rayon d'un produit, du premier qui périme au dernier (comme la vente). */
export function lotsEnRayon(lots: LotPharma[], productId: string, aujourdhui: string): LotPharma[] {
  return lots
    .filter((l) => l.product_id === productId && l.quantite > 0)
    .sort((a, b) => {
      const pa = a.date_peremption !== null && a.date_peremption < aujourdhui ? 1 : 0;
      const pb = b.date_peremption !== null && b.date_peremption < aujourdhui ? 1 : 0;
      if (pa !== pb) return pa - pb;
      if (a.date_peremption !== b.date_peremption) {
        if (a.date_peremption === null) return 1;
        if (b.date_peremption === null) return -1;
        return a.date_peremption.localeCompare(b.date_peremption);
      }
      return a.cree_le.localeCompare(b.cree_le);
    });
}

export interface EtatStock {
  /** Ce qui est rangé en lots. */
  enLots: number;
  /** Le reste du stock, sans numéro ni date. */
  sansDate: number;
  /** Toutes les unités sans date connue, y compris les lots existants. */
  totalSansDate: number;
  /** Stock hors périmés ; les dates inconnues restent à vérifier. */
  disponible: number;
  /** Dont périmé, à ne pas délivrer. */
  perime: number;
  /** La date du prochain lot non périmé qui sortira. */
  prochaine: string | null;
}

export function etatStock(p: Product, lots: LotPharma[], aujourdhui: string): EtatStock {
  const siens = lotsEnRayon(lots, p.id, aujourdhui);
  const enLots = siens.reduce((n, l) => n + l.quantite, 0);
  const perime = siens
    .filter((l) => l.date_peremption !== null && l.date_peremption < aujourdhui)
    .reduce((n, l) => n + l.quantite, 0);
  const prochain = siens.find((l) => l.date_peremption !== null && l.date_peremption >= aujourdhui);
  return {
    enLots,
    sansDate: Math.max(0, p.stockActuel - enLots),
    totalSansDate:
      Math.max(0, p.stockActuel - enLots) +
      siens.filter((l) => l.date_peremption === null).reduce((n, l) => n + l.quantite, 0),
    disponible: Math.max(0, p.stockActuel - perime),
    perime,
    prochaine: prochain?.date_peremption ?? null,
  };
}

export interface LigneUrgence {
  lot: LotPharma;
  produit: Product;
  urgence: Urgence;
  /** La valeur du lot en rayon, au prix d'achat. */
  valeur: number;
}

/** Tous les lots en rayon, rangés par urgence, du plus pressé au moins pressé. */
export function lotsParUrgence(
  lots: LotPharma[],
  produits: Product[],
  aujourdhui: string,
): Map<Urgence, LigneUrgence[]> {
  const parId = new Map(produits.map((p) => [p.id, p]));
  const groupes = new Map<Urgence, LigneUrgence[]>(URGENCES.map((u) => [u.cle, []]));
  for (const lot of lots) {
    const produit = parId.get(lot.product_id);
    if (!produit || lot.quantite <= 0) continue;
    const u = urgence(lot.date_peremption, aujourdhui);
    groupes.get(u)!.push({
      lot,
      produit,
      urgence: u,
      valeur: lot.quantite * (lot.prix_achat_unit ?? produit.prixAchat),
    });
  }
  for (const liste of groupes.values()) {
    liste.sort(
      (a, b) =>
        (a.lot.date_peremption ?? "9999").localeCompare(b.lot.date_peremption ?? "9999") ||
        a.produit.displayName.localeCompare(b.produit.displayName, "fr"),
    );
  }
  return groupes;
}

/* ── Recherche et équivalents ──────────────────────────────────── */

export const normaliser = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Trouve par nom commercial, molécule, laboratoire ou code-barres. */
export function correspond(p: Product, fiche: FichePharma | undefined, recherche: string): boolean {
  const q = normaliser(recherche);
  if (!q) return true;
  if (p.codeBarres && p.codeBarres.replace(/\s/g, "") === recherche.replace(/\s/g, "")) return true;
  const texte = normaliser(
    [p.displayName, fiche?.dci, fiche?.dosage, fiche?.laboratoire, p.sku].filter(Boolean).join(" "),
  );
  return q.split(" ").every((mot) => texte.includes(mot));
}

/**
 * Les équivalents d'un médicament : même molécule (et même dosage s'il
 * est connu), en stock d'abord. Ce qu'on propose quand le produit
 * demandé manque, ou quand le patient veut un générique moins cher.
 */
export function equivalents(
  produit: Product,
  fiches: Map<string, FichePharma>,
  produits: Product[],
): Product[] {
  const fiche = fiches.get(produit.id);
  const dci = normaliser(fiche?.dci);
  if (!dci) return [];
  const dosage = normaliser(fiche?.dosage);
  return produits
    .filter((p) => {
      if (p.id === produit.id) return false;
      const f = fiches.get(p.id);
      if (normaliser(f?.dci) !== dci) return false;
      return !dosage || !normaliser(f?.dosage) || normaliser(f?.dosage) === dosage;
    })
    .sort(
      (a, b) =>
        Number(b.stockActuel > 0) - Number(a.stockActuel > 0) ||
        a.prixVenteDefaut - b.prixVenteDefaut,
    );
}

/* ── Tiers payant ──────────────────────────────────────────────── */

/** La part de l'organisme, arrondie à l'ariary ; le patient paie le reste. */
export function partsTiersPayant(
  total: number,
  taux: number,
): { organisme: number; patient: number } {
  const organisme = Math.round((total * Math.min(100, Math.max(0, taux))) / 100);
  return { organisme, patient: total - organisme };
}

/* ── Rubriques d'une pharmacie ─────────────────────────────────── */

export const RUBRIQUES_PHARMACIE = [
  "Médicaments",
  "Antibiotiques",
  "Antipaludéens",
  "Antalgiques et anti-inflammatoires",
  "Sirops et solutions buvables",
  "Injectables et perfusions",
  "Pommades et usage externe",
  "Vitamines et compléments",
  "Bébé et maman",
  "Hygiène et soins",
  "Matériel médical et pansements",
];

export const DEPENSES_PHARMACIE = [
  "Transport des médicaments",
  "Chaîne du froid",
  "Ordre et licences",
];
