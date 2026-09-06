import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import type { Sale as AppSale } from "../types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type CapitalApport = Database["public"]["Tables"]["capital_apports"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type Provider = Database["public"]["Tables"]["providers"]["Row"];
type ProviderService = Database["public"]["Tables"]["provider_services"]["Row"];
type CustomField = Database["public"]["Tables"]["custom_field_definitions"]["Row"];

/**
 * Un message lisible plutôt que le jargon de Postgres.
 *
 * La base refuse deux fournisseurs — ou deux prestataires — de même nom
 * dans une boutique, par un index unique posé sur (store_id, lower(nom)).
 * Sans cette traduction, l'utilisateur lirait « duplicate key value
 * violates unique constraint idx_suppliers_store_nom », ce qui ne lui dit
 * ni ce qui s'est passé ni quoi faire.
 */
const traduireErreurTiers = (
  error: { code?: string; message: string } | null,
  tiers: "fournisseur" | "prestataire",
): string | null => {
  if (!error) return null;
  if (error.code === "23505") {
    return `Un ${tiers} porte déjà ce nom dans cette boutique.`;
  }
  return error.message;
};

/**
 * Les refus de la base sur un champ personnalisé, dits en français.
 *
 * Trois garde-fous peuvent se déclencher : la clé déjà prise sur la même
 * entité, la forme de la clé, et une liste de choix vide. Le message brut
 * de Postgres nomme la contrainte, ce qui ne sert qu'à celui qui l'a
 * écrite.
 */
const traduireErreurChampPerso = (
  error: { code?: string; message: string } | null,
): string | null => {
  if (!error) return null;
  if (error.code === "23505") {
    return "Un champ porte déjà ce nom pour cette fiche.";
  }
  if (error.message?.includes("custom_field_liste_a_des_options")) {
    return "Un champ de type liste doit proposer au moins un choix.";
  }
  if (error.message?.includes("cle_check") || error.message?.includes("_cle_")) {
    return "Le nom technique du champ est invalide.";
  }
  if (error.code === "42501") {
    return "Seul le propriétaire de la boutique peut définir des champs.";
  }
  return error.message;
};

export interface StoreData {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  orders: Order[];
  clients: Client[];
  apports: CapitalApport[];
  payments: Payment[];
  suppliers: Supplier[];
  providers: Provider[];
  providerServices: ProviderService[];
  customFields: CustomField[];
  loading: boolean;
  error: string | null;

  // CRUD Products
  addProduct: (
    data: Omit<Database["public"]["Tables"]["products"]["Insert"], "store_id" | "owner_id">,
  ) => Promise<{ error: string | null }>;

  updateProduct: (
    id: string,
    data: {
      designation: string;
      prixAchat: number;
      prixVenteDefaut: number;
      fournisseur: string;
      seuilAlerte: number;
    },
  ) => Promise<{ error: string | null }>;

  // Suppression d'un ou plusieurs produits en une seule fois (même fonction
  // pour une suppression unique). Ne touche jamais à l'historique des
  // achats/ventes/commandes (liens automatiquement mis à NULL en base).
  deleteProducts: (ids: string[]) => Promise<{ error: string | null }>;

  // CRUD Sales
  // PHASE 1 : addSale/updateSale/deleteSale passent désormais par des fonctions
  // RPC PostgreSQL (create_sale / update_sale_quantity / delete_sale) qui
  // verrouillent la ligne produit (FOR UPDATE) et appliquent la variation de
  // stock de façon atomique. Le stock n'est plus jamais calculé côté React.
  addSale: (data: {
    date: string;
    product_id: string;
    quantite: number;
    prix_vente_unit: number;
    vendeur: string;
    client_credit?: string | null;
    client_id?: string | null;
    montant_paye_initial?: number;
    methode?: string | null;
  }) => Promise<{ sale: AppSale | null; error: string | null }>;

  updateSale: (
    id: string,
    data: {
      quantite: number;
      total_vente?: number | null;
      client_credit?: string | null;
      client_id?: string | null;
    },
  ) => Promise<{ error: string | null }>;

