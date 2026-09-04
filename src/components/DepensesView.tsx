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
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import { formatCurrency, formatDateLocale } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";

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
      <PageHeader
        icon={<ArrowRightLeft className="w-5 h-5 t-danger" />}
        title="Dépenses"
        subtitle="Sorties d'argent et retraits de caisse de vos vendeurs."
        actions={
          <>
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="app-btn-secondary w-full sm:w-auto"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button onClick={() => setIsModalOpen(true)} className="app-btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Nouvelle dépense
            </button>
          </>
        }
      />

      {/* Indicateurs */}
      <div className="app-statbar grid-cols-2 lg:grid-cols-4">
        <StatCol
          label="Total"
          value={formatCurrency(totalDepenses)}
          hint="toutes dépenses"
          icon={<TrendingDown className="w-5 h-5" />}
          tone="danger"
        />
        <StatCol
          label="Retraits"
          value={formatCurrency(totalRetraits)}
          hint="argent sorti de caisse"
          icon={<Wallet className="w-5 h-5" />}
          tone="warning"
        />
        <StatCol
          label="Achats de stock"
          value={formatCurrency(totalAchatsStock)}
          hint="réapprovisionnement"
          icon={<ShoppingBag className="w-5 h-5" />}
          tone="violet"
        />
        <StatCol
          label="Autres frais"
          value={formatCurrency(totalAutres)}
          hint="frais divers"
          icon={<ArrowRightLeft className="w-5 h-5" />}
          tone="info"
        />
      </div>

      {/* Recherche et filtres */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher un vendeur, une note, une référence…"
        activeFilterCount={(sellerFilter !== "Tous" ? 1 : 0) + (typeFilter !== "Tous" ? 1 : 0)}
        onReset={() => {
          setSearchTerm("");
          setSellerFilter("Tous");
          setTypeFilter("Tous");
        }}
      >
        <FilterField label="Vendeur">
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="app-field-sm lg:w-auto"
          >
            <option value="Tous">Tous les vendeurs</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.nom}>
                {s.nom}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Type">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="app-field-sm lg:w-auto"
          >
            <option value="Tous">Tous les types</option>
            <option value="Retrait d'argent">Retrait d'argent</option>
            <option value="Achat de stock">Achat de stock</option>
            <option value="Autre dépense">Autre dépense</option>
          </select>
        </FilterField>
      </FilterBar>

      {/* Liste unique — desktop ET mobile.
          Sur une dépense, ce qu'on cherche c'est « qui a sorti combien
          et pourquoi » : le motif devient donc la ligne principale, le
          vendeur et la date passent en gris, et le type sert de badge. */}
      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucune dépense ne correspond à ces filtres."
          items={filteredExpenses.map((e) => ({
            id: e.id,
            primary: e.note?.trim() || e.type,
            meta: [formatDateLocale(e.date, locale), e.vendeur],
            amount: `- ${formatCurrency(e.montant)}`,
            badge: (
              <span
                className={`app-badge ${
                  e.type === "Achat de stock"
                    ? "app-badge-info"
                    : e.type === "Retrait d'argent"
                      ? "app-badge-warning"
                      : "app-badge-neutral"
                }`}
              >
                {e.type}
              </span>
            ),
            detailTitle: e.note?.trim() || e.type,
            detailSubtitle: `Dépense ${e.numero}`,
            details: [
              { label: "Date", value: formatDateLocale(e.date, locale) },
              { label: "Référence", value: e.numero },
              { label: "Vendeur", value: e.vendeur },
              { label: "Type", value: e.type },
              { label: "Note", value: e.note || "-", hideIfEmpty: true },
              { label: "Montant", value: formatCurrency(e.montant) },
              {
                label: "Effet sur la trésorerie",
                value: (
                  <span className="t-danger">
                    {formatCurrency(e.impactTresorerieGlobale)}
                  </span>
                ),
              },
            ],
            actions: (
              <>
                {onEditExpense && (
                  <button onClick={() => setEditingExpense(e)} className="app-btn-secondary">
                    <Edit3 className="w-4 h-4" />
                    Modifier
                  </button>
                )}
                {onDeleteExpense && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer la dépense ${e.numero} ?`)) {
                        onDeleteExpense(e.id);
                      }
                    }}
                    className="app-btn-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                )}
              </>
            ),
          }))}
        />
      </div>

      {/* ── Journal & relevé des dépenses ──
          Le document imprimable est conservé tel quel. */}
      {isReportModalOpen && (
        <Modal
          open
          onClose={() => setIsReportModalOpen(false)}
          size="3xl"
          icon={<Printer className="h-4 w-4" />}
          title="Journal des dépenses"
          description={
            selectedReportSeller === "all" ? "Tous les vendeurs" : selectedReportSeller
          }
          bodyClassName="space-y-4"
          headerAside={
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
              <button
                onClick={() => setReportFormat("ticket")}
                aria-pressed={reportFormat === "ticket"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  reportFormat === "ticket"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                Ticket
              </button>
              <button
                onClick={() => setReportFormat("a4")}
                aria-pressed={reportFormat === "a4"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  reportFormat === "a4"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                A4
              </button>
            </div>
          }
          footer={
            <>
              <button onClick={() => window.print()} className="app-btn-primary">
                <Printer className="h-4 w-4" />
                Imprimer
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
                className="app-btn-secondary"
                title="Télécharger un résumé au format texte"
              >
                <Download className="h-4 w-4" />
                Exporter (.txt)
              </button>
            </>
          }
        >
            {/* Portée du document — masquée à l'impression. */}
            <div className="no-print grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Vendeur
                </label>
                <select
                  value={selectedReportSeller}
                  onChange={(e) => setSelectedReportSeller(e.target.value)}
                  className="app-field-sm"
                >
                  <option value="all">Tous les vendeurs</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.nom}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Période
                </label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as any)}
                  className="app-field-sm"
                >
                  <option value="today">Aujourd'hui ({todayStr})</option>
                  <option value="month">Ce mois-ci ({currentMonthStr})</option>
                  <option value="all">Tout l'historique</option>
                </select>
              </div>
            </div>

            {/* Printable Area */}
            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {reportFormat === "ticket" ? (
                <div className="printable-receipt mx-auto shrink-0 bg-amber-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-amber-200">
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
                <div className="printable-receipt mx-auto shrink-0 bg-white text-slate-900 w-full max-w-xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
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
        </Modal>
      )}

      {/* ── Nouvelle dépense ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        icon={<ArrowRightLeft className="h-4 w-4" />}
        title="Nouvelle dépense"
        description="Une sortie de caisse imputée à un vendeur : retrait, achat urgent, frais de terrain."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="expense-add-form" className="app-btn-primary">
              Valider la dépense
            </button>
          </>
        }
      >
        <form id="expense-add-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Date *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="app-field font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Vendeur</label>
            <select
              value={vendeur}
              onChange={(e) => setVendeur(e.target.value)}
              className="app-field"
            >
              {sellers.map((v) => (
                <option key={v.id} value={v.nom}>
                  {v.nom} — {formatCurrency(v.soldeNetEnPoche)} en poche
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="app-field"
            >
              <option value="Retrait d'argent">Retrait d'argent (avance, commission)</option>
              <option value="Achat de stock">Achat de stock ou matériel d'urgence</option>
              <option value="Autre dépense">Autre dépense (transport, repas...)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Montant (Ar) *
            </label>
            <input
              type="number"
              required
              min="1"
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="app-field font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Motif</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex : transport livraison, avance commission"
              className="app-field"
            />
          </div>
        </form>
      </Modal>

      {/* ── Modification d'une dépense ── */}
      {editingExpense && (
        <Modal
          open
          onClose={() => setEditingExpense(null)}
          size="md"
          icon={<Edit3 className="h-4 w-4" />}
          title={`Dépense ${editingExpense.numero}`}
          description={editingExpense.vendeur}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button type="submit" form="expense-edit-form" className="app-btn-primary">
                Enregistrer
              </button>
            </>
          }
        >
          <form
            id="expense-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!onEditExpense) return;
              onEditExpense({
                ...editingExpense,
                impactTresorerieGlobale: -editingExpense.montant,
              });
              setEditingExpense(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Date *</label>
              <input
                type="date"
                required
                value={editingExpense.date}
                onChange={(ev) => setEditingExpense({ ...editingExpense, date: ev.target.value })}
                className="app-field font-mono"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Vendeur</label>
              <select
                value={editingExpense.vendeur}
                onChange={(ev) =>
                  setEditingExpense({ ...editingExpense, vendeur: ev.target.value })
                }
                className="app-field"
              >
                {sellers.map((v) => (
                  <option key={v.id} value={v.nom}>
                    {v.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Type</label>
              <select
                value={editingExpense.type}
                onChange={(ev: any) =>
                  setEditingExpense({ ...editingExpense, type: ev.target.value })
                }
                className="app-field"
              >
                <option value="Retrait d'argent">Retrait d'argent (avance, commission)</option>
                <option value="Achat de stock">Achat de stock ou matériel d'urgence</option>
                <option value="Autre dépense">Autre dépense (transport, repas...)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Montant (Ar) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={editingExpense.montant}
                onChange={(ev) =>
                  setEditingExpense({ ...editingExpense, montant: Number(ev.target.value) })
                }
                className="app-field font-mono"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Motif</label>
              <textarea
                rows={2}
                value={editingExpense.note}
                onChange={(ev) => setEditingExpense({ ...editingExpense, note: ev.target.value })}
                className="app-field"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
