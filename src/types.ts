export type LocaleSetting = "FR" | "US";

export interface Product {
  id: string; // UUID interne (relations, clé primaire)
  numero: string; // ID court d'affichage, e.g. P001, P002
  designation: string; // Base name e.g. "kapa"
  variantSuffix: string; // Subscript price e.g. "₁₀₀₀" or "[Fournisseur A]"
  displayName: string; // e.g. "kapa₁₀₀₀"
  prixAchat: number;
  prixVenteDefaut: number; // Default selling price
  fournisseur: string;
  stockInitial: number;
  stockActuel: number;
  stockReserve: number;
  stockDisponible: number;
  seuilAlerte: number;
}

export interface Purchase {
  id: string; // UUID interne
  numero: string; // ID court d'affichage, e.g. ACH001
  date: string; // YYYY-MM-DD
  productId: string;
  designation: string;
  quantite: number;
  prixAchatUnit: number;
  totalAchat: number;
  fournisseur: string;
  impactTresorerie: number;
}

export interface Sale {
  id: string; // UUID interne
  numero: string; // ID court d'affichage, e.g. V001
  date: string; // YYYY-MM-DD
  productId: string;
  designation: string;
  quantite: number;
  prixVenteUnit: number; // Manually editable per sale
  totalVente: number;
  prixAchatUnitRef: number;
  totalAchatRef: number;
  margeTotale: number;
  vendeur: string; // Selected seller
  clientCredit?: string; // Optional credit client (nom libre)
  clientId?: string | null; // Optional link to a Client record
  montantPaye: number;
  montantRembourse: number;
  soldeDu: number;
  statutCredit: "Payé" | "Partiel" | "Impayé";
}

export interface Payment {
  id: string; // UUID interne
  numero: string; // ID court d'affichage, e.g. PAY001
  orderId: string | null;
  saleId: string | null;
  montant: number;
  methode: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export interface Expense {
  id: string; // UUID interne
  numero: string; // ID court d'affichage, e.g. DEP001
  date: string; // YYYY-MM-DD
  vendeur: string;
  type: "Achat de stock" | "Retrait d'argent" | "Autre dépense";
  montant: number;
  note: string;
  impactTresorerieGlobale: number;
}

export interface CapitalApport {
  id: string;
  date: string; // YYYY-MM-DD
  montant: number;
  source: string; // e.g. "Apport Associé", "Injection Trésorerie"
  note?: string;
}

export interface Seller {
  id: string;
  nom: string;
  statut: "Actif" | "Inactif";
  totalVentesMontant: number;
  totalVentesNombre: number;
  totalDepenses: number;
  soldeNetEnPoche: number; // Ventes encaissées - Dépenses
}

export interface CapitalSummary {
  capitalInitial: number;
  apportsTotal: number;
  ventesTotalEncaisse: number;
  achatsTotal: number;
  depensesVendeursTotal: number;
  tresorerieGlobaleActuelle: number;
  seuilAlerteTresorerie: number;
}

export interface StoreSettings {
  storeName: string;
  subtitle: string;
  suppliers: string[];
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  nifStat?: string;
  receiptFooter?: string;
  currencySymbol?: string;
  tvaRate?: number;
  enablePinSecurity?: boolean;
  masterPin?: string;
}

export type ActiveTab =
  | "dashboard"
  | "capital"
  | "produits"
  | "achats"
  | "ventes"
  | "vendeurs"
  | "depenses"
  | "statistiques"
  | "historique"
  | "rapports"
  | "settings"
  | "nouveaux_produits"
  | "apports"
  | "ventes_jour"
  | "ventes_mois"
  | "commandes"
  | "clients"
  | "paiements";