  deleteSale: (id: string) => Promise<{ error: string | null }>;

  addPaymentToSale: (
    saleId: string,
    data: Omit<
      Database["public"]["Tables"]["payments"]["Insert"],
      "sale_id" | "order_id" | "store_id" | "recorded_by"
    >,
  ) => Promise<{ error: string | null }>;

  // Remboursement traçable : crée une ligne dans `refunds` (jamais de DELETE
  // sur `payments`). Bloqué côté base si montant > montant remboursable restant.
  refundSale: (
    saleId: string,
    montant: number,
    reason?: string,
  ) => Promise<{ error: string | null }>;

  // CRUD Purchases
  addPurchase: (data: {
    date: string;
    product_id: string | null;
    new_product?: {
      designation: string;
      variant_suffix: string;
      display_name: string;
      prix_vente_defaut: number;
      seuil_alerte: number;
    } | null;
    quantite: number;
    prix_achat_unit: number;
    fournisseur: string;
  }) => Promise<{ error: string | null }>;

  deletePurchase: (id: string) => Promise<{ error: string | null }>;

  // CRUD Expenses
  addExpense: (
    data: Omit<Database["public"]["Tables"]["expenses"]["Insert"], "store_id" | "owner_id">,
  ) => Promise<{ error: string | null }>;

  updateExpense: (
    id: string,
    data: Database["public"]["Tables"]["expenses"]["Update"],
  ) => Promise<{ error: string | null }>;

  deleteExpense: (id: string) => Promise<{ error: string | null }>;

  // CRUD Orders
  // PHASE 1 : commande + lignes + réservation de stock = une seule opération
  // atomique côté base (RPC create_order_with_items). Le statut (livraison /
  // annulation) passe par set_order_status, idempotent (double-clic sans effet).
  addOrder: (
    orderData: {
      client_id: string | null;
      note: string | null;
      date_livraison: string | null;
    },
    items: {
      product_id: string | null;
      designation: string;
      quantite: number;
      prix_vente_unit: number;
      prix_achat_unit: number;
    }[],
  ) => Promise<{ order: Order | null; error: string | null }>;

  updateOrder: (
    id: string,
    data: {
      statut_commande: Database["public"]["Enums"]["order_status"];
    },
  ) => Promise<{ error: string | null }>;

  deleteOrder: (id: string) => Promise<{ error: string | null }>;

  addPaymentToOrder: (
    orderId: string,
    data: Omit<
      Database["public"]["Tables"]["payments"]["Insert"],
      "order_id" | "sale_id" | "store_id" | "recorded_by"
    >,
  ) => Promise<{ error: string | null }>;

  // Remboursement traçable : crée une ligne dans `refunds` (jamais de DELETE
  // sur `payments`). Le paiement d'origine reste visible dans l'historique.
  // Bloqué côté base si montant > montant remboursable restant (paiements - remboursements déjà faits).
  refundOrder: (
    orderId: string,
    montant: number,
    reason?: string,
  ) => Promise<{ error: string | null }>;

  // CRUD Clients
  addClient: (
    data: Omit<Database["public"]["Tables"]["clients"]["Insert"], "store_id" | "created_by">,
  ) => Promise<{ client: Client | null; error: string | null }>;

  updateClient: (
    id: string,
    data: Database["public"]["Tables"]["clients"]["Update"],
  ) => Promise<{ error: string | null }>;

  deleteClient: (id: string) => Promise<{ error: string | null }>;

  // CRUD Fournisseurs
  addSupplier: (
    data: Omit<Database["public"]["Tables"]["suppliers"]["Insert"], "store_id" | "created_by">,
  ) => Promise<{ supplier: Supplier | null; error: string | null }>;

  updateSupplier: (
    id: string,
    data: Database["public"]["Tables"]["suppliers"]["Update"],
  ) => Promise<{ error: string | null }>;

  deleteSupplier: (id: string) => Promise<{ error: string | null }>;

  // CRUD Prestataires
  addProvider: (
    data: Omit<Database["public"]["Tables"]["providers"]["Insert"], "store_id" | "created_by">,
  ) => Promise<{ provider: Provider | null; error: string | null }>;

