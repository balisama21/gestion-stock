import React from "react";
import { Product, Sale, Expense, Seller, Purchase, CapitalSummary, LocaleSetting } from "../types";
import {
  Wallet,
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  TrendingUp,
  Package,
  ArrowDownRight,
  CheckCircle2,
  ArrowRightLeft,
  ShoppingBag,
  CreditCard,
  Truck,
} from "lucide-react";
import { formatCurrency, formatDateLocale, getProductLabel } from "../utils/formulas";
import type { Database } from "../lib/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  client?: Database["public"]["Tables"]["clients"]["Row"] | null;
  items?: Database["public"]["Tables"]["order_items"]["Row"][];
};
type Client = Database["public"]["Tables"]["clients"]["Row"];

interface DashboardViewProps {
  capital: CapitalSummary;
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  sellers: Seller[];
  orders: Order[];
  clients: Client[];
  locale: LocaleSetting;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  capital,
  products,
  sales,
  purchases,
  expenses,
  sellers,
  orders = [],
  clients = [],
  locale,
  onNavigateTab,
}) => {
  const lowStockProducts = products
    .filter((p) => p.stockActuel <= p.seuilAlerte)
    .sort((a, b) => a.stockActuel - b.stockActuel);
  const totalStockValue = products.reduce((acc, p) => acc + p.stockActuel * p.prixAchat, 0);
  const totalSalesAmount = sales.reduce((acc, s) => acc + s.totalVente, 0);
  const totalMarginAmount = sales.reduce((acc, s) => acc + s.margeTotale, 0);
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.montant, 0);
  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + p.totalAchat, 0);
  const pendingOrders = orders.filter(
    (o) => o.statut_commande === "en_attente" || o.statut_commande === "en_cours",
  );
  const unpaidOrders = orders.filter((o) => (o.reste_a_payer ?? 0) > 0);
  const isTresorerieNegative = capital.tresorerieGlobaleActuelle < 0;
  const isTresorerieLow = capital.tresorerieGlobaleActuelle < capital.seuilAlerteTresorerie;

  return (
    <div className="space-y-6">
      {/* ── Alert Banners ── */}
      {isTresorerieNegative && (
        <div className="bg-red-900/30 border border-red-500/40 p-4 rounded-2xl flex items-center gap-4">
          <AlertTriangle className="w-7 h-7 text-red-400 shrink-0 animate-bounce" />
          <div className="flex-1">
            <h3 className="font-bold text-base text-red-300">
              🚨 Trésorerie Négative ({formatCurrency(capital.tresorerieGlobaleActuelle)})
            </h3>
            <p className="text-sm text-red-300/70 mt-0.5">
              Les dépenses dépassent le capital. Injectez un apport ou enregistrez des ventes.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("capital")}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold shrink-0 transition-colors"
          >
            Ajuster Capital
          </button>
        </div>
      )}
      {isTresorerieLow && !isTresorerieNegative && (
        <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-amber-300">
              ⚠️ Trésorerie sous le seuil ({formatCurrency(capital.seuilAlerteTresorerie)})
            </h3>
            <p className="text-sm text-amber-300/70">
              Solde actuel : {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
        {/* Trésorerie */}
        <div
          onClick={() => onNavigateTab("capital")}
          className="col-span-2 sm:col-span-1 relative bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Trésorerie
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div
            className={`text-2xl font-black font-mono ${isTresorerieNegative ? "text-red-400" : "text-emerald-400"}`}
          >
            {formatCurrency(capital.tresorerieGlobaleActuelle)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Capital disponible</div>
        </div>

        {/* Ventes */}
        <div
          onClick={() => onNavigateTab("ventes")}
          className="bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/10 transition-all group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Ventes CA
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">
            {formatCurrency(totalSalesAmount)}
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            Marge : {formatCurrency(totalMarginAmount)}
          </div>
        </div>

        {/* Achats */}
        <div
          onClick={() => onNavigateTab("achats")}
          className="bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/10 transition-all group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Achats
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">
            {formatCurrency(totalPurchasesAmount)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{purchases.length} achats</div>
        </div>

        {/* Dépenses */}
        <div
          onClick={() => onNavigateTab("depenses")}
          className="bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-rose-500/60 hover:shadow-lg hover:shadow-rose-500/10 transition-all group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Dépenses
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {formatCurrency(totalExpensesAmount)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{expenses.length} dépenses</div>
        </div>

        {/* Commandes */}
        <div
          onClick={() => onNavigateTab("commandes")}
          className="bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group overflow-hidden relative"
        >
          {pendingOrders.length > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Commandes
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{orders.length}</div>
          <div className="text-xs text-amber-400 mt-1 font-semibold">
            {pendingOrders.length} en cours
          </div>
        </div>

        {/* Stock */}
        <div
          onClick={() => onNavigateTab("produits")}
          className="bg-card border border-border p-6 rounded-2xl cursor-pointer hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/10 transition-all group overflow-hidden relative"
        >
          {lowStockProducts.length > 0 && (
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-orange-400 rounded-full animate-ping" />
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">
            {formatCurrency(totalStockValue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{products.length} références</div>
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Sellers */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Solde Net Vendeurs
              </h3>
              <button
                onClick={() => onNavigateTab("vendeurs")}
                className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors"
              >
                Gérer →
              </button>
            </div>
            {sellers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Aucun vendeur actif.
              </div>
            ) : (
              <div className="space-y-3">
                {sellers.map((v) => (
                  <div
                    key={v.id}
                    className="bg-muted/50 p-3.5 rounded-xl border border-border/60 flex items-center justify-between gap-3 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">
                        {v.nom}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        V: {formatCurrency(v.totalVentesMontant)} · D:{" "}
                        {formatCurrency(v.totalDepenses)}
                      </div>
                    </div>
                    <div className="font-bold font-mono text-base text-emerald-400 whitespace-nowrap">
                      {formatCurrency(v.soldeNetEnPoche)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Alertes Stock (
                {lowStockProducts.length})
              </h3>
              <button
                onClick={() => onNavigateTab("produits")}
                className="text-sm text-emerald-400 hover:underline font-semibold"
              >
                Voir tout
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Stock suffisant sur
                tous les produits.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((p) => {
                  const isOut = p.stockActuel <= 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        isOut
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-amber-500/10 border-amber-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm text-foreground font-mono">
                          {getProductLabel(p, products)}
                        </div>
                        {isOut && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            Rupture
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-bold font-mono ${
                          isOut ? "text-red-400" : "text-amber-400"
                        }`}
                      >
                        {p.stockActuel}{" "}
                        <span className="text-xs text-muted-foreground">/ {p.seuilAlerte}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div className="bg-card border border-indigo-500/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-400" /> Commandes en cours (
                  {pendingOrders.length})
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-sm text-emerald-400 hover:underline font-semibold"
                >
                  Ouvrir
                </button>
              </div>
              <div className="space-y-2">
                {pendingOrders.slice(0, 3).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
                  >
                    <div>
                      <div className="font-bold text-sm font-mono text-foreground">{o.numero}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.client?.nom ?? "Sans client"}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-indigo-400 font-mono">
                      {formatCurrency(o.montant_total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unpaid Orders */}
          {unpaidOrders.length > 0 && (
            <div className="bg-card border border-rose-500/30 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-400" /> Paiements en attente (
                  {unpaidOrders.length})
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-sm text-emerald-400 hover:underline font-semibold"
                >
                  Ouvrir
                </button>
              </div>
              <div className="space-y-2">
                {unpaidOrders.slice(0, 3).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20"
                  >
                    <div>
                      <div className="font-bold text-sm font-mono text-foreground">{o.numero}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.client?.nom ?? "Sans client"}
                      </div>
                    </div>
                    <span className="font-bold text-sm text-rose-400 font-mono">
                      {formatCurrency(o.reste_a_payer ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Sales */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" /> Activités Récentes : Ventes
              </h3>
              <button
                onClick={() => onNavigateTab("ventes")}
                className="text-sm text-emerald-400 hover:underline font-semibold"
              >
                Toutes les Ventes →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3.5 font-semibold text-muted-foreground whitespace-nowrap">
                      Date
                    </th>
                    <th className="pb-3.5 font-semibold text-muted-foreground">Produit</th>
                    <th className="pb-3.5 font-semibold text-muted-foreground text-right whitespace-nowrap">
                      Total
                    </th>
                    <th className="pb-3.5 font-semibold text-muted-foreground pl-4 whitespace-nowrap">
                      Vendeur
                    </th>
                    <th className="pb-3.5 font-semibold text-muted-foreground whitespace-nowrap">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sales.slice(0, 6).map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 font-mono text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateLocale(s.date, locale)}
                      </td>
                      <td className="py-3.5 font-semibold text-emerald-300 font-mono">
                        {(() => {
                          const linkedProduct = products.find((prod) => prod.id === s.productId);
                          return linkedProduct ? getProductLabel(linkedProduct, products) : s.designation;
                        })()}{" "}
                        <span className="text-muted-foreground font-sans font-normal">
                          ×{s.quantite}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(s.totalVente)}
                      </td>
                      <td className="py-3.5 text-muted-foreground pl-4 whitespace-nowrap">
                        {s.vendeur}
                      </td>
                      <td className="py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                            s.statutCredit === "Payé"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : s.statutCredit === "Partiel"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {s.statutCredit}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        Aucune vente récente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Achats & Dépenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2 mb-4">
                <ShoppingCart className="w-4 h-4 text-amber-400" /> Derniers Achats
              </h3>
              <div className="space-y-3">
                {purchases.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-3.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {(() => {
                          const linkedProduct = products.find((prod) => prod.id === p.productId);
                          return linkedProduct ? getProductLabel(linkedProduct, products) : p.designation;
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateLocale(p.date, locale)}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-amber-400 whitespace-nowrap">
                      {formatCurrency(p.totalAchat)}
                    </div>
                  </div>
                ))}
                {purchases.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Aucun achat enregistré.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-4 h-4 text-rose-400" /> Dernières Dépenses
              </h3>
              <div className="space-y-3">
                {expenses.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center gap-3 text-sm border-b border-border/50 pb-3.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{e.vendeur}</div>
                      <div className="text-xs text-muted-foreground">{e.type}</div>
                    </div>
                    <div className="font-mono font-bold text-rose-400 whitespace-nowrap">
                      {formatCurrency(e.montant)}
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Aucune dépense enregistrée.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};