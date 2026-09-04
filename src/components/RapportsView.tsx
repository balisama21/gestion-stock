import React, { useState } from "react";
import { Sale, Purchase, Expense, Product, LocaleSetting } from "../types";
import { CalendarRange, PieChart, BarChart3 } from "lucide-react";
import { formatCurrency } from "../utils/formulas";
import { DataList } from "./shared/DataList";
import { PageHeader } from "./shared/PageHeader";

interface RapportsViewProps {
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  products: Product[];
  locale: LocaleSetting;
}

export const RapportsView: React.FC<RapportsViewProps> = ({ sales, purchases, expenses }) => {
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

  // Un mois sans la moindre écriture n'apporte rien à la lecture : douze
  // lignes à zéro noieraient les trois qui comptent.
  const activeMonths = monthlyStats.filter(
    (ms) => ms.ca > 0 || ms.achats > 0 || ms.depenses > 0,
  );

  /**
   * Les trois horizons, en colonnes. Le tableau est transposé par rapport
   * à ce qu'on écrirait spontanément — les postes en lignes, les périodes
   * en colonnes — parce que la question posée à cette page est « combien
   * ce mois par rapport à aujourd'hui », et qu'on compare de l'œil bien
   * mieux le long d'une ligne que d'une colonne à l'autre.
   */
  const periodes = [
    {
      id: "jour",
      titre: "Jour",
      detail: customFilterDate.toLocaleDateString("fr-FR"),
      ca: caToday,
      achats: achatsToday,
      depenses: depensesToday,
      marge: margeToday,
      nbVentes: salesToday.length,
    },
    {
      id: "mois",
      titre: "Mois",
      detail: `${monthNames[filterMonth]} ${filterYear}`,
      ca: caMonth,
      achats: achatsMonth,
      depenses: depensesMonth,
      marge: margeMonth,
      nbVentes: salesMonth.length,
    },
    {
      id: "annee",
      titre: "Année",
      detail: String(filterYear),
      ca: caYear,
      achats: achatsYear,
      depenses: depensesYear,
      marge: margeYear,
      nbVentes: salesYear.length,
    },
  ];

  type Periode = (typeof periodes)[number];

  const lignes: {
    key: string;
    label: string;
    render: (p: Periode) => React.ReactNode;
    strong?: boolean;
  }[] = [
    {
      key: "ca",
      label: "Chiffre d'affaires",
      render: (p) => formatCurrency(p.ca),
      strong: true,
    },
    { key: "achats", label: "Achats de stock", render: (p) => formatCurrency(p.achats) },
    { key: "depenses", label: "Dépenses", render: (p) => formatCurrency(p.depenses) },
    {
      key: "marge",
      label: "Marge nette",
      render: (p) => <span className="t-success">+{formatCurrency(p.marge)}</span>,
      strong: true,
    },
    { key: "ventes", label: "Ventes", render: (p) => String(p.nbVentes) },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<CalendarRange className="h-5 w-5 text-muted-foreground" />}
        title="Bilan"
        subtitle="Vos ventes, achats, dépenses et marges sur la période choisie."
        actions={
          <label className="flex w-full flex-col gap-1.5 sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground">Date de référence</span>
            <input
              type="date"
              value={selectedDateInput}
              onChange={(e) => setSelectedDateInput(e.target.value)}
              className="app-field font-mono sm:w-44"
            />
          </label>
        }
      />

      {/* Synthèse comparative.
          La page affichait ces douze chiffres deux fois : une fois dans
          trois grandes cartes colorées, une seconde dans un tableau de six
          colonnes doublé de cartes mobiles. Il n'en reste qu'un tableau,
          quatre colonnes, `table-fixed` pour qu'un montant long passe à la
          ligne au lieu de pousser une barre de défilement. */}
      <div className="app-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="app-section-title">
            <PieChart className="h-4 w-4" />
            Synthèse comparative
          </h3>
        </div>

        <table className="app-table w-full table-fixed">
          <thead>
            <tr>
              <th className="w-[32%] px-2 text-left sm:px-4">Poste</th>
              {periodes.map((p) => (
                <th key={p.id} className="px-2 text-right sm:px-4">
                  <span className="block">{p.titre}</span>
                  <span className="block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                    {p.detail}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {lignes.map((l) => (
              <tr key={l.key}>
                <td className="px-2 text-xs text-muted-foreground sm:px-4 sm:text-sm">
                  {l.label}
                </td>
                {periodes.map((p) => (
                  <td
                    key={p.id}
                    className={`px-2 text-right font-mono text-xs tabular-nums sm:px-4 sm:text-sm ${
                      l.strong ? "font-medium text-foreground" : "text-foreground"
                    }`}
                  >
                    {l.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mois par mois.
          Douze cartes de quatre lignes colorées deviennent douze lignes de
          liste : le chiffre d'affaires tombe dans la même colonne d'un mois
          à l'autre, ce qui est la seule façon de les comparer d'un regard. */}
      <div className="app-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="app-section-title">
            <BarChart3 className="h-4 w-4" />
            Mois par mois
          </h3>
          <span className="text-xs text-muted-foreground">{filterYear}</span>
        </div>

        <DataList
          emptyLabel={`Aucune activité enregistrée en ${filterYear}.`}
          items={activeMonths.map((ms) => ({
            id: ms.month,
            primary: (
              <span className="flex items-center gap-2">
                <span className="truncate">{ms.month}</span>
                {ms.index === filterMonth && (
                  <span className="app-badge app-badge-neutral shrink-0">Mois en cours</span>
                )}
              </span>
            ),
            meta: [
              ms.countSales > 0
                ? `${ms.countSales} vente${ms.countSales > 1 ? "s" : ""}`
                : null,
              ms.achats > 0 ? `${formatCurrency(ms.achats)} d'achats` : null,
              ms.depenses > 0 ? `${formatCurrency(ms.depenses)} de dépenses` : null,
            ],
            amount: formatCurrency(ms.ca),
            amountHint:
              ms.marge !== 0 ? (
                <span className="t-success">+{formatCurrency(ms.marge)}</span>
              ) : undefined,
            detailTitle: `${ms.month} ${filterYear}`,
            detailSubtitle: "Détail du mois",
            details: [
              { label: "Chiffre d'affaires", value: formatCurrency(ms.ca) },
              {
                label: "Achats de stock",
                value: ms.achats > 0 ? formatCurrency(ms.achats) : "",
                hideIfEmpty: true,
              },
              {
                label: "Dépenses",
                value: ms.depenses > 0 ? formatCurrency(ms.depenses) : "",
                hideIfEmpty: true,
              },
              {
                label: "Marge nette",
                value: <span className="t-success">+{formatCurrency(ms.marge)}</span>,
              },
              { label: "Ventes", value: String(ms.countSales) },
            ],
          }))}
        />
      </div>
    </div>
  );
};