  updateProvider: (
    id: string,
    data: Database["public"]["Tables"]["providers"]["Update"],
  ) => Promise<{ error: string | null }>;

  deleteProvider: (id: string) => Promise<{ error: string | null }>;

  addProviderService: (
    providerId: string,
    data: Omit<
      Database["public"]["Tables"]["provider_services"]["Insert"],
      "store_id" | "created_by" | "provider_id"
    >,
  ) => Promise<{ error: string | null }>;

  deleteProviderService: (id: string) => Promise<{ error: string | null }>;

  // Champs personnalisés — définir la structure est réservé au
  // propriétaire, la RLS le vérifie aussi côté base.
  addCustomField: (
    data: Omit<
      Database["public"]["Tables"]["custom_field_definitions"]["Insert"],
      "store_id" | "created_by"
    >,
  ) => Promise<{ error: string | null }>;

  updateCustomField: (
    id: string,
    data: Database["public"]["Tables"]["custom_field_definitions"]["Update"],
  ) => Promise<{ error: string | null }>;

  deleteCustomField: (id: string) => Promise<{ error: string | null }>;

  // Apports
  addApport: (
    data: Omit<Database["public"]["Tables"]["capital_apports"]["Insert"], "store_id" | "owner_id">,
  ) => Promise<{ error: string | null }>;

  deleteApport: (id: string) => Promise<{ error: string | null }>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useStoreData(storeId: string | null, userId: string | null): StoreData {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [apports, setApports] = useState<CapitalApport[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerServices, setProviderServices] = useState<ProviderService[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!storeId) {
      setProducts([]);
      setSales([]);
      setPurchases([]);
      setExpenses([]);
      setOrders([]);
      setClients([]);
      setApports([]);
      setPayments([]);
      setSuppliers([]);
      setProviders([]);
      setProviderServices([]);
      setCustomFields([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        productsRes,
        salesRes,
        purchasesRes,
        expensesRes,
        ordersRes,
        clientsRes,
        apportsRes,
        paymentsRes,
        suppliersRes,
        providersRes,
        providerServicesRes,
        customFieldsRes,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),

        supabase
          .from("sales")
          .select("*")
          .eq("store_id", storeId)
          .order("date", { ascending: false }),

        supabase
          .from("purchases")
          .select("*")
          .eq("store_id", storeId)
          .order("date", { ascending: false }),

        supabase
          .from("expenses")
          .select("*")
          .eq("store_id", storeId)
          .order("date", { ascending: false }),

        supabase
          .from("orders")
          .select("*, client:clients(*), items:order_items(*)")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),

        supabase.from("clients").select("*").eq("store_id", storeId).order("nom"),

        supabase
          .from("capital_apports")
          .select("*")
          .eq("store_id", storeId)
          .order("date", { ascending: false }),

        supabase
          .from("payments")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false }),

        supabase.from("suppliers").select("*").eq("store_id", storeId).order("nom"),

        supabase.from("providers").select("*").eq("store_id", storeId).order("nom"),

        supabase.from("provider_services").select("*").eq("store_id", storeId).order("libelle"),

        supabase
          .from("custom_field_definitions")
          .select("*")
          .eq("store_id", storeId)
          .order("ordre"),
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (salesRes.data) setSales(salesRes.data);
      if (purchasesRes.data) setPurchases(purchasesRes.data);
      if (expensesRes.data) setExpenses(expensesRes.data);
      if (ordersRes.data) setOrders(ordersRes.data as Order[]);
      if (clientsRes.data) setClients(clientsRes.data);
      if (apportsRes.data) setApports(apportsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (providersRes.data) setProviders(providersRes.data);
      if (providerServicesRes.data) setProviderServices(providerServicesRes.data);
      if (customFieldsRes.data) setCustomFields(customFieldsRes.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAll();
  }, [storeId, fetchAll]);

  // PRODUCTS
  const addProduct = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `product-${Date.now()}-${Math.random()}`;

