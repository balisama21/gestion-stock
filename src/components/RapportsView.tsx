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
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Rapports & Bilan Périodique (Jour, Mois, Année)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suivi consolidé du Chiffre d'Affaires (CA), des Achats de Stock, Dépenses Vendeurs et
              Marges.
            </p>
          </div>
        </div>

        {/* Date Selector Filter */}
        <div className="flex items-center gap-2 bg-muted/80 p-2 rounded-xl border border-muted-foreground/20/80 text-xs">
          <Filter className="w-4 h-4 text-amber-400" />
          <span className="text-muted-foreground font-medium">Changer la date :</span>
          <input
            type="date"
            value={selectedDateInput}
            onChange={(e) => setSelectedDateInput(e.target.value)}
            className="bg-card border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* THREE CARDS FOR JOUR, MOIS, ANNÉE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARD 1: AUJOURD'HUI */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-foreground">
                Bilan du Jour ({customFilterDate.toLocaleDateString("fr-FR")})
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono font-bold">
              {salesToday.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Chiffre d'Affaires (CA Ventes) :
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
                {formatCurrency(caToday)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 text-sky-400" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono text-sky-300 mt-0.5">
                  {formatCurrency(achatsToday)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-rose-400" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono text-rose-400 mt-0.5">
                  {formatCurrency(depensesToday)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-semibold">Marge Nette du Jour :</span>
              <span className="font-bold font-mono text-emerald-400 text-sm">
                +{formatCurrency(margeToday)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: CE MOIS-CI */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm text-foreground">
                Bilan du Mois ({monthNames[filterMonth]} {filterYear})
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full font-mono font-bold">
              {salesMonth.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                Chiffre d'Affaires du Mois :
              </div>
              <div className="text-2xl font-extrabold font-mono text-blue-400 mt-0.5">
                {formatCurrency(caMonth)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 text-sky-400" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono text-sky-300 mt-0.5">
                  {formatCurrency(achatsMonth)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-rose-400" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono text-rose-400 mt-0.5">
                  {formatCurrency(depensesMonth)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs">
              <span className="text-blue-300 font-semibold">Marge Nette du Mois :</span>
              <span className="font-bold font-mono text-blue-400 text-sm">
                +{formatCurrency(margeMonth)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: CETTE ANNÉE */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-sm text-foreground">Bilan Annuel ({filterYear})</h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full font-mono font-bold">
              {salesYear.length} vente(s)
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                CA Total Année :
              </div>
              <div className="text-2xl font-extrabold font-mono text-purple-400 mt-0.5">
                {formatCurrency(caYear)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3 text-sky-400" />
                  Achats Stock :
                </div>
                <div className="font-bold font-mono text-sky-300 mt-0.5">
                  {formatCurrency(achatsYear)}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-rose-400" />
                  Dépenses/Retraits :
                </div>
                <div className="font-bold font-mono text-rose-400 mt-0.5">
                  {formatCurrency(depensesYear)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs">
              <span className="text-purple-300 font-semibold">Marge Nette Annuelle :</span>
              <span className="font-bold font-mono text-purple-400 text-sm">
                +{formatCurrency(margeYear)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPARATIVE SYNTHESIS TABLE */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <PieChart className="w-5 h-5 text-amber-400" />
          Tableau Récapitulatif Comparatif des Périodes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/80 text-muted-foreground uppercase font-semibold text-[11px] border-b border-muted-foreground/20">
                <th className="p-3 rounded-tl-xl">Période</th>
                <th className="p-3 text-right">CA Ventes (Ar)</th>
                <th className="p-3 text-right">Achats Stock (Ar)</th>
                <th className="p-3 text-right">Dépenses/Retraits (Ar)</th>
                <th className="p-3 text-right">Marge Nette (Ar)</th>
                <th className="p-3 text-center rounded-tr-xl">Nb Ventes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 font-bold text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Aujourd'hui ({customFilterDate.toLocaleDateString("fr-FR")})
                </td>
                <td className="p-3 text-right font-mono font-bold text-foreground">
                  {formatCurrency(caToday)}
                </td>
                <td className="p-3 text-right font-mono text-sky-400">
                  {formatCurrency(achatsToday)}
                </td>
                <td className="p-3 text-right font-mono text-rose-400">
                  {formatCurrency(depensesToday)}
                </td>
                <td className="p-3 text-right font-mono font-bold text-emerald-400">
                  +{formatCurrency(margeToday)}
                </td>
                <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                  {salesToday.length}
                </td>
              </tr>

              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 font-bold text-blue-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Ce Mois ({monthNames[filterMonth]} {filterYear})
                </td>
                <td className="p-3 text-right font-mono font-bold text-foreground">
                  {formatCurrency(caMonth)}
                </td>
                <td className="p-3 text-right font-mono text-sky-400">
                  {formatCurrency(achatsMonth)}
                </td>
                <td className="p-3 text-right font-mono text-rose-400">
                  {formatCurrency(depensesMonth)}
                </td>
                <td className="p-3 text-right font-mono font-bold text-blue-400">
                  +{formatCurrency(margeMonth)}
                </td>
                <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                  {salesMonth.length}
                </td>
              </tr>

              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 font-bold text-purple-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  Cette Année ({filterYear})
                </td>
                <td className="p-3 text-right font-mono font-bold text-foreground">
                  {formatCurrency(caYear)}
                </td>
                <td className="p-3 text-right font-mono text-sky-400">
                  {formatCurrency(achatsYear)}
                </td>
                <td className="p-3 text-right font-mono text-rose-400">
                  {formatCurrency(depensesYear)}
                </td>
                <td className="p-3 text-right font-mono font-bold text-purple-400">
                  +{formatCurrency(margeYear)}
                </td>
                <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                  {salesYear.length}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MONTHLY BREAKDOWN BAR LIST (Jan - Dec) */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
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
                    : "bg-muted/50 border-muted-foreground/20/60 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between border-b border-muted-foreground/20/80 pb-2 mb-3">
                  <span className="font-bold text-foreground text-sm">{ms.month}</span>
                  {isCurrentM && (
                    <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-semibold">
                      Mois Actuel
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CA Ventes:</span>
                    <span className="font-bold font-mono text-emerald-400">
                      {formatCurrency(ms.ca)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Achats Stock:</span>
                    <span className="font-mono text-sky-300">{formatCurrency(ms.achats)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dépenses:</span>
                    <span className="font-mono text-rose-400">{formatCurrency(ms.depenses)}</span>
                  </div>

                  <div className="flex justify-between pt-1.5 border-t border-muted-foreground/20/60 font-semibold">
                    <span className="text-muted-foreground">Marge:</span>
                    <span className="font-mono text-amber-300">+{formatCurrency(ms.marge)}</span>
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
