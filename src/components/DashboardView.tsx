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
import {
  formatCurrency,
  formatDateLocale,
  getProductLabel,
  getProductVariant,
  getSaleLabel,
  getSaleVariant,
} from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { StatBar } from "./shared/StatBar";
import { DataList } from "./shared/DataList";
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
  /**
   * Faux quand l'utilisateur n'a pas le droit de voir les prix d'achat :
   * le badge de variante disparaît alors, plutôt que de révéler un prix
   * négocié dans un simple aperçu de tableau de bord.
   */
  showPrixAchat?: boolean;
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
  showPrixAchat = true,
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
      {/* Bandeaux d'alerte : carte blanche avec un simple filet coloré à
          gauche. Un aplat de couleur pleine largeur attire l'œil bien
          au-delà de son importance réelle et fatigue à l'usage. */}
      {notificationPrefs.treasuryAlerts && isTresorerieNegative && (
        <div className="app-card flex items-center gap-3 overflow-hidden border-l-2 border-l-danger p-3.5 sm:gap-4">
          <AlertTriangle className="h-4 w-4 shrink-0 t-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Trésorerie négative — {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Les dépenses dépassent le capital. Injectez un apport ou enregistrez des ventes.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab("capital")}
            className="app-btn-secondary shrink-0 text-xs"
          >
            Ajuster
          </button>
        </div>
      )}
      {notificationPrefs.treasuryAlerts && isTresorerieLow && !isTresorerieNegative && (
        <div className="app-card flex items-center gap-3 overflow-hidden border-l-2 border-l-warning p-3.5 sm:gap-4">
          <AlertTriangle className="h-4 w-4 shrink-0 t-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Trésorerie sous le seuil de {formatCurrency(capital.seuilAlerteTresorerie)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solde actuel : {formatCurrency(capital.tresorerieGlobaleActuelle)}
            </p>
          </div>
        </div>
      )}

      {/* ── Barre d'indicateurs ──
          Une seule bande compacte plutôt que six cartes colorées : à
          cette densité de chiffres, le fond de couleur et la pastille
          d'icône fatiguent plus qu'ils n'orientent. */}
      <StatBar
        items={[
          {
            key: "tresorerie",
            label: "Trésorerie",
            value: formatCurrency(capital.tresorerieGlobaleActuelle),
            hint: isTresorerieNegative
              ? "solde négatif"
              : isTresorerieLow
                ? "sous le seuil"
                : "argent disponible",
            alert: isTresorerieNegative || isTresorerieLow,
            icon: <Wallet className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("capital"),
          },
          {
            key: "ventes",
            label: "Ventes",
            value: formatCurrency(totalSalesAmount),
            trend: salesTrend,
            icon: <DollarSign className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("ventes"),
          },
          {
            key: "achats",
            label: "Achats",
            value: formatCurrency(totalPurchasesAmount),
            trend: purchasesTrend,
            icon: <ShoppingCart className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("achats"),
          },
          {
            key: "depenses",
            label: "Dépenses",
            value: formatCurrency(totalExpensesAmount),
            trend: expensesTrend,
            icon: <ArrowDownRight className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("depenses"),
          },
          {
            key: "commandes",
            label: "Commandes",
            value: `${orders.length}`,
            hint:
              pendingOrders.length > 0 ? `${pendingOrders.length} en cours` : "aucune en cours",
            alert: pendingOrders.length > 0,
            icon: <ShoppingBag className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("commandes"),
          },
          {
            key: "stock",
            label: "Stock",
            value: formatCurrency(totalStockValue),
            hint:
              lowStockProducts.length > 0
                ? `${lowStockProducts.length} à réapprovisionner`
                : `${products.length} référence${products.length > 1 ? "s" : ""}`,
            alert: lowStockProducts.length > 0,
            icon: <Package className="h-3.5 w-3.5" />,
            onClick: () => onNavigateTab("produits"),
          },
        ]}
      />

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Vendeurs — liste dense, sans fond ni encadré par ligne */}
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <Users className="h-3.5 w-3.5" /> Solde net vendeurs
              </h3>
              <button
                onClick={() => onNavigateTab("vendeurs")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Gérer
              </button>
            </div>
            {sellers.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucun vendeur actif.
              </p>
            ) : (
              <div className="app-list">
                {sellers.map((v) => (
                  <div key={v.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary">{v.nom}</div>
                      <div className="app-list-secondary">
                        Ventes {formatCurrency(v.totalVentesMontant)} · Dépenses{" "}
                        {formatCurrency(v.totalDepenses)}
                      </div>
                    </div>
                    <div className="app-list-amount">{formatCurrency(v.soldeNetEnPoche)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertes de stock — la couleur ne sert qu'au badge de statut */}
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <AlertTriangle className="h-3.5 w-3.5" /> Alertes stock
                {lowStockProducts.length > 0 && (
                  <span className="text-muted-foreground">({lowStockProducts.length})</span>
                )}
              </h3>
              <button
                onClick={() => onNavigateTab("produits")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Voir tout
              </button>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 t-success" />
                Stock suffisant sur tous les produits.
              </p>
            ) : (
              <div className="app-list">
                {lowStockProducts.map((p) => {
                  const isOut = p.stockActuel <= 0;
                  return (
                    <div key={p.id} className="app-list-row justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="app-list-primary flex min-w-0 items-center gap-2">
                          <span className="truncate">{getProductLabel(p, products)}</span>
                          <VariantBadge
                            prix={getProductVariant(p, products)}
                            autorise={showPrixAchat}
                          />
                        </div>
                        <div className="app-list-secondary">seuil {p.seuilAlerte}</div>
                      </div>
                      <span
                        className={`app-badge shrink-0 ${isOut ? "app-badge-danger" : "app-badge-warning"}`}
                      >
                        {isOut ? "Rupture" : `${p.stockActuel} restant`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="app-section-title">
                  <Truck className="h-3.5 w-3.5" /> Commandes en cours
                  <span className="text-muted-foreground">({pendingOrders.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir
                </button>
              </div>
              <div className="app-list">
                {pendingOrders.slice(0, 3).map((o) => (
                  <div key={o.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary font-mono">{o.numero}</div>
                      <div className="app-list-secondary">{o.client?.nom ?? "Sans client"}</div>
                    </div>
                    <span className="app-list-amount">{formatCurrency(o.montant_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unpaid Orders */}
          {unpaidOrders.length > 0 && (
            <div className="app-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="app-section-title">
                  <CreditCard className="h-3.5 w-3.5" /> Paiements en attente
                  <span className="text-muted-foreground">({unpaidOrders.length})</span>
                </h3>
                <button
                  onClick={() => onNavigateTab("commandes")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir
                </button>
              </div>
              <div className="app-list">
                {unpaidOrders.slice(0, 3).map((o) => (
                  <div key={o.id} className="app-list-row justify-between">
                    <div className="min-w-0">
                      <div className="app-list-primary font-mono">{o.numero}</div>
                      <div className="app-list-secondary">{o.client?.nom ?? "Sans client"}</div>
                    </div>
                    <span className="app-list-amount t-danger">{formatCurrency(o.reste_a_payer ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Sales */}
          <div className="app-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="app-section-title">
                <TrendingUp className="h-3.5 w-3.5" /> Ventes récentes
              </h3>
              <button
                onClick={() => onNavigateTab("ventes")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Tout voir
              </button>
            </div>
            <DataList
              emptyLabel="Aucune vente récente."
              items={sales.slice(0, 6).map((s) => {
                const prod = products.find((p) => p.id === s.productId);
                return {
                  id: s.id,
                  primary: (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {prod ? getProductLabel(prod, products) : getSaleLabel(s, products)} ×
                        {s.quantite}
                      </span>
                      <VariantBadge prix={getSaleVariant(s, products)} autorise={showPrixAchat} />
                    </span>
                  ),
                  meta: [formatDateLocale(s.date, locale), s.vendeur],
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
                };
              })}
            />
          </div>

          {/* Achats & Dépenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="app-card p-4">
              <h3 className="app-section-title mb-3">
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

            <div className="app-card p-4">
              <h3 className="app-section-title mb-3">
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