      const { error } = await supabase.rpc("create_product", {
        p_store_id: storeId,
        p_designation: data.designation,
        p_prix_achat: data.prix_achat,
        p_prix_vente_defaut: data.prix_vente_defaut,
        p_fournisseur: data.fournisseur ?? "",
        p_stock_initial: data.stock_initial ?? data.stock_actuel ?? 0,
        p_seuil_alerte: data.seuil_alerte ?? 0,
        p_variant_suffix: data.variant_suffix ?? "",
        p_display_name: data.display_name ?? data.designation,
        p_idempotency_key: idempotencyKey,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const updateProduct = useCallback(
    async (
      id: string,
      data: {
        designation: string;
        prixAchat: number;
        prixVenteDefaut: number;
        fournisseur: string;
        seuilAlerte: number;
      },
    ) => {
      const { error } = await supabase.rpc("update_product", {
        p_product_id: id,
        p_designation: data.designation,
        p_prix_achat: data.prixAchat,
        p_prix_vente_defaut: data.prixVenteDefaut,
        p_fournisseur: data.fournisseur,
        p_seuil_alerte: data.seuilAlerte,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const deleteProducts = useCallback(
    async (ids: string[]) => {
      const { error } = await supabase.rpc("delete_products", {
        p_product_ids: ids,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // SALES — RPC atomiques (stock verrouillé côté base, jamais calculé en React)
  const addSale = useCallback(
    async (data: any) => {
      if (!storeId || !userId) {
        return { sale: null, error: "Non autorisé" };
      }

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `sale-${Date.now()}-${Math.random()}`;

      const { data: result, error } = await supabase.rpc("create_sale", {
        p_store_id: storeId,
        p_date: data.date,
        p_product_id: data.product_id,
        p_quantite: data.quantite,
        p_prix_vente_unit: data.prix_vente_unit,
        p_vendeur: data.vendeur,
        p_client_credit: data.client_credit ?? null,
        p_client_id: data.client_id ?? null,
        p_montant_paye_initial: data.montant_paye_initial ?? 0,
        p_methode: data.methode ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        return {
          sale: null,
          error: error.message,
        };
      }

      if (!result) {
        return {
          sale: null,
          error: "La vente a été créée mais aucune donnée n'a été retournée.",
        };
      }

      const row = result as Database["public"]["Tables"]["sales"]["Row"];

      const sale: AppSale = {
        id: row.id,
        numero: row.numero ?? "",
        date: row.date,
        productId: row.product_id ?? data.product_id,
        designation: row.designation,
        quantite: row.quantite,
        prixVenteUnit: row.prix_vente_unit,
        totalVente: row.total_vente,
        prixAchatUnitRef: row.prix_achat_unit_ref,
        totalAchatRef: row.total_achat_ref,
        margeTotale: row.marge_totale,
        vendeur: row.vendeur,
        clientCredit: row.client_credit ?? undefined,
        clientId: row.client_id,
        montantPaye: row.montant_paye,
        montantRembourse: row.montant_rembourse,
        soldeDu: row.solde_du,
        statutCredit: row.statut_credit as AppSale["statutCredit"],
      };

      fetchAll();

      return {
        sale,
        error: null,
      };
    },
    [storeId, userId, fetchAll],
  );

  const updateSale = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.rpc("update_sale_quantity", {
        p_sale_id: id,
        p_new_quantite: data.quantite,
        p_new_total_vente: data.total_vente ?? null,
        p_client_credit: data.client_credit ?? null,
        p_client_id: data.client_id ?? null,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const deleteSale = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_sale", {
        p_sale_id: id,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // PURCHASES — RPC atomique : achat + (création produit ou incrément stock) + mouvement de stock
  const addPurchase = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `purchase-${Date.now()}-${Math.random()}`;

      const { error } = await supabase.rpc("add_purchase", {
        p_store_id: storeId,
        p_date: data.date,
        p_product_id: data.product_id ?? null,
        p_new_designation: data.new_product?.designation ?? null,
        p_new_variant_suffix: data.new_product?.variant_suffix ?? null,
        p_new_display_name: data.new_product?.display_name ?? null,
        p_new_prix_vente_defaut: data.new_product?.prix_vente_defaut ?? null,
        p_new_seuil_alerte: data.new_product?.seuil_alerte ?? null,
        p_quantite: data.quantite,
        p_prix_achat_unit: data.prix_achat_unit,
        p_fournisseur: data.fournisseur,
        p_idempotency_key: idempotencyKey,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const deletePurchase = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_purchase", {
        p_purchase_id: id,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // EXPENSES
  const addExpense = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const { error } = await supabase
        .from("expenses")
        .insert({ ...data, store_id: storeId, owner_id: userId });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const updateExpense = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // ORDERS — RPC atomique : commande + lignes + réservation de stock en une seule opération.
  // Si le stock disponible est insuffisant pour un article, TOUTE la commande est rejetée
  // (aucun état partiel : ni commande, ni lignes, ni réservation).
  const addOrder = useCallback(
    async (orderData: any, items: any[]) => {
      if (!storeId || !userId) {
        return { order: null, error: "Non autorisé" };
      }

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `order-${Date.now()}-${Math.random()}`;

      const { data: result, error } = await supabase.rpc("create_order_with_items", {
        p_store_id: storeId,
        p_client_id: orderData.client_id ?? null,
        p_note: orderData.note ?? null,
        p_date_livraison: orderData.date_livraison ?? null,
        p_items: items,
        p_idempotency_key: idempotencyKey,
      });

      if (error) return { order: null, error: error.message };

      fetchAll();

      return {
        order: (result as unknown as Order) ?? null,
        error: null,
      };
    },
    [storeId, userId, fetchAll],
  );

  // Transition de statut (livraison / annulation) : idempotente côté base
  // (un double-clic ou une répétition n'a aucun effet supplémentaire), et
  // gère elle-même la réservation/le stock physique selon la transition.
  const updateOrder = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.rpc("set_order_status", {
        p_order_id: id,
        p_new_status: data.statut_commande,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // Suppression volontaire d'une commande, quel que soit son statut.
  // Ne touche JAMAIS au stock (le produit reste considéré comme sorti
  // s'il avait déjà été livré) — sert uniquement à nettoyer la liste.
  const deleteOrder = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_order", {
        p_order_id: id,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const addPaymentToOrder = useCallback(
    async (orderId: string, data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const idempotencyKey =
        data.idempotency_key ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `payment-order-${Date.now()}-${Math.random()}`);

      const { error } = await supabase.rpc("add_payment", {
        p_store_id: storeId,
        p_order_id: orderId,
        p_sale_id: null,
        p_montant: data.montant,
        p_methode: data.methode ?? "especes",
        p_reference: data.reference ?? null,
        p_note: data.note ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  // Remboursement traçable : le paiement d'origine n'est JAMAIS supprimé.
  // Bloqué côté base si le montant dépasse ce qui reste remboursable.
  const refundOrder = useCallback(
    async (orderId: string, montant: number, reason?: string) => {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `refund-order-${Date.now()}-${Math.random()}`;

      const { error } = await supabase.rpc("refund_order", {
        p_order_id: orderId,
        p_montant: montant,
        p_reason: reason ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const addPaymentToSale = useCallback(
    async (saleId: string, data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const idempotencyKey =
        data.idempotency_key ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `payment-sale-${Date.now()}-${Math.random()}`);

      const { error } = await supabase.rpc("add_payment", {
        p_store_id: storeId,
        p_order_id: null,
        p_sale_id: saleId,
        p_montant: data.montant,
        p_methode: data.methode ?? "especes",
        p_reference: data.reference ?? null,
        p_note: data.note ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const refundSale = useCallback(
    async (saleId: string, montant: number, reason?: string) => {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `refund-sale-${Date.now()}-${Math.random()}`;

      const { error } = await supabase.rpc("refund_sale", {
        p_sale_id: saleId,
        p_montant: montant,
        p_reason: reason ?? null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        return { error: error.message };
      }

      // Recharger toutes les données après le remboursement
      await fetchAll();

      return { error: null };
    },
    [fetchAll],
  );
  // CLIENTS
  const addClient = useCallback(
    async (data: any) => {
      if (!storeId || !userId) {
        return { client: null, error: "Non autorisé" };
      }

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          ...data,
          store_id: storeId,
          created_by: userId,
        })
        .select("*")
        .single();

      if (!error) fetchAll();

      return {
        client: client ?? null,
        error: error?.message ?? null,
      };
    },
    [storeId, userId, fetchAll],
  );

  const updateClient = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.from("clients").update(data).eq("id", id);

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // FOURNISSEURS
  const addSupplier = useCallback(
    async (data: any) => {
      if (!storeId || !userId) {
        return { supplier: null, error: "Non autorisé" };
      }

      const { data: supplier, error } = await supabase
        .from("suppliers")
        .insert({ ...data, store_id: storeId, created_by: userId })
        .select("*")
        .single();

      if (!error) fetchAll();

      return { supplier: supplier ?? null, error: traduireErreurTiers(error, "fournisseur") };
    },
    [storeId, userId, fetchAll],
  );

  const updateSupplier = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.from("suppliers").update(data).eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurTiers(error, "fournisseur") };
    },
    [fetchAll],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurTiers(error, "fournisseur") };
    },
    [fetchAll],
  );

  // PRESTATAIRES
  const addProvider = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { provider: null, error: "Non autorisé" };
      const { data: provider, error } = await supabase
        .from("providers")
        .insert({ ...data, store_id: storeId, created_by: userId })
        .select("*")
        .single();
      if (!error) fetchAll();
      return { provider: provider ?? null, error: traduireErreurTiers(error, "prestataire") };
    },
    [storeId, userId, fetchAll],
  );

  const updateProvider = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.from("providers").update(data).eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurTiers(error, "prestataire") };
    },
    [fetchAll],
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("providers").delete().eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurTiers(error, "prestataire") };
    },
    [fetchAll],
  );

  const addProviderService = useCallback(
    async (providerId: string, data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };
      const { error } = await supabase.from("provider_services").insert({
        ...data,
        provider_id: providerId,
        store_id: storeId,
        created_by: userId,
      });
      if (!error) fetchAll();
      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const deleteProviderService = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("provider_services").delete().eq("id", id);
      if (!error) fetchAll();
      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  // CHAMPS PERSONNALISÉS
  const addCustomField = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };
      const { error } = await supabase.from("custom_field_definitions").insert({
        ...data,
        store_id: storeId,
        created_by: userId,
      });
      if (!error) fetchAll();
      return { error: traduireErreurChampPerso(error) };
    },
    [storeId, userId, fetchAll],
  );

  const updateCustomField = useCallback(
    async (id: string, data: any) => {
      const { error } = await supabase.from("custom_field_definitions").update(data).eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurChampPerso(error) };
    },
    [fetchAll],
  );

  const deleteCustomField = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
      if (!error) fetchAll();
      return { error: traduireErreurChampPerso(error) };
    },
    [fetchAll],
  );

  // APPORTS
  const addApport = useCallback(
    async (data: any) => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const { error } = await supabase.from("capital_apports").insert({
        ...data,
        store_id: storeId,
        owner_id: userId,
      });

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [storeId, userId, fetchAll],
  );

  const deleteApport = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("capital_apports").delete().eq("id", id);

      if (!error) fetchAll();

      return { error: error?.message ?? null };
    },
    [fetchAll],
  );

  return {
    products,
    sales,
    purchases,
    expenses,
    orders,
    clients,
    apports,
    payments,
    suppliers,
    providers,
    providerServices,
    customFields,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProducts,
    addSale,
    updateSale,
    deleteSale,
    addPaymentToSale,
    refundSale,
    addPurchase,
    deletePurchase,
    addExpense,
    updateExpense,
    deleteExpense,
    addOrder,
    updateOrder,
    deleteOrder,
    addPaymentToOrder,
    refundOrder,
    addClient,
    updateClient,
    deleteClient,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addProvider,
    updateProvider,
    deleteProvider,
    addProviderService,
    deleteProviderService,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    addApport,
    deleteApport,
    refresh: fetchAll,
  };
}
