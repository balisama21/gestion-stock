import React from "react";
import { Sale, Product, Seller, Expense, LocaleSetting } from "../types";
import { Store, TrendingUp, Users, Package, Award } from "lucide-react";
import { formatCurrency, getProductLabel } from "../utils/formulas";
interface StatistiquesViewProps {
  sales: Sale[];
  products: Product[];
  sellers: Seller[];
  expenses: Expense[];
  locale: LocaleSetting;
}

export const StatistiquesView: React.FC<StatistiquesViewProps> = ({
  sales,
  products,
  sellers,
  expenses,
}) => {
  const totalCA = sales.reduce((acc, s) => acc + s.totalVente, 0);
  const totalMarge = sales.reduce((acc, s) => acc + s.margeTotale, 0);
  const averageMarginRate = totalCA > 0 ? (totalMarge / totalCA) * 100 : 0;

  // Sales per product
  const productStats = products.map((p) => {
    const pSales = sales.filter((s) => s.productId === p.id);
    const qtySold = pSales.reduce((acc, s) => acc + s.quantite, 0);
    const caSold = pSales.reduce((acc, s) => acc + s.totalVente, 0);
    const margeSold = pSales.reduce((acc, s) => acc + s.margeTotale, 0);
    return {
      id: p.id,
      displayName: getProductLabel(p, products),
      qtySold,
      caSold,
      margeSold,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Store className="w-6 h-6 text-sky-400" />
            Statistiques & Analyses de Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Indicateurs de rentabilité, taux de marge brute et classements des vendeurs et produits.
          </p>
        </div>
      </div>

      {/* Margins Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Chiffre d’Affaires Total
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatCurrency(totalCA)}
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Marge Brute Cumulée
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            +{formatCurrency(totalMarge)}
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Taux de Marge Moyen
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400">
            {averageMarginRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Vendeurs */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Classement & Performance des Vendeurs
          </h3>

          <div className="space-y-3">
            {sellers.map((v, idx) => {
              const share = totalCA > 0 ? (v.totalVentesMontant / totalCA) * 100 : 0;
              return (
                <div
                  key={v.id}
                  className="bg-muted/50 p-3 rounded-xl border border-muted-foreground/20/60"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-accent text-[10px] flex items-center justify-center font-mono">
                        #{idx + 1}
                      </span>
                      {v.nom}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {formatCurrency(v.totalVentesMontant)}
                    </span>
                  </div>

                  <div className="w-full bg-accent rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${Math.min(share, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{v.totalVentesNombre} ventes réalisées</span>
                    <span>{share.toFixed(1)}% du CA total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ventilation Produits */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            Ventes par Référence & Variantes
          </h3>

          <div className="space-y-2">
            {productStats.map((p) => (
              <div
                key={p.id}
                className="bg-muted/50 p-3 rounded-xl border border-muted-foreground/20/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold font-mono text-foreground">{p.displayName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Quantité vendue : {p.qtySold} unités
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="font-bold text-foreground">{formatCurrency(p.caSold)}</div>
                  <div className="text-[10px] text-emerald-400">
                    Marge: +{formatCurrency(p.margeSold)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
