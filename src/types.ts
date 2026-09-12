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
  // Ajoutes a l etape 4. Purement descriptifs : ils ne touchent ni au
  // stock ni au prix, et s ecrivent donc hors du chemin RPC.
  sku: string | null;
  codeBarres: string | null;
  categoryId: string | null;
  supplierId: string | null;
  description: string | null;
  unite: string | null;
  tvaRate: number | null;
  stockMax: number | null;
  typeProduit: string;
  statut: string;
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
  fournisseur: string; // Nom saisi a la main, conserve
  supplierId: string | null; // Fiche fournisseur, quand l achat y est rattache
  impactTresorerie: number;
  // Ajoutes a l etape 5. Entretenus par la base : montantPaye est la
  // somme des reglements verses, les deux autres en decoulent.
  montantPaye: number;
  soldeDu: number;
  statutPaiement: string;
  dateEcheance: string | null;
  /** Qui a enregistre la ligne. Sert au journal d activite. */
  auteurId?: string | null;
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
  // Ajoute a l etape 6. Les lignes passees ensemble au comptoir partagent
  // ce lien. Nul = vendue seule, ce qui est le cas de toutes les ventes
  // enregistrees avant cette etape.
  ticketId?: string | null;
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
  // Ajoutes a l etape 9. Le poste dit a quoi l argent a servi, le
  // prestataire a qui il a ete verse. Nuls = depense non rangee, ce
  // qui est le cas de toutes celles enregistrees avant.
  categoryId?: string | null;
  providerId?: string | null;
  /** Le chemin de la photo du recu dans le seau documents. */
  justificatif?: string | null;
}

export interface CapitalApport {
  id: string;
  date: string; // YYYY-MM-DD
  montant: number;
  source: string; // e.g. "Apport Associé", "Injection Trésorerie"
  note?: string;
  /** Qui a enregistre la ligne. Sert au journal d activite. */
  auteurId?: string | null;
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
  | "agenda"
  | "vue_equipe"
  | "taches"
  | "rappels"
  | "devis"
  | "livraisons"
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
  | "fournisseurs"
  | "prestataires"
  | "paiements";
