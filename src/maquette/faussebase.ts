import type { Product, Purchase, Sale } from "../types";
import { dateDuJour } from "../lib/dates";

/**
 * UNE BASE EN MÉMOIRE POUR LE BANC DE MAQUETTES
 *
 * Elle répond comme Supabase aux requêtes des écrans (`from(...)` et
 * `rpc(...)`), et reproduit les règles de la base : le lot qui périme le
 * premier sort le premier, une vente annulée rend ses boîtes, un retrait
 * vide CE lot. Les règles réelles sont éprouvées par
 * `supabase/essais/pharmacie.mjs` ; celles-ci ne servent qu'à cliquer.
 *
 * Une pharmacie fictive y est installée : des médicaments, des lots dont
 * certains périment, des patients, des organismes, un mois de ventes.
 */

type Ligne = Record<string, any>;

const aujourdhui = () => dateDuJour();
const decaler = (jours: number) => dateDuJour(new Date(Date.now() + jours * 86400000));
const finDeMois = (mois: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + mois + 1, 0)).toISOString().slice(0, 10);
};
let compteur = 0;
const id = () => `m-${(++compteur).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const BOUTIQUE = "boutique-maquette";

export const base = {
  produits: [] as Product[],
  ventes: [] as Sale[],
  achats: [] as Purchase[],
  paiements: [] as Ligne[],
  tables: {
    clients: [] as Ligne[],
    suppliers: [] as Ligne[],
    categories: [] as Ligne[],
    pharma_fiches: [] as Ligne[],
    pharma_lots: [] as Ligne[],
    pharma_lot_mouvements: [] as Ligne[],
    pharma_organismes: [] as Ligne[],
    pharma_ordonnances: [] as Ligne[],
    purchases: [] as Ligne[],
    stock_movements: [] as Ligne[],
  } as Record<string, Ligne[]>,
};

/* ── Avertir les écrans ────────────────────────────────────────── */

let version = 0;
const abonnes = new Set<() => void>();
export const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};
export const versionDeLaBase = () => version;
const changer = () => {
  version += 1;
  for (const f of abonnes) f();
};

/* ── Le déclencheur des lots, comme en base ───────────────────── */

const lotsDe = (productId: string) =>
  base.tables.pharma_lots.filter((l) => l.product_id === productId);

function mouvement(
  productId: string,
  delta: number,
  type: string,
  reference: { type: string | null; id: string | null },
  lotsGeres = false,
) {
  base.tables.stock_movements.push({
    id: id(),
    store_id: BOUTIQUE,
    product_id: productId,
    type_mouvement: type,
    stock_actuel_delta: delta,
    reference_type: reference.type,
    reference_id: reference.id,
    created_at: new Date().toISOString(),
  });
  if (lotsGeres || lotsDe(productId).length === 0) return;
  const j = aujourdhui();
  if (delta < 0) {
    let reste = -delta;
    const ordre = lotsDe(productId)
      .filter((l) => l.quantite > 0)
      .sort((a, b) => {
        const pa = a.date_peremption && a.date_peremption < j ? 1 : 0;
        const pb = b.date_peremption && b.date_peremption < j ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (a.date_peremption ?? "9999").localeCompare(b.date_peremption ?? "9999");
      });
    for (const lot of ordre) {
      if (reste <= 0) break;
      const part = Math.min(reste, lot.quantite);
      lot.quantite -= part;
      base.tables.pharma_lot_mouvements.push({
        id: id(),
        store_id: BOUTIQUE,
        lot_id: lot.id,
        quantite: -part,
        motif: type === "vente" ? "vente" : "correction",
        detail: type,
        reference_type: reference.type,
        reference_id: reference.id,
        cree_le: new Date().toISOString(),
      });
      reste -= part;
    }
  }
}

/* ── Les gestes : vendre, recevoir, payer ──────────────────────── */

const nomClient = (c: Ligne) => [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;

export function vendre(panier: {
  date: string;
  vendeur: string;
  clientCredit: string | null;
  clientId: string | null;
  montantPaye: number;
  methode: string;
  lignes: {
    productId: string;
    quantite: number;
    prixVenteUnit: number;
    conditionnementId?: string;
    nombre?: number;
    prixConditionnement?: number;
  }[];
}): { ventes: Sale[]; error: string | null } {
  for (const l of panier.lignes) {
    const p = base.produits.find((x) => x.id === l.productId);
    if (!p) return { ventes: [], error: "Produit introuvable." };
    if (l.quantite > p.stockActuel)
      return { ventes: [], error: `Stock disponible insuffisant pour "${p.displayName}".` };
  }
  const ticket = id();
  // Les ventes d'un jour passé gardent une heure de ce jour-là : la caisse
  // range l'argent reçu par jour de paiement.
  const quand =
    panier.date === aujourdhui()
      ? new Date().toISOString()
      : new Date(
          `${panier.date}T${String(8 + (base.ventes.length % 11)).padStart(2, "0")}:${String(
            (base.ventes.length * 7) % 60,
          ).padStart(2, "0")}:00`,
        ).toISOString();
  let reste = panier.montantPaye;
  const faites: Sale[] = [];
  for (const l of panier.lignes) {
    const p = base.produits.find((x) => x.id === l.productId)!;
    const total = l.conditionnementId
      ? (l.nombre ?? 0) * (l.prixConditionnement ?? 0)
      : l.quantite * l.prixVenteUnit;
    const paye = Math.min(reste, total);
    reste -= paye;
    p.stockActuel -= l.quantite;
    p.stockDisponible = p.stockActuel;
    const c = p.conditionnements.find((x) => x.id === l.conditionnementId);
    const vente: Sale = {
      id: id(),
      numero: `V${base.ventes.length + 1}`,
      date: panier.date,
      productId: p.id,
      designation: p.displayName,
      quantite: l.quantite,
      prixVenteUnit: total / l.quantite,
      totalVente: total,
      prixAchatUnitRef: p.prixAchat,
      totalAchatRef: l.quantite * p.prixAchat,
      margeTotale: total - l.quantite * p.prixAchat,
      vendeur: panier.vendeur,
      clientCredit: panier.clientCredit ?? undefined,
      clientId: panier.clientId,
      ticketId: ticket,
      commission: 0,
      montantPaye: paye,
      montantRembourse: 0,
      montantAvoire: 0,
      soldeDu: total - paye,
      statutCredit: paye >= total ? "Payé" : paye > 0 ? "Partiel" : "Impayé",
      saisieLe: quand,
      conditionnement: c ? { nom: c.nom, nombre: l.nombre ?? 0, facteur: c.quantite } : null,
    };
    base.ventes.push(vente);
    faites.push(vente);
    if (paye > 0)
      base.paiements.push({
        id: id(),
        numero: `PAY${base.paiements.length + 1}`,
        orderId: null,
        saleId: vente.id,
        montant: paye,
        methode: panier.methode || "especes",
        reference: null,
        note: null,
        createdAt: quand,
      });
    mouvement(p.id, -l.quantite, "vente", { type: "sale", id: vente.id });
  }
  changer();
  return { ventes: faites, error: null };
}

export function payerVente(saleId: string, montant: number) {
  const v = base.ventes.find((x) => x.id === saleId);
  if (!v) return { error: "Vente introuvable." };
  if (montant > v.soldeDu) return { error: "Paiement refusé." };
  v.montantPaye += montant;
  v.soldeDu -= montant;
  v.statutCredit = v.soldeDu <= 0 ? "Payé" : "Partiel";
  base.paiements.push({
    id: id(),
    numero: `PAY${base.paiements.length + 1}`,
    orderId: null,
    saleId,
    montant,
    methode: "especes",
    reference: null,
    note: null,
    createdAt: new Date().toISOString(),
  });
  changer();
  return { error: null };
}

function acheter(
  productId: string,
  quantite: number,
  prix: number,
  fournisseur: string,
  date: string,
  paye: number,
) {
  const p = base.produits.find((x) => x.id === productId)!;
  p.stockActuel += quantite;
  p.stockDisponible = p.stockActuel;
  const a: Purchase = {
    id: id(),
    numero: `A${base.achats.length + 1}`,
    date,
    productId,
    designation: p.displayName,
    quantite,
    prixAchatUnit: prix,
    totalAchat: quantite * prix,
    fournisseur,
    supplierId: null,
    impactTresorerie: -paye,
    montantPaye: paye,
    soldeDu: quantite * prix - paye,
    statutPaiement: paye >= quantite * prix ? "Payé" : "Partiel",
    dateEcheance: null,
  };
  base.achats.push(a);
  mouvement(productId, quantite, "achat", { type: "purchase", id: a.id });
  return a;
}

function nouveauLot(l: Ligne) {
  const lot = {
    id: id(),
    store_id: BOUTIQUE,
    numero_lot: null,
    date_peremption: null,
    prix_achat_unit: null,
    fournisseur: null,
    purchase_id: null,
    recu_le: aujourdhui(),
    cree_le: new Date().toISOString(),
    ...l,
    quantite_recue: l.quantite,
  };
  base.tables.pharma_lots.push(lot);
  return lot;
}

/* ── Les fonctions de la base ──────────────────────────────────── */

const rpcs: Record<string, (a: Ligne) => { data: unknown; error: { message: string } | null }> = {
  ajuster_stock: (a) => {
    const p = base.produits.find((x) => x.id === a.p_product_id)!;
    if (p.stockActuel + a.p_delta < 0)
      return {
        data: null,
        error: { message: `Stock insuffisant : il reste ${p.stockActuel} unité(s).` },
      };
    p.stockActuel += a.p_delta;
    p.stockDisponible = p.stockActuel;
    mouvement(p.id, a.p_delta, "ajustement", { type: null, id: null });
    const m = base.tables.stock_movements[base.tables.stock_movements.length - 1];
    m.note = a.p_note ?? null;
    return { data: { ...p }, error: null };
  },
  pharma_recevoir: (a) => {
    let reste = a.p_montant_paye ?? Infinity;
    for (const l of a.p_lignes as Ligne[]) {
      const p = base.produits.find((x) => x.id === l.product_id)!;
      const c = p.conditionnements.find((x) => x.id === l.conditionnement_id);
      const quantite = c ? l.nombre * c.quantite : l.quantite;
      const prix = c ? l.prix_conditionnement / c.quantite : l.prix_achat_unit;
      const paye = Math.min(reste, quantite * prix);
      reste -= paye;
      const achat = acheter(p.id, quantite, prix, a.p_fournisseur, a.p_date, paye);
      const lot = nouveauLot({
        product_id: p.id,
        numero_lot: l.numero_lot || null,
        date_peremption: l.date_peremption || null,
        quantite,
        prix_achat_unit: prix,
        fournisseur: a.p_fournisseur || null,
        purchase_id: achat.id,
        recu_le: a.p_date,
      });
      base.tables.pharma_lot_mouvements.push({
        id: id(),
        lot_id: lot.id,
        quantite,
        motif: "reception",
        reference_type: "purchase",
        reference_id: achat.id,
        cree_le: new Date().toISOString(),
      });
    }
    return { data: { lignes: a.p_lignes.length }, error: null };
  },
  pharma_dater_stock: (a) => {
    const p = base.produits.find((x) => x.id === a.p_product_id)!;
    const libre = p.stockActuel - lotsDe(p.id).reduce((n, l) => n + l.quantite, 0);
    if (a.p_quantite > libre)
      return {
        data: null,
        error: { message: `Il ne reste que ${libre} unité(s) sans date pour ce produit.` },
      };
    const lot = nouveauLot({
      product_id: p.id,
      numero_lot: a.p_numero_lot || null,
      date_peremption: a.p_date_peremption,
      quantite: a.p_quantite,
      prix_achat_unit: p.prixAchat,
    });
    base.tables.pharma_lot_mouvements.push({
      id: id(),
      lot_id: lot.id,
      quantite: a.p_quantite,
      motif: "stock_date",
      cree_le: new Date().toISOString(),
    });
    return { data: lot.id, error: null };
  },
  pharma_corriger_lot: (a) => {
    const lot = base.tables.pharma_lots.find((l) => l.id === a.p_lot_id)!;
    lot.numero_lot = a.p_numero_lot || null;
    lot.date_peremption = a.p_date_peremption;
    return { data: null, error: null };
  },
  pharma_retirer_lot: (a) => {
    const lot = base.tables.pharma_lots.find((l) => l.id === a.p_lot_id)!;
    if (a.p_quantite > lot.quantite)
      return {
        data: null,
        error: { message: `Ce lot n'a que ${lot.quantite} unité(s) en rayon.` },
      };
    const p = base.produits.find((x) => x.id === lot.product_id)!;
    p.stockActuel -= a.p_quantite;
    p.stockDisponible = p.stockActuel;
    mouvement(p.id, -a.p_quantite, "ajustement", { type: null, id: null }, true);
    lot.quantite -= a.p_quantite;
    const libelle =
      {
        perime: "Périmé",
        retour_fournisseur: "Rendu au fournisseur",
        casse: "Cassé ou abîmé",
        autre: "Retiré",
      }[a.p_raison as string] ?? "Retiré";
    base.tables.pharma_lot_mouvements.push({
      id: id(),
      lot_id: lot.id,
      quantite: -a.p_quantite,
      motif: "retrait",
      detail: a.p_note ? `${libelle} · ${a.p_note}` : libelle,
      cree_le: new Date().toISOString(),
    });
    return { data: null, error: null };
  },
};

