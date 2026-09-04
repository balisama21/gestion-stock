import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CreditCard,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  AlertCircle,
  ChevronDown,
  X,
  User,
  Calendar,
  DollarSign,
  History,
  Trash2,
} from "lucide-react";
import { formatCurrency, getProductLabel, getSaleLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";

/**
 * Adaptateur : le type Product ici vient directement de Supabase (snake_case),
 * alors que getProductLabel attend le format camelCase du front. On convertit
 * à la volée sans toucher au reste du code.
 */
function getProdLabel(prod: { designation: string; prix_achat: number }, allProducts: Product[]): string {
  return getProductLabel(
    { designation: prod.designation, prixAchat: prod.prix_achat },
    allProducts.map((p) => ({ designation: p.designation, prixAchat: p.prix_achat })),
  );
}

/**
 * Même chose pour un article de commande (order_items), qui utilise son
 * propre prix d'achat de référence pour se différencier des autres variantes.
 */
function getOrderItemLabel(
  item: { designation: string; prix_achat_unit: number },
  allProducts: Product[],
): string {
  return getSaleLabel(
    { designation: item.designation, prixAchatUnitRef: item.prix_achat_unit },
    allProducts.map((p) => ({ designation: p.designation, prixAchat: p.prix_achat })),
  );
}
import type { Database } from "../lib/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

interface CommandesViewProps {
  orders: Order[];
  clients: Client[];
  products: Product[];
  isOwner: boolean;
  onAddOrder: (
    orderData: { client_id: string | null; note: string | null; date_livraison: string | null },
    items: {
      product_id: string | null;
      designation: string;
      quantite: number;
      prix_vente_unit: number;
      prix_achat_unit: number;
    }[],
  ) => Promise<{ order: Order | null; error: string | null }>;
  onUpdateOrder: (
    id: string,
    data: Database["public"]["Tables"]["orders"]["Update"],
  ) => Promise<{ error: string | null }>;
  onAddPayment: (
    orderId: string,
    data: Omit<Database["public"]["Tables"]["payments"]["Insert"], "order_id" | "sale_id" | "store_id" | "recorded_by">,
  ) => Promise<{ error: string | null }>;
  // PHASE 1 : remboursement traçable (ne supprime jamais le paiement d'origine).
  onRefundOrder: (
    orderId: string,
    montant: number,
    reason?: string,
  ) => Promise<{ error: string | null }>;
  // Suppression manuelle d'une commande (quel que soit son statut) pour
  // nettoyer la liste. Ne touche jamais au stock déjà sorti/réservé.
  onDeleteOrder?: (orderId: string) => Promise<{ error: string | null }>;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  en_attente: {
    label: "En attente",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "t-warning",
    bg: "bg-amber-500/10 border-amber-500/25",
  },
  en_cours: {
    label: "En cours",
    icon: <Package className="w-3.5 h-3.5" />,
    color: "t-info",
    bg: "bg-blue-500/10 border-blue-500/25",
  },
  livre: {
    label: "Livré",
    icon: <Truck className="w-3.5 h-3.5" />,
    color: "t-success",
    bg: "bg-emerald-500/10 border-emerald-500/25",
  },
  annule: {
    label: "Annulé",
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: "t-danger",
    bg: "bg-red-500/10 border-red-500/25",
  },
};

const paymentConfig: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  impaye: { label: "🔴 Impayé", color: "t-danger", bg: "bg-red-500/10 border-red-500/25" },
  partiel: {
    label: "⚠️ Partiel",
    color: "t-warning",
    bg: "bg-amber-500/10 border-amber-500/25",
  },
  paye: {
    label: "✅ Payé",
    color: "t-success",
    bg: "bg-emerald-500/10 border-emerald-500/25",
  },
};

