import React, { useState, useMemo } from "react";
import { Expense, Seller, LocaleSetting, StoreSettings } from "../types";
import {
  ArrowRightLeft,
  Plus,
  Wallet,
  FileText,
  Edit3,
  Trash2,
  Printer,
  Search,
  Filter,
  Download,
  X,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";

interface DepensesViewProps {
  expenses: Expense[];
  sellers: Seller[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  onAddExpense: (expense: {
    date: string;
    vendeur: string;
    type: "Achat de stock" | "Retrait d'argent" | "Autre dépense";
    montant: number;
    note: string;
  }) => void;
  onEditExpense?: (updatedExpense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
}

export const DepensesView: React.FC<DepensesViewProps> = ({
  expenses,
  sellers,
  locale,
  settings,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [sellerFilter, setSellerFilter] = useState("Tous");
  const [typeFilter, setTypeFilter] = useState("Tous");

  // Print & Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportSeller, setSelectedReportSeller] = useState("all");
  const [reportPeriod, setReportPeriod] = useState<"today" | "month" | "all">("today");
  const [reportFormat, setReportFormat] = useState<"ticket" | "a4">("ticket");

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendeur, setVendeur] = useState(sellers[0]?.nom || "");
  const [type, setType] = useState<"Achat de stock" | "Retrait d'argent" | "Autre dépense">(
    "Retrait d'argent",
  );
  const [montant, setMontant] = useState(5000);
  const [note, setNote] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendeur || montant <= 0) return;

    onAddExpense({
      date,
      vendeur,
      type,
      montant: Number(montant),
      note: note.trim(),
    });

    setNote("");
    setIsModalOpen(false);
  };

  // Filtered Expenses for Table
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        e.vendeur.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.note.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSeller = sellerFilter === "Tous" || e.vendeur === sellerFilter;
      const matchType = typeFilter === "Tous" || e.type === typeFilter;
      return matchSearch && matchSeller && matchType;
    });
  }, [expenses, searchTerm, sellerFilter, typeFilter]);

  // Breakdown KPIs
  const totalDepenses = expenses.reduce((acc, e) => acc + e.montant, 0);
  const totalRetraits = expenses
    .filter((e) => e.type === "Retrait d'argent")
    .reduce((acc, e) => acc + e.montant, 0);
  const totalAchatsStock = expenses
    .filter((e) => e.type === "Achat de stock")
    .reduce((acc, e) => acc + e.montant, 0);
  const totalAutres = expenses
    .filter((e) => e.type === "Autre dépense")
    .reduce((acc, e) => acc + e.montant, 0);

  // Filtered Data for Report Generator
  const reportExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSeller =
        selectedReportSeller === "all" ||
        e.vendeur.toLowerCase() === selectedReportSeller.toLowerCase();
      const matchPeriod =
        reportPeriod === "today"
          ? e.date === todayStr
          : reportPeriod === "month"
            ? e.date.startsWith(currentMonthStr)
            : true;
      return matchSeller && matchPeriod;
    });
  }, [expenses, selectedReportSeller, reportPeriod, todayStr, currentMonthStr]);

  const reportTotalAmount = useMemo(
    () => reportExpenses.reduce((acc, e) => acc + e.montant, 0),
    [reportExpenses],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-rose-400" />
            Onglet Dépenses Vendeurs & Retraits de Caisse
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Impact unifié : Réduit la Trésorerie Globale (Capital) ET le solde individuel en poche
            du vendeur en une seule saisie.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-accent text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            title="Imprimer ou exporter le journal des dépenses et retraits"
          >
            <Printer className="w-4 h-4 text-rose-400" />
            Imprimer / Exporter
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Enregistrer une Dépense
          </button>
        </div>
      </div>

      {/* Replacement: Interactive Actions & Category Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-card border border-border p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-muted-foreground font-medium block">Total Dépenses :</span>
            <span className="text-base font-bold font-mono text-rose-400">
              {formatCurrency(totalDepenses)}
            </span>
          </div>
          <TrendingDown className="w-5 h-5 text-rose-400" />
        </div>

        <div className="bg-card border border-border p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-muted-foreground font-medium block">Retraits d'Argent :</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {formatCurrency(totalRetraits)}
            </span>
          </div>
          <Wallet className="w-5 h-5 text-amber-400" />
        </div>

        <div className="bg-card border border-border p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-muted-foreground font-medium block">Achats de Stock :</span>
            <span className="text-base font-bold font-mono text-purple-400">
              {formatCurrency(totalAchatsStock)}
            </span>
          </div>
          <ShoppingBag className="w-5 h-5 text-purple-400" />
        </div>

        <div className="bg-card border border-border p-3.5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-muted-foreground font-medium block">Autres Frais :</span>
            <span className="text-base font-bold font-mono text-sky-400">
              {formatCurrency(totalAutres)}
            </span>
          </div>
          <ArrowRightLeft className="w-5 h-5 text-sky-400" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher vendeur, note, ID..."
            className="w-full bg-muted border border-muted-foreground/20 rounded-xl pl-9 pr-3 py-1.5 text-foreground placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-semibold">Vendeur :</span>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="Tous">Tous les vendeurs</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.nom}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">Type :</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="Tous">Tous les types</option>
              <option value="Retrait d'argent">Retrait d'argent</option>
              <option value="Achat de stock">Achat de stock</option>
              <option value="Autre dépense">Autre dépense</option>
            </select>
          </div>

          {(searchTerm || sellerFilter !== "Tous" || typeFilter !== "Tous") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSellerFilter("Tous");
                setTypeFilter("Tous");
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground bg-muted border border-muted-foreground/20 rounded-xl transition-colors"
              title="Réinitialiser filtres"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="app-table-wrap">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5">ID Dépense</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Vendeur Concerné</th>
                <th className="px-4 py-3.5">Type de Mouvement</th>
                <th className="px-4 py-3.5 text-right">Montant (Ar)</th>
                <th className="px-4 py-3.5">Note / Commentaire</th>
                <th className="px-4 py-3.5 text-right">Impact Trésorerie</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aucune dépense ne correspond à votre sélection.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{e.numero}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {formatDateLocale(e.date, locale)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-foreground">{e.vendeur}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          e.type === "Achat de stock"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : e.type === "Retrait d'argent"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-accent text-muted-foreground"
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-400">
                      {formatCurrency(e.montant)}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground italic max-w-xs truncate">
                      {e.note || "Aucune note"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-400">
                      - {formatCurrency(e.montant)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onEditExpense && (
                          <button
                            onClick={() => setEditingExpense(e)}
                            className="p-1.5 text-muted-foreground hover:text-blue-400 bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Modifier cette dépense"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteExpense && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Supprimer la dépense ${e.numero} (${e.vendeur}) ?`)) {
                                onDeleteExpense(e.id);
                              }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-400 bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Supprimer cette dépense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print & Export Report Modal for Expenses */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl text-foreground space-y-6 my-8">
            {/* Modal Header */}
            <div className="space-y-4 border-b border-border pb-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-rose-400" />
                  <h3 className="text-base font-bold text-foreground">
                    Journal & Relevé des Dépenses Vendeurs
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer Document
                  </button>
                  <button
                    onClick={() => {
                      const textContent = `
=== ${settings?.storeName || "BALSAMA AUTO GESTION"} ===
JOURNAL DES DÉPENSES & RETRAITS VENDEURS
VENDEUR: ${selectedReportSeller === "all" ? "TOUS LES VENDEURS" : selectedReportSeller.toUpperCase()}
PÉRIODE: ${reportPeriod === "today" ? "Aujourd'hui" : reportPeriod === "month" ? "Ce Mois-ci" : "Tout l'historique"}
Date de génération: ${new Date().toLocaleString()}
------------------------------------------------
TOTAL DÉPENSES PÉRIODE: ${formatCurrency(reportTotalAmount)} (${reportExpenses.length} lignes)
------------------------------------------------
${reportExpenses
  .map(
    (e) =>
      `[${e.date}] ${e.numero} | ${e.vendeur} | ${e.type} | Montant: ${formatCurrency(e.montant)} | Note: ${
        e.note || "-"
      }`,
  )
  .join("\n")}
================================================
                      `.trim();

                      const element = document.createElement("a");
                      const file = new Blob([textContent], { type: "text/plain" });
                      element.href = URL.createObjectURL(file);
                      element.download = `Journal_Depenses_${selectedReportSeller}_${reportPeriod}.txt`;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-foreground border border-muted-foreground/20 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter (.TXT)
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background p-3 rounded-xl border border-border text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Vendeur Sélectionné :
                  </label>
                  <select
                    value={selectedReportSeller}
                    onChange={(e) => setSelectedReportSeller(e.target.value)}
                    className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="all">Tous les Vendeurs</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.nom}>
                        {s.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Période d'Activité :
                  </label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="today">Aujourd'hui ({todayStr})</option>
                    <option value="month">Ce Mois-ci ({currentMonthStr})</option>
                    <option value="all">Tout l'historique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Format :
                  </label>
                  <div className="flex items-center bg-muted p-0.5 rounded-lg border border-muted-foreground/20">
                    <button
                      onClick={() => setReportFormat("ticket")}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                        reportFormat === "ticket"
                          ? "bg-rose-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Receipt className="w-3 h-3" />
                      Ticket
                    </button>
                    <button
                      onClick={() => setReportFormat("a4")}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                        reportFormat === "a4"
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      A4
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Printable Area */}
            <div className="flex justify-center bg-background p-4 rounded-xl border border-border max-h-[60vh] overflow-y-auto">
              {reportFormat === "ticket" ? (
                <div className="printable-receipt bg-amber-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-amber-200">
                  <div className="text-center space-y-1">
                    {settings?.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt="Logo"
                        className="w-12 h-12 mx-auto mb-1 object-cover rounded-full"
                      />
                    )}
                    <h2 className="font-bold text-sm tracking-wide text-slate-950 uppercase">
                      {settings?.storeName || "BALSAMA AUTO GESTION"}
                    </h2>
                    <p className="text-[10px] text-slate-600">
                      Tél: {settings?.phone || "+261 34 12 345 67"}
                    </p>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-xs uppercase bg-rose-200 py-0.5 rounded text-rose-950">
                      JOURNAL DES DÉPENSES
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-800">
                      VENDEUR :{" "}
                      <span className="font-bold uppercase text-slate-950">
                        {selectedReportSeller === "all"
                          ? "TOUS LES VENDEURS"
                          : selectedReportSeller}
                      </span>
                    </p>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between font-bold text-rose-900 bg-rose-100 p-1.5 rounded">
                      <span>TOTAL DÉPENSES :</span>
                      <span>{formatCurrency(reportTotalAmount)}</span>
                    </div>
                    <div className="text-right text-[9px] text-slate-600">
                      {reportExpenses.length} transaction(s)
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  <div className="space-y-2">
                    <p className="font-bold text-[10px] uppercase text-slate-700">
                      Détail des lignes :
                    </p>
                    {reportExpenses.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        Aucune dépense pour cette sélection.
                      </p>
                    ) : (
                      <table className="w-full text-[9px] text-left">
                        <thead>
                          <tr className="border-b border-slate-300 font-bold uppercase">
                            <th className="py-1">Type / Note</th>
                            <th className="py-1 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportExpenses.map((e) => (
                            <tr key={e.id}>
                              <td className="py-1 pr-1">
                                <span className="font-bold block">{e.vendeur}</span>
                                <span className="text-[8px] text-slate-600 block">
                                  {e.type} - {e.note || "Sans note"}
                                </span>
                              </td>
                              <td className="py-1 text-right font-bold text-rose-900">
                                {formatCurrency(e.montant)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>
                  <div className="text-center text-[9px] text-slate-600 italic">
                    Émis le {new Date().toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="printable-receipt bg-white text-slate-900 w-full max-w-xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div>
                      <h1 className="text-lg font-black text-slate-900 uppercase">
                        {settings?.storeName || "BALSAMA AUTO GESTION"}
                      </h1>
                      <p className="text-muted-foreground text-[11px]">
                        Journal des Dépenses & Retraits
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="inline-block bg-rose-600 text-white px-3 py-1 rounded font-bold text-xs uppercase">
                        RELEVÉ DÉPENSES
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Édité le {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Vendeur :
                      </span>
                      <span className="font-black text-slate-900 text-sm">
                        {selectedReportSeller === "all"
                          ? "TOUS LES VENDEURS"
                          : selectedReportSeller}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Total Période :
                      </span>
                      <span className="font-black text-rose-600 text-sm font-mono">
                        {formatCurrency(reportTotalAmount)}
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-y border-slate-300">
                        <th className="p-2">Date</th>
                        <th className="p-2">Vendeur</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Motif / Note</th>
                        <th className="p-2 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reportExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                            Aucune dépense enregistrée.
                          </td>
                        </tr>
                      ) : (
                        reportExpenses.map((e) => (
                          <tr key={e.id}>
                            <td className="p-2 font-mono text-muted-foreground">{e.date}</td>
                            <td className="p-2 font-bold text-slate-900">{e.vendeur}</td>
                            <td className="p-2">{e.type}</td>
                            <td className="p-2 text-slate-600">{e.note || "-"}</td>
                            <td className="p-2 text-right font-bold text-rose-600 font-mono">
                              {formatCurrency(e.montant)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-rose-400" />
              Saisie d'une Dépense / Retrait Vendeur
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Date :</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Vendeur concerné :
                </label>
                <select
                  value={vendeur}
                  onChange={(e) => setVendeur(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-semibold focus:outline-none focus:border-emerald-500"
                >
                  {sellers.map((v) => (
                    <option key={v.id} value={v.nom}>
                      {v.nom} (Solde en poche actuel : {v.soldeNetEnPoche} Ar)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Type de dépense :
                </label>
                <select
                  value={type}
                  onChange={(e: any) => setType(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="Retrait d'argent">Retrait d'argent (Avance / Commission)</option>
                  <option value="Achat de stock">Achat de stock / Matériel d'urgence</option>
                  <option value="Autre dépense">Autre dépense (Transport, Repas...)</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Montant (Ar) :
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value))}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Motif / Note :
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ex: Transport livraison ou avance commission"
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Valider la Dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" />
              Modification Dépense {editingExpense.numero}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onEditExpense) return;
                onEditExpense({
                  ...editingExpense,
                  impactTresorerieGlobale: -editingExpense.montant,
                });
                setEditingExpense(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Date :</label>
                <input
                  type="date"
                  required
                  value={editingExpense.date}
                  onChange={(ev) => setEditingExpense({ ...editingExpense, date: ev.target.value })}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Vendeur concerné :
                </label>
                <select
                  value={editingExpense.vendeur}
                  onChange={(ev) =>
                    setEditingExpense({ ...editingExpense, vendeur: ev.target.value })
                  }
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-semibold focus:outline-none focus:border-blue-500"
                >
                  {sellers.map((v) => (
                    <option key={v.id} value={v.nom}>
                      {v.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Type de dépense :
                </label>
                <select
                  value={editingExpense.type}
                  onChange={(ev: any) =>
                    setEditingExpense({ ...editingExpense, type: ev.target.value })
                  }
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-blue-500"
                >
                  <option value="Retrait d'argent">Retrait d'argent (Avance / Commission)</option>
                  <option value="Achat de stock">Achat de stock / Matériel d'urgence</option>
                  <option value="Autre dépense">Autre dépense (Transport, Repas...)</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Montant (Ar) :
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editingExpense.montant}
                  onChange={(ev) =>
                    setEditingExpense({ ...editingExpense, montant: Number(ev.target.value) })
                  }
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Motif / Note :
                </label>
                <textarea
                  rows={2}
                  value={editingExpense.note}
                  onChange={(ev) => setEditingExpense({ ...editingExpense, note: ev.target.value })}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Enregistrer Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};