export async function rpc(fn: string, args: Ligne) {
  const f = rpcs[fn];
  if (!f) return { data: null, error: { message: `Fonction ${fn} absente de la maquette.` } };
  const r = f(args);
  changer();
  return r;
}

/* ── Une requête façon PostgREST ───────────────────────────────── */

class Requete {
  private filtres: ((l: Ligne) => boolean)[] = [];
  private tri: { colonne: string; montant: boolean } | null = null;
  private plage: [number, number] | null = null;
  private maximum: number | null = null;
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private donnees: Ligne[] = [];
  private changements: Ligne = {};
  private unique = false;
  private retour = false;

  constructor(private table: string) {}

  private get lignes() {
    return (base.tables[this.table] ??= []);
  }
  select() {
    this.retour = true;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtres.push((l) => l[c] === v);
    return this;
  }
  gt(c: string, v: any) {
    this.filtres.push((l) => l[c] > v);
    return this;
  }
  gte(c: string, v: any) {
    this.filtres.push((l) => l[c] >= v);
    return this;
  }
  lt(c: string, v: any) {
    this.filtres.push((l) => l[c] < v);
    return this;
  }
  lte(c: string, v: any) {
    this.filtres.push((l) => l[c] <= v);
    return this;
  }
  in(c: string, v: unknown[]) {
    this.filtres.push((l) => v.includes(l[c]));
    return this;
  }
  like(c: string, motif: string) {
    const re = new RegExp(`^${motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
    this.filtres.push((l) => re.test(String(l[c] ?? "")));
    return this;
  }
  ilike(c: string, motif: string) {
    const re = new RegExp(
      `^${motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
      "i",
    );
    this.filtres.push((l) => re.test(String(l[c] ?? "")));
    return this;
  }
  order(c: string, o: { ascending?: boolean } = {}) {
    this.tri = { colonne: c, montant: o.ascending !== false };
    return this;
  }
  range(a: number, b: number) {
    this.plage = [a, b];
    return this;
  }
  limit(n: number) {
    this.maximum = n;
    return this;
  }
  single() {
    this.unique = true;
    return this;
  }
  insert(d: Ligne | Ligne[]) {
    this.action = "insert";
    this.donnees = Array.isArray(d) ? d : [d];
    return this;
  }
  upsert(d: Ligne | Ligne[]) {
    this.action = "upsert";
    this.donnees = Array.isArray(d) ? d : [d];
    return this;
  }
  update(d: Ligne) {
    this.action = "update";
    this.changements = d;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }

  private executer(): { data: unknown; error: { message: string } | null } {
    const garde = (l: Ligne) => this.filtres.every((f) => f(l));
    if (this.action === "insert" || this.action === "upsert") {
      const cle =
        this.table === "pharma_fiches"
          ? "product_id"
          : this.table === "pharma_organismes"
            ? "client_id"
            : "id";
      const faites = this.donnees.map((d) => {
        const deja =
          this.action === "upsert" ? this.lignes.find((l) => l[cle] === d[cle]) : undefined;
        if (deja) return Object.assign(deja, d);
        const ligne: Ligne = { id: id(), cree_le: new Date().toISOString(), ...d };
        if (this.table === "pharma_ordonnances") {
          ligne.numero =
            Math.max(
              0,
              ...this.lignes.filter((o) => o.store_id === d.store_id).map((o) => o.numero),
            ) + 1;
          ligne.date_delivrance ??= aujourdhui();
        }
        if (this.table === "clients") ligne.created_at = new Date().toISOString();
        this.lignes.push(ligne);
        return ligne;
      });
      changer();
      return { data: this.unique ? faites[0] : faites, error: null };
    }
    if (this.action === "update") {
      const touchees = this.lignes.filter(garde);
      for (const l of touchees) Object.assign(l, this.changements);
      changer();
      return { data: touchees, error: null };
    }
    if (this.action === "delete") {
      base.tables[this.table] = this.lignes.filter((l) => !garde(l));
      changer();
      return { data: null, error: null };
    }
    let lues = this.lignes.filter(garde);
    if (this.tri) {
      const { colonne, montant } = this.tri;
      lues = [...lues].sort((a, b) =>
        a[colonne] === b[colonne] ? 0 : (a[colonne] > b[colonne] ? 1 : -1) * (montant ? 1 : -1),
      );
    }
    if (this.plage) lues = lues.slice(this.plage[0], this.plage[1] + 1);
    if (this.maximum !== null) lues = lues.slice(0, this.maximum);
    return { data: this.unique ? (lues[0] ?? null) : lues.map((l) => ({ ...l })), error: null };
  }

  then<T>(ok: (v: { data: any; error: { message: string } | null }) => T, ko?: (e: unknown) => T) {
    try {
      return Promise.resolve(ok(this.executer()));
    } catch (e) {
      return ko ? Promise.resolve(ko(e)) : Promise.reject(e);
    }
  }
}

export const from = (table: string) => new Requete(table);

/* ── La pharmacie fictive ──────────────────────────────────────── */

interface Med {
  nom: string;
  dci: string;
  dosage: string;
  forme: string;
  labo: string;
  rubrique: string;
  regime?: string;
  frais?: boolean;
  achat: number;
  vente: number;
  seuil?: number;
  unite?: string;
  emplacement?: string;
  boite?: { nom: string; quantite: number; prix: number };
  /** [quantité, péremption en mois depuis aujourd'hui (négatif : périmé), numéro] */
  lots: [number, number | null, string][];
  sansDate?: number;
}

const MEDICAMENTS: Med[] = [
  {
    nom: "Paracétamol",
    dci: "Paracétamol",
    dosage: "500 mg",
    forme: "Comprimé",
    labo: "Pharmalab",
    rubrique: "Antalgiques et anti-inflammatoires",
    achat: 900,
    vente: 1500,
    seuil: 20,
    emplacement: "A1",
    lots: [
      [60, 14, "PC2311"],
      [24, 2, "PC2207"],
    ],
  },
  {
    nom: "Fébrinol",
    dci: "Paracétamol",
    dosage: "500 mg",
    forme: "Comprimé effervescent",
    labo: "Labo Tsara",
    rubrique: "Antalgiques et anti-inflammatoires",
    achat: 1800,
    vente: 2800,
    emplacement: "A1",
    lots: [],
  },
  {
    nom: "Paracétamol sirop",
    dci: "Paracétamol",
    dosage: "120 mg/5 ml",
    forme: "Sirop",
    labo: "Pharmalab",
    rubrique: "Sirops et solutions buvables",
    achat: 2500,
    vente: 4000,
    emplacement: "B2",
    lots: [[18, 9, "PS0912"]],
  },
  {
    nom: "Amoxicilline",
    dci: "Amoxicilline",
    dosage: "500 mg",
    forme: "Gélule",
    labo: "Medi-Ocean",
    rubrique: "Antibiotiques",
    regime: "ordonnance",
    achat: 350,
    vente: 600,
    seuil: 48,
    unite: "gélule",
    emplacement: "C3",
    boite: { nom: "boîte", quantite: 12, prix: 6500 },
    lots: [
      [120, 20, "AM2405"],
      [36, 1, "AM2110"],
    ],
  },
  {
    nom: "Amoxicilline + Ac. clavulanique",
    dci: "Amoxicilline, acide clavulanique",
    dosage: "1 g",
    forme: "Comprimé",
    labo: "Medi-Ocean",
    rubrique: "Antibiotiques",
    regime: "ordonnance",
    achat: 9500,
    vente: 14500,
    emplacement: "C3",
    lots: [[8, 11, "AC1108"]],
  },
  {
    nom: "Artéméther-Luméfantrine",
    dci: "Artéméther, luméfantrine",
    dosage: "20/120 mg",
    forme: "Comprimé",
    labo: "Labo Tsara",
    rubrique: "Antipaludéens",
    regime: "ordonnance",
    achat: 3200,
    vente: 5000,
    seuil: 10,
    emplacement: "C1",
    lots: [[25, 7, "AL0703"]],
  },
  {
    nom: "Quinine",
    dci: "Quinine",
    dosage: "300 mg",
    forme: "Comprimé",
    labo: "Pharmalab",
    rubrique: "Antipaludéens",
    regime: "ordonnance",
    achat: 2100,
    vente: 3500,
    emplacement: "C1",
    lots: [
      [6, -1, "QN1902"],
      [14, 16, "QN2402"],
    ],
  },
  {
    nom: "Ibuprofène",
    dci: "Ibuprofène",
    dosage: "400 mg",
    forme: "Comprimé",
    labo: "Pharmalab",
    rubrique: "Antalgiques et anti-inflammatoires",
    achat: 1200,
    vente: 2000,
    emplacement: "A2",
    lots: [],
    sansDate: 30,
  },
  {
    nom: "Métronidazole",
    dci: "Métronidazole",
    dosage: "250 mg",
    forme: "Comprimé",
    labo: "Medi-Ocean",
    rubrique: "Antibiotiques",
    regime: "ordonnance",
    achat: 1500,
    vente: 2500,
    emplacement: "C4",
    lots: [[20, 5, "MZ0507"]],
  },
  {
    nom: "Cotrimoxazole",
    dci: "Sulfaméthoxazole, triméthoprime",
    dosage: "480 mg",
    forme: "Comprimé",
    labo: "Labo Tsara",
    rubrique: "Antibiotiques",
    regime: "ordonnance",
    achat: 1100,
    vente: 1800,
    seuil: 10,
    emplacement: "C4",
    lots: [[4, 3, "CT0302"]],
  },
  {
    nom: "SRO",
    dci: "Sels de réhydratation orale",
    dosage: "20,5 g",
    forme: "Sachet",
    labo: "Pharmalab",
    rubrique: "Médicaments",
    achat: 300,
    vente: 500,
    seuil: 30,
    emplacement: "D1",
    lots: [
      [40, 0, "SR1101"],
      [80, 18, "SR2505"],
    ],
  },
  {
    nom: "Zinc",
    dci: "Sulfate de zinc",
    dosage: "20 mg",
    forme: "Comprimé dispersible",
    labo: "Pharmalab",
    rubrique: "Médicaments",
    achat: 800,
    vente: 1300,
    emplacement: "D1",
    lots: [[22, 2, "ZN0201"]],
  },
  {
    nom: "Vitamine C",
    dci: "Acide ascorbique",
    dosage: "500 mg",
    forme: "Comprimé à croquer",
    labo: "Vita+",
    rubrique: "Vitamines et compléments",
    achat: 1500,
    vente: 2500,
    emplacement: "E1",
    lots: [[30, 2, "VC0204"]],
  },
  {
    nom: "Fer + Acide folique",
    dci: "Fer, acide folique",
    dosage: "60/0,4 mg",
    forme: "Comprimé",
    labo: "Vita+",
    rubrique: "Vitamines et compléments",
    achat: 1300,
    vente: 2000,
    emplacement: "E1",
    lots: [[35, 12, "FA1210"]],
  },
  {
    nom: "Insuline rapide",
    dci: "Insuline humaine",
    dosage: "100 UI/ml",
    forme: "Injectable",
    labo: "Medi-Ocean",
    rubrique: "Injectables et perfusions",
    regime: "liste_I",
    frais: true,
    achat: 18000,
    vente: 25000,
    seuil: 3,
    emplacement: "Frigo",
    lots: [[5, 4, "IN0409"]],
  },
  {
    nom: "Diazépam",
    dci: "Diazépam",
    dosage: "5 mg",
    forme: "Comprimé",
    labo: "Pharmalab",
    rubrique: "Médicaments",
    regime: "stupefiant",
    achat: 1600,
    vente: 2600,
    emplacement: "Coffre",
    lots: [[12, 10, "DZ1003"]],
  },
  {
    nom: "Oméprazole",
    dci: "Oméprazole",
    dosage: "20 mg",
    forme: "Gélule",
    labo: "Labo Tsara",
    rubrique: "Médicaments",
    regime: "ordonnance",
    achat: 2400,
    vente: 3800,
    emplacement: "A3",
    lots: [[16, 13, "OM1305"]],
  },
  {
    nom: "Salbutamol",
    dci: "Salbutamol",
    dosage: "100 µg/dose",
    forme: "Inhalateur",
    labo: "Medi-Ocean",
    rubrique: "Médicaments",
    regime: "ordonnance",
    achat: 9000,
    vente: 13500,
    seuil: 2,
    emplacement: "A4",
    lots: [[2, 6, "SB0611"]],
  },
  {
    nom: "Povidone iodée",
    dci: "Povidone iodée",
    dosage: "10 %",
    forme: "Solution",
    labo: "Pharmalab",
    rubrique: "Pommades et usage externe",
    achat: 3500,
    vente: 5500,
    emplacement: "F1",
    lots: [[10, 22, "PI2208"]],
  },
  {
    nom: "Compresses stériles",
    dci: "",
    dosage: "10 x 10 cm",
    forme: "Matériel",
    labo: "MediSup",
    rubrique: "Matériel médical et pansements",
    achat: 1200,
    vente: 2000,
    emplacement: "G1",
    lots: [[50, 36, "CS3601"]],
  },
  {
    nom: "Seringue",
    dci: "",
    dosage: "5 ml",
    forme: "Matériel",
    labo: "MediSup",
    rubrique: "Matériel médical et pansements",
    achat: 200,
    vente: 400,
    seuil: 50,
    emplacement: "G2",
    lots: [[30, 30, "SE3002"]],
  },
  {
    nom: "Lait 1er âge",
    dci: "",
    dosage: "400 g",
    forme: "Poudre",
    labo: "Bébé Vita",
    rubrique: "Bébé et maman",
    achat: 21000,
    vente: 28000,
    emplacement: "H1",
    lots: [[6, 5, "LB0508"]],
  },
  {
    nom: "Savon antiseptique",
    dci: "",
    dosage: "100 g",
    forme: "Pain",
    labo: "Hygia",
    rubrique: "Hygiène et soins",
    achat: 1500,
    vente: 2500,
    emplacement: "H2",
    lots: [],
    sansDate: 12,
  },
];

const PATIENTS = [
  ["Rakotomalala", "Jean"],
  ["Rasoanirina", "Marie"],
  ["Randrianarisoa", "Paul"],
  ["Razafy", "Hanta"],
];
const ORGANISMES: [string, number, string][] = [
  ["Assurance Fanilo", 80, "Convention 2026-14"],
  ["Mutuelle des Enseignants", 70, "MDE-58"],
  ["Société Vatolahy", 100, "Personnel"],
];

export function installer() {
  if (base.produits.length) return;
  const t = base.tables;
  const rubriques = [...new Set(MEDICAMENTS.map((m) => m.rubrique))];
  rubriques.forEach((nom, i) =>
    t.categories.push({
      id: `cat-${i}`,
      store_id: BOUTIQUE,
      nom,
      usage: "produit",
      actif: true,
      ordre: i * 10,
      parent_id: null,
    }),
  );
  t.suppliers.push(
    { id: "f1", store_id: BOUTIQUE, nom: "Grossiste Analamanga" },
    { id: "f2", store_id: BOUTIQUE, nom: "Dépôt Pharma Sud" },
  );
  for (const [nom, prenom] of PATIENTS)
    t.clients.push({
      id: id(),
      store_id: BOUTIQUE,
      nom,
      prenom,
      telephone: "034 12 345 67",
      note: prenom === "Marie" ? "Allergique à la pénicilline." : null,
      type_client: null,
      created_at: new Date().toISOString(),
    });
  for (const [nom, taux, convention] of ORGANISMES) {
    const c = {
      id: id(),
      store_id: BOUTIQUE,
      nom,
      prenom: null,
      telephone: null,
      type_client: "organisme",
      created_at: new Date().toISOString(),
    };
    t.clients.push(c);
    t.pharma_organismes.push({
      client_id: c.id,
      store_id: BOUTIQUE,
      taux,
      convention,
      actif: true,
    });
  }

  MEDICAMENTS.forEach((m, i) => {
    const pid = `med-${i}`;
    const stock = m.lots.reduce((n, [q]) => n + q, 0) + (m.sansDate ?? 0);
    const nom = m.dosage && !m.nom.includes(m.dosage) ? `${m.nom} ${m.dosage}` : m.nom;
    base.produits.push({
      id: pid,
      numero: `P${i + 1}`,
      designation: m.nom,
      variantSuffix: "",
      displayName: nom,
      prixAchat: m.achat,
      prixVenteDefaut: m.vente,
      fournisseur: "Grossiste Analamanga",
      stockInitial: stock,
      stockActuel: stock,
      stockReserve: 0,
      stockDisponible: stock,
      seuilAlerte: m.seuil ?? 5,
      sku: null,
      codeBarres: `6190000${String(i).padStart(5, "0")}`,
      categoryId: `cat-${rubriques.indexOf(m.rubrique)}`,
      supplierId: null,
      description: null,
      unite: m.unite ?? "boîte",
      tvaRate: null,
      stockMax: null,
      typeProduit: "revendu",
      statut: "actif",
      modePrix: "manuel",
      tauxMarge: null,
      conditionnements: m.boite
        ? [
            {
              id: `${pid}-b`,
              nom: m.boite.nom,
              quantite: m.boite.quantite,
              prixVente: m.boite.prix,
              prixAchat: null,
              codeBarres: null,
            },
          ]
        : [],
    });
    t.pharma_fiches.push({
      product_id: pid,
      store_id: BOUTIQUE,
      dci: m.dci || null,
      dosage: m.dosage || null,
      forme: m.forme,
      laboratoire: m.labo,
      emplacement: m.emplacement ?? null,
      regime: m.regime ?? "libre",
      conservation: m.frais ? "frais" : "ambiante",
      notes: m.regime === "ordonnance" ? "Respecter la durée du traitement." : null,
    });
    for (const [q, mois, numero] of m.lots) {
      const lot = nouveauLot({
        product_id: pid,
        numero_lot: numero,
        date_peremption:
          mois === null
            ? null
            : mois < 0
              ? finDeMois(mois)
              : mois === 0
                ? decaler(18)
                : finDeMois(mois),
        quantite: q,
        prix_achat_unit: m.achat,
        fournisseur: "Grossiste Analamanga",
        recu_le: decaler(-40),
      });
      t.pharma_lot_mouvements.push({
        id: id(),
        lot_id: lot.id,
        quantite: q,
        motif: "reception",
        cree_le: new Date(Date.now() - 40 * 86400000).toISOString(),
      });
    }
  });

  // Un mois de comptoir : des ventes chaque jour, certaines à crédit ou en tiers payant.
  const organismes = t.pharma_organismes;
  for (let j = 29; j >= 0; j--) {
    const jour = decaler(-j);
    const n = 3 + ((j * 7) % 5);
    for (let k = 0; k < n; k++) {
      const p = base.produits[(j * 5 + k * 3) % base.produits.length];
      if (p.stockActuel < 2) continue;
      const q = 1 + ((j + k) % 2);
      const org = k === 1 && j % 3 === 0 ? organismes[(j + k) % organismes.length] : null;
      const total = q * p.prixVenteDefaut;
      const part = org ? Math.round((total * org.taux) / 100) : 0;
      vendre({
        date: jour,
        vendeur: "Hanitra",
        clientCredit: org ? t.clients.find((c) => c.id === org.client_id)!.nom : null,
        clientId: org ? org.client_id : null,
        montantPaye: total - part,
        methode: k % 3 === 0 ? "mobile_money" : "especes",
        lignes: [{ productId: p.id, quantite: q, prixVenteUnit: p.prixVenteDefaut }],
      });
      const derniere = base.ventes[base.ventes.length - 1];
      if (org || (k === 2 && j % 4 === 0)) {
        const patient = t.clients[(j + k) % PATIENTS.length];
        t.pharma_ordonnances.push({
          id: id(),
          store_id: BOUTIQUE,
          numero: t.pharma_ordonnances.length + 1,
          date_delivrance: jour,
          patient_nom: nomClient(patient),
          patient_age: `${20 + ((j * 3) % 50)} ans`,
          patient_telephone: patient.telephone,
          patient_client_id: patient.id,
          prescripteur: ["Dr Ravelo", "Dr Andriamasy", "Dr Rabe"][j % 3],
          date_prescription: jour,
          organisme_id: org?.client_id ?? null,
          matricule: org ? `MAT-${1000 + j}` : null,
          part_organisme: part,
          ticket_id: derniere.ticketId,
          notes: null,
          cree_le: new Date(Date.now() - j * 86400000).toISOString(),
        });
      }
    }
  }
  // Quelques achats passés, pour la liste des livraisons.
  base.achats.push(
    ...base.produits.slice(0, 6).map((p, i) => ({
      id: id(),
      numero: `A${i + 1}`,
      date: decaler(-40 + i),
      productId: p.id,
      designation: p.displayName,
      quantite: 20,
      prixAchatUnit: p.prixAchat,
      totalAchat: 20 * p.prixAchat,
      fournisseur: i % 2 ? "Dépôt Pharma Sud" : "Grossiste Analamanga",
      supplierId: null,
      impactTresorerie: -20 * p.prixAchat,
      montantPaye: i === 3 ? 0 : 20 * p.prixAchat,
      soldeDu: i === 3 ? 20 * p.prixAchat : 0,
      statutPaiement: i === 3 ? "Impayé" : "Payé",
      dateEcheance: null,
    })),
  );
  changer();
}
