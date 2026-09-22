import type { Product, Sale, StoreSettings } from "../../../types";
import type { Database } from "../../../lib/database.types";

/**
 * DES DONNÉES VRAIES, PAS DES DONNÉES VRAISEMBLABLES
 *
 * Tout ce qui suit est relevé sur la base de production de « Ma
 * Boutique » le 21 septembre 2026, en lecture seule. Les noms de
 * produits mal orthographiés (« Huille », « tota ,e »), l'unité
 * absente sur la plupart des fiches, la référence manquante sur les
 * ventes anciennes, le client saisi en texte libre : rien n'est
 * arrangé.
 *
 * C'est délibéré. Un jeu d'essai propre ne prouve que la mise en page
 * d'une boutique imaginaire. Les cas qui cassent un document sont
 * précisément ceux-là — un nom de produit sans référence, une unité
 * nulle, un client qui n'est qu'un prénom.
 *
 * Ce fichier sert aux tests ET au banc d'aperçu. Il n'est importé par
 * aucun écran de l'application.
 */

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Paiement = Database["public"]["Tables"]["payments"]["Row"];

/** Les réglages réels de la boutique : TVA à 20 %, NIF renseigné. */
export const BOUTIQUE: StoreSettings = {
  storeName: "Ma Boutique",
  subtitle: "Système boutique",
  suppliers: [],
  logoUrl: undefined,
  address: "105 Ambohidratrimo",
  phone: "0389723412",
  email: "balisamamamy2003@gmail.com",
  nifStat: "12739-27391ue-62",
  receiptFooter: "Merci pour votre confiance, sans repris après le vente",
  currencySymbol: "Ar",
  tvaRate: 20,
};

/** Une boutique qui n'a rien rempli — le cas de trois des cinq en base. */
export const BOUTIQUE_NUE: StoreSettings = {
  storeName: "Boutique",
  subtitle: "",
  suppliers: [],
  address: "",
  phone: "",
  email: "",
  nifStat: "",
  currencySymbol: "Ar",
  tvaRate: 0,
};

const produit = (id: string, numero: string, designation: string, unite: string | null = null) =>
  ({
    id,
    numero,
    designation,
    variantSuffix: "",
    displayName: designation,
    prixAchat: 0,
    prixVenteDefaut: 0,
    fournisseur: "",
    stockInitial: 0,
    stockActuel: 0,
    stockReserve: 0,
    stockDisponible: 0,
    seuilAlerte: 0,
    sku: null,
    codeBarres: null,
    categoryId: null,
    supplierId: null,
    description: null,
    unite,
    tvaRate: null,
    stockMax: null,
    typeProduit: "bien",
    statut: "actif",
  }) satisfies Product;

export const PRODUITS: Product[] = [
  produit("p-024", "P024", "setreela"),
  produit("p-022", "P022", "chocolat", "pièce"),
  produit("p-019", "P019", "Vera"),
  produit("p-007", "P007", "parfum"),
];

const vente = (v: Partial<Sale> & Pick<Sale, "id" | "numero" | "date">) =>
  ({
    productId: "",
    designation: "",
    quantite: 1,
    prixVenteUnit: 0,
    totalVente: 0,
    commission: 0,
    prixAchatUnitRef: 0,
    totalAchatRef: 0,
    margeTotale: 0,
    vendeur: "Lanto",
    montantPaye: 0,
    montantRembourse: 0,
    soldeDu: 0,
    statutCredit: "Payé",
    ...v,
  }) satisfies Sale;

/** V026 — une ligne, payée, produit référencé, sans unité ni client. */
export const V026: Sale = vente({
  id: "s-026",
  numero: "V026",
  date: "2026-09-19",
  ticketId: "9f27fced-cb67-4895-9b83-9d5dcfe6d864",
  productId: "p-024",
  designation: "setreela",
  quantite: 2,
  prixVenteUnit: 1500,
  totalVente: 3000,
  montantPaye: 3000,
  soldeDu: 0,
});

/**
 * V024 — trois cent mille ariary, client en texte libre, et un produit
 * qui n'est plus au catalogue : sa référence est donc introuvable.
 */
export const V024: Sale = vente({
  id: "s-024",
  numero: "V024",
  date: "2026-09-13",
  ticketId: "fbb598f8-0ccb-47d6-b594-11ecbadded9a",
  productId: "p-disparu",
  designation: "Huille",
  quantite: 20,
  prixVenteUnit: 15000,
  totalVente: 300000,
  clientCredit: "Dimby",
  montantPaye: 300000,
  soldeDu: 0,
});

/** V025 — la seule vente dont le produit porte une unité. */
export const V025: Sale = vente({
  id: "s-025",
  numero: "V025",
  date: "2026-09-14",
  productId: "p-022",
  designation: "chocolat",
  quantite: 3,
  prixVenteUnit: 1500,
  totalVente: 4500,
  montantPaye: 4500,
  soldeDu: 0,
});

/**
 * Un panier de trois lignes.
 *
 * Aucun n'existe encore en base — tous les `ticket_id` de production
 * sont uniques. Il est construit à partir des mêmes ventes réelles,
 * reliées par un ticket commun, parce qu'un document doit savoir
 * additionner avant que le premier vrai panier n'arrive.
 */
export const TICKET_TROIS_LIGNES: Sale[] = [
  { ...V024, ticketId: "t-commun", montantPaye: 100000, soldeDu: 200000, statutCredit: "Partiel" },
  { ...V025, ticketId: "t-commun", montantPaye: 0, soldeDu: 4500, statutCredit: "Impayé" },
  { ...V026, ticketId: "t-commun", montantPaye: 0, soldeDu: 3000, statutCredit: "Impayé" },
];

/** La fiche client réelle la plus complète de la boutique. */
export const CLIENT: Client = {
  id: "c-1",
  store_id: "a59f9f13-e48d-4683-9c8d-dd6a506829c2",
  created_by: null,
  nom: "Balsama",
  prenom: "Richie",
  entreprise: null,
  adresse: "Analamahitsy",
  ville: "Antananarivo",
  pays: null,
  telephone: "0328740631",
  email: "lastrichie2003@gmail.com",
  note: null,
  type_client: null,
  statut: "actif",
  champs_perso: {},
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

/** Le règlement de V026 : espèces, comme les quarante-cinq précédents. */
export const PAIEMENT: Paiement = {
  id: "pay-045",
  numero: "PAY045",
  store_id: "a59f9f13-e48d-4683-9c8d-dd6a506829c2",
  order_id: null,
  sale_id: "s-026",
  recorded_by: null,
  montant: 3000,
  methode: "especes",
  reference: null,
  note: null,
  idempotency_key: null,
  created_at: "2026-09-19T18:30:02.966851Z",
};
