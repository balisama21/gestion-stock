import React from "react";
import { Sale, Product, Seller, Expense, LocaleSetting } from "../types";
import { Store, Users, Package } from "lucide-react";
import { formatCurrency, getProductLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { DataList } from "./shared/DataList";

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

  // Un produit jamais vendu n'a pas sa place dans un classement de
  // ventes, et le classement n'a de sens que trié : la section affichait
  // des numéros d'ordre sur une liste qui suivait l'ordre de création.
  const soldProducts = [...productStats]
    .filter((p) => p.qtySold > 0)
    .sort((a, b) => b.caSold - a.caSold);

  const rankedSellers = [...sellers].sort(
    (a, b) => b.totalVentesMontant - a.totalVentesMontant,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Store className="h-5 w-5 text-muted-foreground" />}
        title="Statistiques"
        subtitle="Vos meilleurs vendeurs, vos produits les plus rentables."
      />

      <div className="app-statbar grid-cols-1 sm:grid-cols-3">
        <StatCol label="Chiffre d'affaires" value={formatCurrency(totalCA)} hint="Toutes ventes" />
        <StatCol
          label="Marge brute"
          value={formatCurrency(totalMarge)}
          hint="Cumulée sur la période"
        />
        <StatCol
          label="Taux de marge moyen"
          value={`${averageMarginRate.toFixed(1)} %`}
          hint="Marge rapportée au chiffre d'affaires"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Classement des vendeurs.
            La barre de part est le seul graphisme conservé : ici elle
            porte de l'information — la longueur se compare d'un regard,
            ce qu'une colonne de pourcentages ne permet pas. */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="app-section-title">
              <Users className="h-4 w-4" />
              Classement des vendeurs
            </h3>
          </div>

          {rankedSellers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun vendeur enregistré.
            </p>
          ) : (
            <div className="app-list">
              {rankedSellers.map((v, idx) => {
                const share = totalCA > 0 ? (v.totalVentesMontant / totalCA) * 100 : 0;
                return (
                  <div key={v.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="app-list-primary">{v.nom}</span>
                      </span>
                      <span className="app-list-amount">
                        {formatCurrency(v.totalVentesMontant)}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(share, 100)}%` }}
                      />
                    </div>

                    <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                      <span className="truncate">
                        {v.totalVentesNombre} vente{v.totalVentesNombre > 1 ? "s" : ""}
                      </span>
                      <span className="shrink-0">{share.toFixed(1)} % du CA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Produits les plus vendus */}
        <div className="app-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="app-section-title">
              <Package className="h-4 w-4" />
              Ventes par référence
            </h3>
          </div>

          <DataList
            emptyLabel="Aucune vente enregistrée pour l'instant."
            items={soldProducts.map((p) => ({
              id: p.id,
              primary: p.displayName,
              meta: [`${p.qtySold} unité${p.qtySold > 1 ? "s" : ""} vendue${p.qtySold > 1 ? "s" : ""}`],
              amount: formatCurrency(p.caSold),
              amountHint:
                p.margeSold !== 0 ? (
                  <span className="t-success">+{formatCurrency(p.margeSold)}</span>
                ) : undefined,
              detailTitle: p.displayName,
              details: [
                { label: "Quantité vendue", value: `${p.qtySold}` },
                { label: "Chiffre d'affaires", value: formatCurrency(p.caSold) },
                {
                  label: "Marge générée",
                  value: <span className="t-success">+{formatCurrency(p.margeSold)}</span>,
                },
              ],
            }))}
          />
        </div>
      </div>
    </div>
  );
};
