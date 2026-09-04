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
import { StatTile } from "./shared/StatTile";
import { MobileCardList } from "./shared/MobileCardList";
import { useNotificationPrefs } from "../lib/notificationPrefs";
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
  // Réglage « Alertes de trésorerie » (Paramètres → Notifications).
  const [notificationPrefs] = useNotificationPrefs();

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

  // ── Tendances : mois en cours vs mois précédent ──
  // Calcul purement local à partir des données déjà chargées (aucune
  // requête supplémentaire). Les cartes sans période comparable simple
  // (Trésorerie, Commandes, Stock) n'affichent pas de tendance : mieux
  // vaut pas d'indicateur qu'un indicateur faux.
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = monthKey(now);
  const previousMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const sumInMonth = <T,>(rows: T[], date: (r: T) => string, amount: (r: T) => number, m: string) =>
    rows.filter((r) => (date(r) || "").startsWith(m)).reduce((acc, r) => acc + amount(r), 0);

  const buildTrend = (current: number, previous: number, goodDirection: "up" | "down") => {
    if (previous === 0) return { percent: 0, label: "ce mois-ci", noBaseline: true, goodDirection };
    return {
      percent: ((current - previous) / Math.abs(previous)) * 100,
      label: "vs mois dernier",
      goodDirection,
    };
  };

  const salesTrend = buildTrend(
    sumInMonth(sales, (s) => s.date, (s) => s.totalVente, currentMonth),
    sumInMonth(sales, (s) => s.date, (s) => s.totalVente, previousMonth),
    "up",
  );
  const purchasesTrend = buildTrend(
    sumInMonth(purchases, (p) => p.date, (p) => p.totalAchat, currentMonth),
    sumInMonth(purchases, (p) => p.date, (p) => p.totalAchat, previousMonth),
    "down",
  );
  const expensesTrend = buildTrend(
    sumInMonth(expenses, (e) => e.date, (e) => e.montant, currentMonth),
    sumInMonth(expenses, (e) => e.date, (e) => e.montant, previousMonth),
    "down",
  );

  return (
    <div className="space-y-6">
      {/* ── Alert Banners ── */}
      {notificationPrefs.treasuryAlerts && isTresorerieNegative && (
        <div className="bg-danger-soft border border-danger-border p-4 rounded-2xl flex items-center gap-4">
          <AlertTriangle className="w-7 h-7 t-danger shrink-0 animate-bounce" />
          <div className="flex-1">
            <h3 className="font-bold text-base t-danger">
              🚨 Trésorerie Négative ({formatCurrency(capital.tresorerieGlobaleActuelle)})
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Les dépenses dépassent le capital. Injectez un apport ou enregistrez des ventes.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("capital")}
            className="app-btn bg-destructive text-white hover:opacity-90 shrink-0 text-sm"
          >
            Ajuster Capital
          </button>
        </div>
      )}
      {notificationPrefs.treasuryAlerts && isTresorerieLow && !isTresorerieNegative && (
        <div className="bg-warning-soft border border-warning-border p-4 rounded-2xl flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 t-warning shrink-0" />
          <div>
            <h3 className="font-bold text-sm t-warning">
              ⚠️ Trésorerie sous le seuil ({formatCurrency(capital.seuilAlerteTresorerie)})
            </h3>
            <p className="text-sm text-muted-foreground">
              Solde actuel : {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ──
          Grille plus aérée : à six colonnes dès 1024px les montants
          étaient à l'étroit. On ne passe à six qu'au-delà de 1280px. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6 xl:gap-5">
        <StatTile
          label="Trésorerie"
          value={formatCurrency(capital.tresorerieGlobaleActuelle)}
          hint="argent disponible"
          icon={<Wallet className="w-5 h-5" />}
          tone={isTresorerieNegative ? "danger" : isTresorerieLow ? "warning" : "success"}
          onClick={() => onNavigateTab("capital")}
        />

        <StatTile
          label="Ventes"
          value={formatCurrency(totalSalesAmount)}
          hint={`Marge : ${formatCurrency(totalMarginAmount)}`}
          hintTone="success"
          icon={<DollarSign className="w-5 h-5" />}
          tone="info"
          trend={salesTrend}
          onClick={() => onNavigateTab("ventes")}
        />

        <StatTile
          label="Achats"
          value={formatCurrency(totalPurchasesAmount)}
          hint={`${purchases.length} achat${purchases.length > 1 ? "s" : ""}`}
          icon={<ShoppingCart className="w-5 h-5" />}
          tone="warning"
          trend={purchasesTrend}
          onClick={() => onNavigateTab("achats")}
        />

        <StatTile
          label="Dépenses"
          value={formatCurrency(totalExpensesAmount)}
          hint={`${expenses.length} dépense${expenses.length > 1 ? "s" : ""}`}
          icon={<ArrowDownRight className="w-5 h-5" />}
          tone="danger"
          trend={expensesTrend}
          onClick={() => onNavigateTab("depenses")}
        />

        <StatTile
          label="Commandes"
          value={`${orders.length}`}
          hint={
            pendingOrders.length > 0
              ? `${pendingOrders.length} en cours`
              : "aucune commande en cours"
          }
          hintTone={pendingOrders.length > 0 ? "warning" : "neutral"}
          icon={<ShoppingBag className="w-5 h-5" />}
          tone="violet"
          flag={pendingOrders.length > 0}
          onClick={() => onNavigateTab("commandes")}
        />

        <StatTile
          label="Stock"
          value={formatCurrency(totalStockValue)}
          hint={
            lowStockProducts.length > 0
              ? `${lowStockProducts.length} à réapprovisionner`
              : `${products.length} référence${products.length > 1 ? "s" : ""}`
          }
          hintTone={lowStockProducts.length > 0 ? "warning" : "neutral"}
          icon={<Package className="w-5 h-5" />}
          tone="violet"
          flag={lowStockProducts.length > 0}
          onClick={() => onNavigateTab("produits")}
        />
      </div>


      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Sellers */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 t-success" /> Solde Net Vendeurs
              </h3>
              <button
                onClick={() => onNavigateTab("vendeurs")}
                className="text-sm t-success hover:t-success font-semibold hover:underline transition-colors"
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
                    <div className="font-bold font-mono text-base t-success whitespace-nowrap">
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
                <AlertTriangle className="w-4 h-4 t-warning" /> Alertes Stock (
                {lowStockProducts.length})
              </h3>
              <button
                onClick={() => onNavigateTab("produits")}
                className="text-sm t-success hover:underline font-semibold"
              >
                Voir tout
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border">
                <CheckCircle2 className="w-4 h-4 t-success shrink-0" /> Stock suffisant sur
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
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 t-danger border border-red-500/30">
                            Rupture
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-bold font-mono ${
                          isOut ? "t-danger" : "t-warning"
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
                  <Truck className="w-4 h-4 t-violet" /> Commandes en cours (
                  {pendingOrders.length})
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-sm t-success hover:underline font-semibold"
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
                    <span className="font-bold text-sm t-violet font-mono">
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
                  <CreditCard className="w-4 h-4 t-danger" /> Paiements en attente (
                  {unpaidOrders.length})
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-sm t-success hover:underline font-semibold"
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
                    <span className="font-bold text-sm t-danger font-mono">
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
                <TrendingUp className="w-4 h-4 t-info" /> Activités Récentes : Ventes
              </h3>
              <button
                onClick={() => onNavigateTab("ventes")}
                className="text-sm t-success hover:underline font-semibold"
              >
                Toutes les Ventes →
              </button>
            </div>
            {/* Liste mobile — le tableau ci-dessous impose un défilement
                horizontal illisible sous 768px. */}
            <div className="lg:hidden">
              <MobileCardList
                emptyLabel="Aucune vente récente."
                items={sales.slice(0, 6).map((s) => {
                  const linkedProduct = products.find((prod) => prod.id === s.productId);
                  return {
                    id: s.id,
                    title: `${linkedProduct ? getProductLabel(linkedProduct, products) : s.designation} ×${s.quantite}`,
                    subtitle: `${formatDateLocale(s.date, locale)} · ${s.vendeur}`,
                    amount: formatCurrency(s.totalVente),
                    badge: (
                      <span
                        className={`app-badge ${
                          s.statutCredit === "Payé"
                            ? "app-badge-success"
                            : s.statutCredit === "Partiel"
                              ? "app-badge-warning"
                              : "app-badge-danger"
                        }`}
                      >
                        {s.statutCredit}
                      </span>
                    ),
                    fields: [
                      { label: "Date", value: formatDateLocale(s.date, locale) },
                      { label: "Quantité", value: `${s.quantite}` },
                      { label: "Vendeur", value: s.vendeur },
                      { label: "Total", value: formatCurrency(s.totalVente) },
                    ],
                  };
                })}
              />
            </div>

            <div className="hidden overflow-x-auto lg:block">
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
                      <td className="py-3.5 font-semibold t-success font-mono">
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
                          className={`app-badge ${
                            s.statutCredit === "Payé"
                              ? "app-badge-success"
                              : s.statutCredit === "Partiel"
                                ? "app-badge-warning"
                                : "app-badge-danger"
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
                <ShoppingCart className="w-4 h-4 t-warning" /> Derniers Achats
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
                    <div className="font-mono font-bold t-warning whitespace-nowrap">
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
                <ArrowRightLeft className="w-4 h-4 t-danger" /> Dernières Dépenses
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
                    <div className="font-mono font-bold t-danger whitespace-nowrap">
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