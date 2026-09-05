import React, { useState, useMemo } from "react";
import { Expense, Seller, LocaleSetting, StoreSettings } from "../types";
import {
  ArrowRightLeft,
  Plus,
  Wallet,
  Edit3,
  Trash2,
  Printer,
  Search,
  Filter,
  Download,
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
import { telechargerPdf } from "../lib/documentPdf";
import {
  PAPER_FORMATS,
  getPaperFormat,
  type PaperFormatId,
} from "../lib/paperFormats";

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
  /**
   * Format de papier du journal. Il détermine la disposition — ticket en
   * pleine largeur ou bilan tabulaire —, la largeur exacte de l'aperçu et
   * le format proposé par la boîte d'impression, donc celui du PDF.
   */
  const [paperId, setPaperId] = useState<PaperFormatId>("t80");
  const paper = getPaperFormat(paperId);
  const isTicket = paper.layout === "ticket";

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
  // Libellé de la période couverte, écrit une fois pour les deux
  // documents plutôt que répété dans chacun.
  const periodeLabel =
    reportPeriod === "today"
      ? `Journée du ${todayStr}`
      : reportPeriod === "month"
        ? `Mois de ${currentMonthStr}`
        : "Historique complet";

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

  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [pdfErreur, setPdfErreur] = useState<string | null>(null);

  /**
   * Le PDF reprend exactement ce que l'écran montre, masquages compris.
   * Sans cela, un collaborateur dont les prix sont cachés les
   * retrouverait en téléchargeant le journal.
   */
  const telecharger = async () => {
    if (pdfEnCours) return;
    setPdfEnCours(true);
    setPdfErreur(null);
    try {
      await telechargerPdf(
        {
          fileName: `Journal_depenses_${reportPeriod}`,
          boutique: {
            nom: settings?.storeName || "BALSAMA AUTO GESTION",
            adresse: settings?.address,
            telephone: settings?.phone,
          },
          intitule: "Journal des dépenses",
          reference: periodeLabel,
          meta: [
            { label: "Édité le", value: new Date().toLocaleDateString("fr-FR") },
            {
              label: "Vendeur",
              value:
                selectedReportSeller === "all" ? "Tous les vendeurs" : selectedReportSeller,
            },
          ],
          portee: [
            { label: "Lignes", value: String(reportExpenses.length) },
            { label: "Total", value: formatCurrency(reportTotalAmount) },
          ],
          colonnes: [
            { key: "date", label: "Date", part: 18 },
            { key: "type", label: "Type & motif" },
            { key: "vendeur", label: "Vendeur", part: 20 },
            { key: "montant", label: "Montant", align: "right" as const, part: 22 },
          ],
          lignes: reportExpenses.map((d) => ({
            cells: {
              date: formatDateLocale(d.date, locale),
              type: d.type,
              vendeur: d.vendeur,
              montant: formatCurrency(d.montant),
            },
            hint: d.note || undefined,
          })),
          vide: "Aucune dépense sur cette période.",
          totaux: [
            { label: "Lignes", value: String(reportExpenses.length) },
            {
              label: "Total des dépenses",
              value: formatCurrency(reportTotalAmount),
              fort: true,
            },
          ],
        },
        paper,
      );
    } catch (err) {
      setPdfErreur(err instanceof Error ? err.message : "Le PDF n'a pas pu être créé.");
    } finally {
      setPdfEnCours(false);
    }
  };

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
            <label className="flex items-center gap-2">
              <span className="sr-only">Format du papier</span>
              <select
                value={paperId}
                onChange={(e) => setPaperId(e.target.value as PaperFormatId)}
                className="app-field-sm w-auto min-w-[9.5rem]"
                title="Format de papier — détermine aussi le format du PDF enregistré"
              >
                {PAPER_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          }
          footer={
            <>
              <button onClick={() => window.print()} className="app-btn-secondary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
              <button
                onClick={telecharger}
                disabled={pdfEnCours}
                className="app-btn-primary"
                title={`Télécharger le PDF au format ${paper.label}`}
              >
                <Download className="h-4 w-4" />
                {pdfEnCours ? "Création..." : "Télécharger le PDF"}
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

            {/* ── Documents imprimables ──
                Même grammaire que la facture de vente : identité à
                gauche, référence du document à droite, encart de portée
                sur fond très léger, tableau à filets fins. */}
            {pdfErreur && (
              <p className="no-print rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm t-danger">
                {pdfErreur}
              </p>
            )}

            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {isTicket ? (
                /* ── Ticket ── */
                <div
                  className={`printable-receipt ${paper.pageClass} mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white p-4 font-mono leading-relaxed text-slate-900 shadow-sm ${paperId === "t58" ? "text-[10px]" : "text-[11px]"}`}
                  style={{ maxWidth: paper.previewWidth }}
                >
                  <div className="space-y-0.5 text-center">
                    {settings?.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt=""
                        className="mx-auto mb-2 h-12 w-12 rounded object-contain"
                      />
                    )}
                    <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-900">
                      {settings?.storeName || "BALSAMA AUTO GESTION"}
                    </h2>
                    <p className="text-[10px] text-slate-500">
                      Tél. {settings?.phone || "+261 34 12 345 67"}
                    </p>
                  </div>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-900">
                    Journal des dépenses
                  </p>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  <dl className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Période</dt>
                      <dd className="min-w-0 text-right text-slate-900">{periodeLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Vendeur</dt>
                      <dd className="min-w-0 text-right text-slate-900">
                        {selectedReportSeller === "all" ? "Tous" : selectedReportSeller}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Édité le</dt>
                      <dd className="text-slate-900">{new Date().toLocaleDateString("fr-FR")}</dd>
                    </div>
                  </dl>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  {reportExpenses.length === 0 ? (
                    <p className="py-2 text-center text-[10px] italic text-slate-500">
                      Aucune dépense pour cette sélection.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {reportExpenses.map((e) => (
                        <div key={e.id}>
                          <p className="font-semibold text-slate-900">{e.type}</p>
                          <div className="flex justify-between gap-3 text-[10px] text-slate-600">
                            <span className="min-w-0">{e.vendeur}</span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(e.montant)}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400">
                            {[formatDateLocale(e.date, locale), e.note].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between gap-3 border-b border-slate-900 pb-1 text-[13px] font-bold text-slate-900">
                      <span>TOTAL</span>
                      <span>{formatCurrency(reportTotalAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-3 pt-1 text-slate-600">
                      <span>Lignes</span>
                      <span className="text-slate-900">{reportExpenses.length}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Journal A4 ── */
                <div
                  className={`printable-receipt ${paper.pageClass} mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white font-sans text-xs text-slate-900 shadow-sm ${paperId === "a5" ? "p-6" : "p-8"}`}
                  style={{ maxWidth: paper.previewWidth }}
                >
                  <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
                    <div className="min-w-0 space-y-2">
                      {settings?.logoUrl && (
                        <img
                          src={settings.logoUrl}
                          alt=""
                          className="h-14 w-14 rounded object-contain"
                        />
                      )}
                      <div className="space-y-0.5">
                        <p className="text-base font-bold uppercase tracking-tight text-slate-900">
                          {settings?.storeName || "BALSAMA AUTO GESTION"}
                        </p>
                        {settings?.address && (
                          <p className="text-[11px] text-slate-500">{settings.address}</p>
                        )}
                        {settings?.phone && (
                          <p className="text-[11px] text-slate-500">Tél. {settings.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Journal des dépenses
                      </p>
                      <p className="text-lg font-bold tracking-tight text-slate-900">
                        {periodeLabel}
                      </p>
                      <dl className="space-y-0.5 pt-1 text-[11px] text-slate-500">
                        <div className="flex gap-2 sm:justify-end">
                          <dt>Édité le</dt>
                          <dd className="font-medium text-slate-700">
                            {new Date().toLocaleDateString("fr-FR")}
                          </dd>
                        </div>
                        <div className="flex gap-2 sm:justify-end">
                          <dt>Vendeur</dt>
                          <dd className="font-medium text-slate-700">
                            {selectedReportSeller === "all"
                              ? "Tous les vendeurs"
                              : selectedReportSeller}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </header>

                  <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Lignes
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {reportExpenses.length}
                      </p>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Total de la période
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {formatCurrency(reportTotalAmount)}
                      </p>
                    </div>
                  </section>

                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 px-2 font-semibold">Vendeur</th>
                        <th className="py-2 px-2 font-semibold">Type &amp; motif</th>
                        <th className="py-2 pl-2 text-right font-semibold">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center italic text-slate-500">
                            Aucune dépense enregistrée sur cette période.
                          </td>
                        </tr>
                      ) : (
                        reportExpenses.map((e, i) => (
                          <tr
                            key={e.id}
                            className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                          >
                            <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-500">
                              {formatDateLocale(e.date, locale)}
                            </td>
                            <td className="px-2 py-2.5 text-slate-700">{e.vendeur}</td>
                            <td className="px-2 py-2.5">
                              <span className="font-medium text-slate-900">{e.type}</span>
                              {e.note && (
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                  {e.note}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 text-right font-mono font-medium tabular-nums text-slate-900">
                              {formatCurrency(e.montant)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {reportExpenses.length > 0 && (
                    <div className="flex justify-end">
                      <dl className="w-full max-w-[16rem] space-y-1.5 text-[11px]">
                        <div className="flex justify-between gap-4 text-slate-500">
                          <dt>Lignes</dt>
                          <dd className="font-mono tabular-nums text-slate-700">
                            {reportExpenses.length}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-2">
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                            Total des dépenses
                          </dt>
                          <dd className="font-mono text-base font-bold tabular-nums text-slate-900">
                            {formatCurrency(reportTotalAmount)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
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
