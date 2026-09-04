import React, { useState } from "react";
import { Sale, Purchase, Expense, Product, LocaleSetting } from "../types";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  ShoppingCart,
  ArrowRightLeft,
  DollarSign,
  PieChart,
  BarChart3,
  Award,
  Filter,
} from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { MobileCardList } from "./shared/MobileCardList";
import { PageHeader } from "./shared/PageHeader";

interface RapportsViewProps {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  locale: LocaleSetting;
}

export const RapportsView: React.FC<RapportsViewProps> = ({
  sales,
  purchases,
  expenses,
  products,
  locale,
}) => {
  // Helper to parse DD/MM/YYYY into JS Date object
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentYear = today.getFullYear();

  // Selected date for custom filter
  const [selectedDateInput, setSelectedDateInput] = useState<string>(
    today.toISOString().split("T")[0], // YYYY-MM-DD
  );

  const customFilterDate = selectedDateInput ? new Date(selectedDateInput) : today;
  const filterDay = customFilterDate.getDate();
  const filterMonth = customFilterDate.getMonth();
  const filterYear = customFilterDate.getFullYear();

  // Helper matching functions
  const isSameDay = (dStr: string, targetDay: number, targetMonth: number, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return (
      d.getDate() === targetDay && d.getMonth() === targetMonth && d.getFullYear() === targetYear
    );
  };

  const isSameMonth = (dStr: string, targetMonth: number, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  };

  const isSameYear = (dStr: string, targetYear: number) => {
    const d = parseDate(dStr);
    if (!d) return false;
    return d.getFullYear() === targetYear;
  };

  // 1. CALCULATIONS FOR TODAY (or selected filter date)
  const salesToday = sales.filter((s) => isSameDay(s.date, filterDay, filterMonth, filterYear));
  const purchasesToday = purchases.filter((p) =>
    isSameDay(p.date, filterDay, filterMonth, filterYear),
  );
  const expensesToday = expenses.filter((e) =>
    isSameDay(e.date, filterDay, filterMonth, filterYear),
  );

  const caToday = salesToday.reduce((acc, s) => acc + s.totalVente, 0);
  const achatsToday = purchasesToday.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesToday = expensesToday.reduce((acc, e) => acc + e.montant, 0);
  const margeToday = salesToday.reduce((acc, s) => acc + s.margeTotale, 0);

  // 2. CALCULATIONS FOR THIS MONTH
  const salesMonth = sales.filter((s) => isSameMonth(s.date, filterMonth, filterYear));
  const purchasesMonth = purchases.filter((p) => isSameMonth(p.date, filterMonth, filterYear));
  const expensesMonth = expenses.filter((e) => isSameMonth(e.date, filterMonth, filterYear));

  const caMonth = salesMonth.reduce((acc, s) => acc + s.totalVente, 0);
  const achatsMonth = purchasesMonth.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesMonth = expensesMonth.reduce((acc, e) => acc + e.montant, 0);
  const margeMonth = salesMonth.reduce((acc, s) => acc + s.margeTotale, 0);

  // 3. CALCULATIONS FOR THIS YEAR
  const salesYear = sales.filter((s) => isSameYear(s.date, filterYear));
  const purchasesYear = purchases.filter((p) => isSameYear(p.date, filterYear));
  const expensesYear = expenses.filter((e) => isSameYear(e.date, filterYear));

  const caYear = salesYear.reduce((acc, s) => acc + s.totalVente, 0);
  const achatsYear = purchasesYear.reduce((acc, p) => acc + p.totalAchat, 0);
  const depensesYear = expensesYear.reduce((acc, e) => acc + e.montant, 0);
  const margeYear = salesYear.reduce((acc, s) => acc + s.margeTotale, 0);

  // Month names in French
  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  // Monthly Breakdown for current year (Jan to Dec)
  const monthlyStats = monthNames.map((mName, mIdx) => {
    const mSales = sales.filter((s) => isSameMonth(s.date, mIdx, filterYear));
    const mPurchases = purchases.filter((p) => isSameMonth(p.date, mIdx, filterYear));
    const mExpenses = expenses.filter((e) => isSameMonth(e.date, mIdx, filterYear));

    const ca = mSales.reduce((acc, s) => acc + s.totalVente, 0);
    const achats = mPurchases.reduce((acc, p) => acc + p.totalAchat, 0);
    const depenses = mExpenses.reduce((acc, e) => acc + e.montant, 0);
    const marge = mSales.reduce((acc, s) => acc + s.margeTotale, 0);

    return { month: mName, index: mIdx, ca, achats, depenses, marge, countSales: mSales.length };
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<CalendarRange className="w-5 h-5 t-warning" />}
        title="Bilan"
        subtitle="Vos ventes, achats, dépenses et marges sur la période choisie."
        actions={
          <label className="flex w-full flex-col gap-1.5 sm:w-auto">
            <span className="text-xs font-semibold text-muted-foreground">Date de référence</span>
            <input
              type="date"
              value={selectedDateInput}
              onChange={(e) => setSelectedDateInput(e.target.value)}
              className="app-field font-mono sm:w-44"
            />
          </label>
        }
      />

      {/* THREE CARDS FOR JOUR, MOIS, ANNÉE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: AUJOURD'HUI */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 t-success" />
              <h3 className="font-bold text-sm text-foreground">
                Bilan du Jour ({customFilterDate.toLocaleDateString("fr-FR")})
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 t-success border border-emerald-500/30 rounded-full font-mono font-bold">
              {salesToday.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 t-success" />
                Chiffre d'Affaires (CA Ventes) :
              </div>
              <div className="text-2xl font-extrabold font-mono t-success mt-0.5">
                {formatCurrency(caToday)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 t-info" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono t-info mt-0.5">
                  {formatCurrency(achatsToday)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 t-danger" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono t-danger mt-0.5">
                  {formatCurrency(depensesToday)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-success-soft border border-success-border rounded-xl flex items-center justify-between text-xs">
              <span className="t-success font-semibold">Marge Nette du Jour :</span>
              <span className="font-bold font-mono t-success text-sm">
                +{formatCurrency(margeToday)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: CE MOIS-CI */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 t-info" />
              <h3 className="font-bold text-sm text-foreground">
                Bilan du Mois ({monthNames[filterMonth]} {filterYear})
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 t-info border border-blue-500/30 rounded-full font-mono font-bold">
              {salesMonth.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 t-info" />
                Chiffre d'Affaires du Mois :
              </div>
              <div className="text-2xl font-extrabold font-mono t-info mt-0.5">
                {formatCurrency(caMonth)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 t-info" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono t-info mt-0.5">
                  {formatCurrency(achatsMonth)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 t-danger" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono t-danger mt-0.5">
                  {formatCurrency(depensesMonth)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-info-soft border border-info-border rounded-xl flex items-center justify-between text-xs">
              <span className="t-info font-semibold">Marge Nette du Mois :</span>
              <span className="font-bold font-mono t-info text-sm">
                +{formatCurrency(margeMonth)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: CETTE ANNÉE */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 t-violet" />
              <h3 className="font-bold text-sm text-foreground">Bilan Annuel ({filterYear})</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 t-violet border border-purple-500/30 rounded-full font-mono font-bold">
              {salesYear.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 t-violet" />
                CA Total Année :
              </div>
              <div className="text-2xl font-extrabold font-mono t-violet mt-0.5">
                {formatCurrency(caYear)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 t-info" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono t-info mt-0.5">
                  {formatCurrency(achatsYear)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 t-danger" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono t-danger mt-0.5">
                  {formatCurrency(depensesYear)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-violet-soft border border-violet-border rounded-xl flex items-center justify-between text-xs">
              <span className="t-violet font-semibold">Marge Nette Annuelle :</span>
              <span className="font-bold font-mono t-violet text-sm">
                +{formatCurrency(margeYear)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparatif des périodes — une seule source de données pour le
          tableau desktop et les cartes mobiles, pour qu'ils ne puissent
          pas diverger. */}
      {(() => {
        const periodes = [
          {
            id: "jour",
            libelle: `Aujourd'hui (${customFilterDate.toLocaleDateString("fr-FR")})`,
            ton: "t-success",
            pastille: "bg-success",
            ca: caToday,
            achats: achatsToday,
            depenses: depensesToday,
            marge: margeToday,
            nbVentes: salesToday.length,
          },
          {
            id: "mois",
            libelle: `Ce mois (${monthNames[filterMonth]} ${filterYear})`,
            ton: "t-info",
            pastille: "bg-info",
            ca: caMonth,
            achats: achatsMonth,
            depenses: depensesMonth,
            marge: margeMonth,
            nbVentes: salesMonth.length,
          },
          {
            id: "annee",
            libelle: `Cette année (${filterYear})`,
            ton: "t-violet",
            pastille: "bg-violet",
            ca: caYear,
            achats: achatsYear,
            depenses: depensesYear,
            marge: margeYear,
            nbVentes: salesYear.length,
          },
        ];

        return (
          <div className="app-card space-y-4 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
              <PieChart className="w-5 h-5 t-warning" />
              Comparatif des périodes
            </h3>

            {/* Cartes mobiles */}
            <div className="lg:hidden">
              <MobileCardList
                items={periodes.map((p) => ({
                  id: p.id,
                  title: p.libelle,
                  subtitle: `${p.nbVentes} vente${p.nbVentes > 1 ? "s" : ""}`,
                  amount: formatCurrency(p.ca),
                  fields: [
                    { label: "Chiffre d'affaires", value: formatCurrency(p.ca) },
                    { label: "Achats de stock", value: formatCurrency(p.achats) },
                    { label: "Dépenses", value: formatCurrency(p.depenses) },
                    {
                      label: "Marge nette",
                      value: <span className={p.ton}>+{formatCurrency(p.marge)}</span>,
                    },
                    { label: "Nombre de ventes", value: `${p.nbVentes}` },
                  ],
                }))}
              />
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/80 text-[11px] font-semibold uppercase text-muted-foreground">
                    <th className="p-3">Période</th>
                    <th className="p-3 text-right">Chiffre d'affaires</th>
                    <th className="p-3 text-right">Achats de stock</th>
                    <th className="p-3 text-right">Dépenses</th>
                    <th className="p-3 text-right">Marge nette</th>
                    <th className="p-3 text-center">Ventes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {periodes.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      <td className={`flex items-center gap-2 p-3 font-bold ${p.ton}`}>
                        <span className={`h-2 w-2 rounded-full ${p.pastille}`} />
                        {p.libelle}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {formatCurrency(p.ca)}
                      </td>
                      <td className="p-3 text-right font-mono t-info">
                        {formatCurrency(p.achats)}
                      </td>
                      <td className="p-3 text-right font-mono t-danger">
                        {formatCurrency(p.depenses)}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${p.ton}`}>
                        +{formatCurrency(p.marge)}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                        {p.nbVentes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* MONTHLY BREAKDOWN BAR LIST (Jan - Dec) */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 t-success" />
          Répartition Mois par Mois (Année {filterYear})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {monthlyStats.map((ms) => {
            const isCurrentM = ms.index === filterMonth;
            return (
              <div
                key={ms.month}
                className={`p-4 rounded-xl border transition-colors ${
                  isCurrentM
                    ? "bg-muted border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                    : "bg-muted/50 border-border hover:border-muted-foreground/40"
                }`}
              >
                <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                  <span className="font-bold text-foreground text-sm">{ms.month}</span>
                  {isCurrentM && (
                    <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 t-success rounded-full font-semibold">
                      Mois Actuel
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CA Ventes:</span>
                    <span className="font-bold font-mono t-success">
                      {formatCurrency(ms.ca)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Achats Stock:</span>
                    <span className="font-mono t-info">{formatCurrency(ms.achats)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dépenses:</span>
                    <span className="font-mono t-danger">{formatCurrency(ms.depenses)}</span>
                  </div>

                  <div className="flex justify-between pt-1.5 border-t border-border font-semibold">
                    <span className="text-muted-foreground">Marge:</span>
                    <span className="font-mono t-warning">+{formatCurrency(ms.marge)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