export const CommandesView: React.FC<CommandesViewProps> = ({
  orders,
  clients,
  products,
  isOwner,
  onAddOrder,
  onUpdateOrder,
  onAddPayment,
  onRefundOrder,
  onDeleteOrder,
}) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");
  const [filterPayment, setFilterPayment] = useState<PaymentStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAttemptKey, setPaymentAttemptKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Commande à annuler dont le paiement doit être traité (montant_paye > 0)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // PHASE 1 : protection UI secondaire contre le double-clic (livraison/annulation
  // rapide). La garantie réelle est côté base (set_order_status est idempotent),
  // mais désactiver le bouton pendant l'appel évite aussi les doubles requêtes
  // réseau inutiles et donne un retour visuel immédiat.
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const requestCancel = async (order: Order) => {
    if (order.montant_paye > 0) {
      setCancelTarget(order);
    } else {
      setProcessingOrderId(order.id);
      await onUpdateOrder(order.id, { statut_commande: "annule" });
      setProcessingOrderId(null);
    }
  };

  const handleDeliver = async (order: Order) => {
    setProcessingOrderId(order.id);
    await onUpdateOrder(order.id, { statut_commande: "livre" });
    setProcessingOrderId(null);
  };

  const confirmCancelRefund = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const result = await onUpdateOrder(cancelTarget.id, { statut_commande: "annule" });
    if (result.error) {
      alert("Erreur lors de l'annulation : " + result.error);
      setCancelling(false);
      return;
    }
    setCancelling(false);
    setCancelTarget(null);
  };

  // New order form state
  const [newOrder, setNewOrder] = useState({
    client_id: "",
    note: "",
    date_livraison: "",
    statut_commande: "en_attente" as OrderStatus,
  });
  const [orderItems, setOrderItems] = useState<
    {
      product_id: string;
      designation: string;
      quantite: number;
      prix_vente_unit: number;
      prix_achat_unit: number;
    }[]
  >([]);

  const filtered = useMemo(() => {
    let result = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.numero.toLowerCase().includes(q) ||
          o.client?.nom?.toLowerCase().includes(q) ||
          o.note?.toLowerCase().includes(q),
      );
    }
    if (filterStatus !== "all") result = result.filter((o) => o.statut_commande === filterStatus);
    if (filterPayment !== "all") result = result.filter((o) => o.statut_paiement === filterPayment);
    return result;
  }, [orders, search, filterStatus, filterPayment]);

  // Summary stats
  const stats = useMemo(
    () => ({
      total: orders.length,
      enCours: orders.filter(
        (o) => o.statut_commande === "en_cours" || o.statut_commande === "en_attente",
      ).length,
      livrees: orders.filter((o) => o.statut_commande === "livre").length,
      montantImpayes: orders.reduce((s, o) => s + (o.reste_a_payer ?? 0), 0),
      totalCA: orders.reduce((s, o) => s + o.montant_total, 0),
      totalPaye: orders.reduce((s, o) => s + o.montant_paye, 0),
    }),
    [orders],
  );

  const addItem = () => {
    setOrderItems((prev) => [
      ...prev,
      { product_id: "", designation: "", quantite: 1, prix_vente_unit: 0, prix_achat_unit: 0 },
    ]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setOrderItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "product_id" && value) {
        const prod = products.find((p) => p.id === value);
        if (prod) {
          next[idx].designation = getProdLabel(prod, products);
          next[idx].prix_vente_unit = prod.prix_vente_defaut;
          next[idx].prix_achat_unit = prod.prix_achat;
        }
      }
      return next;
    });
  };

  const removeItem = (idx: number) => setOrderItems((prev) => prev.filter((_, i) => i !== idx));

  const totalOrder = orderItems.reduce((s, i) => s + i.quantite * i.prix_vente_unit, 0);

  // RÈGLE 2 : impossible de commander plus que le stock disponible.
  // On agrège par produit au cas où plusieurs lignes visent le même
  // article, puis on compare au stock réel.
  const stockErrors = useMemo(() => {
    const neededByProduct = new Map<string, number>();
    for (const item of orderItems) {
      if (!item.product_id) continue;
      neededByProduct.set(
        item.product_id,
        (neededByProduct.get(item.product_id) ?? 0) + item.quantite,
      );
    }
    const errors: string[] = [];
    for (const [productId, needed] of neededByProduct) {
      const prod = products.find((p) => p.id === productId);
      if (!prod) continue;
      const disponible = prod.stock_disponible ?? Math.max(prod.stock_actuel - (prod.stock_reserve ?? 0), 0);
      if (disponible <= 0) {
        errors.push(`${getProdLabel(prod, products)} : aucun stock disponible (tout le stock est réservé ou épuisé).`);
      } else if (needed > disponible) {
        errors.push(
          `${getProdLabel(prod, products)} : stock disponible insuffisant. Disponible ${disponible}, demandé ${needed}.`,
        );
      }
    }
    return errors;
  }, [orderItems, products]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      setError("Ajoutez au moins un produit.");
      return;
    }
    if (stockErrors.length > 0) {
      setError(stockErrors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    const items = orderItems.map((i) => ({
      product_id: i.product_id || null,
      designation: i.designation,
      quantite: i.quantite,
      prix_vente_unit: i.prix_vente_unit,
      prix_achat_unit: i.prix_achat_unit,
    }));
    // PHASE 1 : montant_total est désormais calculé côté serveur à partir des
    // lignes (p_items) par la RPC create_order_with_items ; montant_paye
    // démarre toujours à 0 et statut_commande à 'en_attente' par défaut en base.
    const { error: err } = await onAddOrder(
      {
        client_id: newOrder.client_id || null,
        note: newOrder.note || null,
        date_livraison: newOrder.date_livraison || null,
      },
      items,
    );
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setShowNewOrder(false);
    setNewOrder({ client_id: "", note: "", date_livraison: "", statut_commande: "en_attente" });
    setOrderItems([]);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Montant invalide.");
      return;
    }
    if (amount > (selectedOrder.reste_a_payer ?? 0)) {
      setError(
        `Montant trop élevé. Reste à payer : ${formatCurrency(selectedOrder.reste_a_payer ?? 0)}`,
      );
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await onAddPayment(selectedOrder.id, {
      montant: amount,
      methode: paymentMethod,
      reference: null,
      note: paymentNote || null,
      idempotency_key: paymentAttemptKey || undefined,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("especes");
    setPaymentAttemptKey("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShoppingBag className="w-5 h-5 t-info" />}
        title={`Commandes (${orders.length})`}
        subtitle="Suivez vos commandes clients et leurs paiements."
        actions={
          <button onClick={() => setShowNewOrder(true)} className="app-btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Nouvelle commande
          </button>
        }
      />

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total",
            value: stats.total,
            color: "text-foreground",
            icon: <ShoppingBag className="w-4 h-4" />,
          },
          {
            label: "En cours",
            value: stats.enCours,
            color: "t-info",
            icon: <Clock className="w-4 h-4" />,
          },
          {
            label: "Livrées",
            value: stats.livrees,
            color: "t-success",
            icon: <CheckCircle2 className="w-4 h-4" />,
          },
          {
            label: "CA Total",
            value: formatCurrency(stats.totalCA),
            color: "text-foreground",
            icon: <DollarSign className="w-4 h-4" />,
            mono: true,
          },
          {
            label: "Encaissé",
            value: formatCurrency(stats.totalPaye),
            color: "t-success",
            icon: <CreditCard className="w-4 h-4" />,
            mono: true,
          },
          {
            label: "Impayés",
            value: formatCurrency(stats.montantImpayes),
            color: stats.montantImpayes > 0 ? "t-danger" : "text-muted-foreground",
            icon: <AlertCircle className="w-4 h-4" />,
            mono: true,
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <div
              className={`flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1 ${s.color} opacity-70`}
            >
              {s.icon}
            </div>
            <div className={`text-sm font-bold ${(s as any).mono ? "font-mono" : ""} ${s.color}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une commande..."
            className="w-full bg-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="en_cours">En cours</option>
          <option value="livre">Livré</option>
          <option value="annule">Annulé</option>
        </select>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value as any)}
          className="bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">Tous paiements</option>
          <option value="impaye">Impayé</option>
          <option value="partiel">Partiel</option>
          <option value="paye">Payé</option>
        </select>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">Aucune commande trouvée.</p>
          <button
            onClick={() => setShowNewOrder(true)}
            className="mt-3 t-success text-sm hover:underline"
          >
            + Créer une commande
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const sc = statusConfig[order.statut_commande] ?? statusConfig.en_attente;
            const pc = paymentConfig[order.statut_paiement] ?? paymentConfig.impaye;
            const isSelected = selectedOrder?.id === order.id;
            return (
              <div
                key={order.id}
                className={`bg-card border rounded-2xl transition-all ${isSelected ? "border-emerald-500/60 ring-1 ring-emerald-500/25" : "border-border hover:border-border/80"}`}
              >
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => setSelectedOrder(isSelected ? null : order)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {order.numero}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bg} ${sc.color}`}
                        >
                          {sc.icon}
                          {sc.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${pc.bg} ${pc.color}`}
                        >
                          {pc.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.client?.nom ?? "Client non spécifié"}
                        {" · "}
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                        {order.items &&
                          order.items.length > 0 &&
                          ` · ${order.items.length} article(s)`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-foreground">
                        {formatCurrency(order.montant_total)}
                      </div>
                      {(order.reste_a_payer ?? 0) > 0 && (
                        <div className="text-[11px] t-danger">
                          Reste: {formatCurrency(order.reste_a_payer ?? 0)}
                        </div>
                      )}
                    </div>
                   <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isSelected ? "rotate-180" : ""}`}
                    />
                    {onDeleteOrder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Supprimer définitivement la commande ${order.numero} ?\n\nCeci ne modifie pas le stock (le produit reste sorti si la commande avait déjà été livrée).`,
                            )
                          ) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:t-danger bg-muted hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Supprimer la commande"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {/* Items */}
                    {order.items && order.items.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Produits commandés
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between text-xs p-2 bg-muted/40 rounded-lg"
                            >
                              <span className="text-foreground font-medium">
                                {getOrderItemLabel(item, products)} × {item.quantite}
                              </span>
                              <span className="font-mono text-foreground">
                                {formatCurrency(item.total_vente)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment summary */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <div className="font-mono font-bold text-foreground">
                          {formatCurrency(order.montant_total)}
                        </div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/20">
                        <div className="font-mono font-bold t-success">
                          {formatCurrency(order.montant_paye)}
                        </div>
                        <div className="text-muted-foreground">Payé</div>
                      </div>
                      <div
                        className={`rounded-lg p-2 text-center border ${(order.reste_a_payer ?? 0) > 0 ? "bg-red-500/10 border-red-500/20" : "bg-muted/50 border-border"}`}
                      >
                        <div
                          className={`font-mono font-bold ${(order.reste_a_payer ?? 0) > 0 ? "t-danger" : "text-muted-foreground"}`}
                        >
                          {formatCurrency(order.reste_a_payer ?? 0)}
                        </div>
                        <div className="text-muted-foreground">Reste</div>
                      </div>
                    </div>

                    {order.note && (
                      <p className="text-xs text-muted-foreground italic">{order.note}</p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(order.reste_a_payer ?? 0) > 0 && (
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setPaymentAttemptKey(
                              typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : `payment-${Date.now()}-${Math.random()}`,
                            );
                            setShowPaymentModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Enregistrer paiement
                        </button>
                      )}
                      {order.statut_commande !== "livre" && order.statut_commande !== "annule" && (
                        <button
                          onClick={() => handleDeliver(order)}
                          disabled={processingOrderId === order.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 t-info border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          {processingOrderId === order.id ? "..." : "Marquer livré"}
                        </button>
                      )}
                      {isOwner && order.statut_commande !== "annule" && (
                        <button
                          onClick={() => requestCancel(order)}
                          disabled={processingOrderId === order.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 t-danger border border-red-500/25 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {processingOrderId === order.id ? "..." : "Annuler"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Annuler la commande</h3>
              <button
                onClick={() => setCancelTarget(null)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-5">
              La commande{" "}
              <strong className="text-foreground font-mono">{cancelTarget.numero}</strong> a déjà
              reçu{" "}
              <strong className="t-success font-mono">
                {formatCurrency(cancelTarget.montant_paye)}
              </strong>{" "}
              de paiement. L'annulation remboursera automatiquement le montant réellement encaissé
              dans la même transaction, sans supprimer le paiement d'origine.
            </div>
            <div className="space-y-2">
              <button
                onClick={confirmCancelRefund}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 t-danger border border-red-500/25 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {cancelling ? "Annulation en cours…" : "Rembourser et annuler"}
                <span className="text-xs font-normal opacity-75">
                  ({formatCurrency(cancelTarget.montant_paye - (cancelTarget.montant_rembourse ?? 0))} à rembourser)
                </span>
              </button>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Retour, ne rien faire
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Enregistrer un paiement</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setError(null);
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              Commande <strong className="text-foreground font-mono">{selectedOrder.numero}</strong>{" "}
              — Reste à payer :{" "}
              <strong className="t-danger font-mono">
                {formatCurrency(selectedOrder.reste_a_payer ?? 0)}
              </strong>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 t-danger rounded-xl text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Montant reçu *
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  max={selectedOrder.reste_a_payer ?? 0}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mode de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="virement">Virement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Note (optionnel)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Référence, note..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {saving ? "Enregistrement..." : "Confirmer le paiement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New order modal */}
      {showNewOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-foreground text-lg">Nouvelle Commande</h3>
              <button
                onClick={() => {
                  setShowNewOrder(false);
                  setError(null);
                  setOrderItems([]);
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 t-danger rounded-xl text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateOrder} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Client
                  </label>
                  <select
                    value={newOrder.client_id}
                    onChange={(e) => setNewOrder((p) => ({ ...p, client_id: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- Sélectionner un client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Statut initial
                  </label>
                  <select
                    value={newOrder.statut_commande}
                    onChange={(e) =>
                      setNewOrder((p) => ({ ...p, statut_commande: e.target.value as OrderStatus }))
                    }
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="en_attente">En attente</option>
                    <option value="en_cours">En cours</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Date de livraison prévue
                  </label>
                  <input
                    type="date"
                    value={newOrder.date_livraison}
                    onChange={(e) => setNewOrder((p) => ({ ...p, date_livraison: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={newOrder.note}
                    onChange={(e) => setNewOrder((p) => ({ ...p, note: e.target.value }))}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Note optionnelle..."
                  />
                </div>
              </div>

              {/* Order items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Produits *
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs t-success hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un produit
                  </button>
                </div>
                {orderItems.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
                    Aucun produit ajouté. Cliquez sur "Ajouter un produit".
                  </div>
                )}
                <div className="space-y-2">
                  {orderItems.map((item, idx) => {
                    const selectedProduct = products.find((p) => p.id === item.product_id);
                    const isOut = selectedProduct ? selectedProduct.stock_actuel <= 0 : false;
                    const isInsufficient =
                      selectedProduct &&
                      !isOut &&
                      item.quantite > selectedProduct.stock_actuel;
                    return (
                      <div key={idx}>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                            className="col-span-4 bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          >
                            <option value="">Produit libre</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {getProdLabel(p, products)} — {p.stock_actuel <= 0 ? "Rupture" : `Stock: ${p.stock_actuel}`}
                              </option>
                            ))}
                          </select>
                          {!item.product_id && (
                            <input
                              type="text"
                              value={item.designation}
                              onChange={(e) => updateItem(idx, "designation", e.target.value)}
                              placeholder="Désignation"
                              className="col-span-3 bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          )}
                          <input
                            type="number"
                            value={item.quantite}
                            onChange={(e) => updateItem(idx, "quantite", parseInt(e.target.value) || 1)}
                            min={1}
                            className={`${item.product_id ? "col-span-2" : "col-span-2"} bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50`}
                          />
                          <input
                            type="number"
                            value={item.prix_vente_unit}
                            onChange={(e) =>
                              updateItem(idx, "prix_vente_unit", parseFloat(e.target.value) || 0)
                            }
                            className="col-span-2 bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            placeholder="Prix"
                          />
                          <div className="col-span-1 text-xs font-mono t-success text-right">
                            {formatCurrency(item.quantite * item.prix_vente_unit)}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="col-span-1 p-1 t-danger hover:t-danger flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(isOut || isInsufficient) && (
                          <div className="mt-1 ml-1 text-[11px] t-danger flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {isOut
                              ? "Ce produit est en rupture de stock."
                              : `Stock insuffisant. Il reste seulement ${selectedProduct?.stock_actuel} unité(s) disponible(s).`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {orderItems.length > 0 && (
                <div className="flex justify-end">
                  <div className="bg-muted/50 rounded-xl px-4 py-2 text-right">
                    <div className="text-xs text-muted-foreground">Total commande</div>
                    <div className="text-lg font-bold font-mono t-success">
                      {formatCurrency(totalOrder)}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewOrder(false);
                    setError(null);
                    setOrderItems([]);
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || stockErrors.length > 0}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {saving ? "Création..." : "Créer la commande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};