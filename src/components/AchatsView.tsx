import React, { useState, useMemo, useRef } from "react";
import { Purchase, Product, LocaleSetting, StoreSettings } from "../types";
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  DollarSign,
  PackageCheck,
  Truck,
  FileText,

  Image as ImageIcon,
  Printer,
  Eye,
  RefreshCw,
  AlertCircle,
  Tag,
  Download,
} from "lucide-react";
import {
  formatCurrency,
  formatDateLocale,
  getProductLabel,
  getPurchaseLabel,
  getPurchaseVariant,
} from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import {
  exporterPdf,
  exporterImage,
  imprimerDocument,
  nomDeFichier,
} from "../lib/documentExport";
import {
  PAPER_FORMATS,
  getPaperFormat,
  type PaperFormatId,
} from "../lib/paperFormats";

interface AchatsViewProps {
  purchases: Purchase[];
  products: Product[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  onAddPurchase: (purchase: {
    date: string;
    designation: string;
    quantite: number;
    prixAchatUnit: number;
    fournisseur: string;
  }) => Promise<{ error: string | null }>;
  /**
   * Champs visibles pour l'utilisateur courant — `null`/`undefined` = tout
   * visible (propriétaire). Permet à un collaborateur de consulter les
   * approvisionnements (quoi, combien, quand) sans voir les prix négociés
   * ni l'identité des fournisseurs.
   * Clés possibles : prix_fournisseurs, fournisseur, paiements_fournisseurs
   * (voir src/lib/permissions.ts).
   */
  visibleFields?: string[] | null;
}

export const AchatsView: React.FC<AchatsViewProps> = ({
  purchases,
  products,
  locale,
  settings,
  onAddPurchase,
  visibleFields,
}) => {
  // null/undefined = tout visible (propriétaire). Sinon, seuls les champs
  // explicitement listés sont montrés.
  const showField = (key: string) => !visibleFields || visibleFields.includes(key);
  // `prix_fournisseurs` couvre le prix unitaire ET tous les montants qui
  // en découlent (total achat, impact trésorerie, cumuls) : afficher un
  // total en masquant le prix unitaire ne masquerait rien, puisque
  // total ÷ quantité redonne le prix.
  const showPrix = showField("prix_fournisseurs");
  const showFournisseur = showField("fournisseur");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchaseReceipt, setSelectedPurchaseReceipt] = useState<Purchase | null>(null);
  const [saving, setSaving] = useState(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("Tous");

  // Print & Export Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportSupplier, setSelectedReportSupplier] = useState("all");
  const [reportPeriod, setReportPeriod] = useState<"today" | "month" | "all">("today");
  /**
   * Format de papier du journal. Il détermine la disposition — ticket en
   * pleine largeur ou bilan tabulaire —, la largeur exacte de l'aperçu et
   * le format proposé par la boîte d'impression, donc celui du PDF.
   */
  const [paperId, setPaperId] = useState<PaperFormatId>("t80");
  const paper = getPaperFormat(paperId);
  const isTicket = paper.layout === "ticket";

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [designation, setDesignation] = useState("");
  const [quantite, setQuantite] = useState(10);
  const [prixAchatUnit, setPrixAchatUnit] = useState(1000);
  const [fournisseur, setFournisseur] = useState("");

  // Auto-fill form when selecting an existing product
  const handleSelectExistingProduct = (prodId: string) => {
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setDesignation(prod.designation);
      setPrixAchatUnit(prod.prixAchat);
      if (prod.fournisseur) setFournisseur(prod.fournisseur);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !designation.trim() || quantite <= 0 || prixAchatUnit <= 0) return;

    setSaving(true);
    const result = await onAddPurchase({
      date,
      designation: designation.trim(),
      quantite: Number(quantite),
      prixAchatUnit: Number(prixAchatUnit),
      fournisseur: fournisseur.trim(),
    });
    setSaving(false);

    if (result.error) return;

    setDesignation("");
    setIsModalOpen(false);
  };

  // Suppliers list
  const suppliersList = useMemo(() => {
    const list = new Set<string>();
    purchases.forEach((p) => {
      if (p.fournisseur) list.add(p.fournisseur);
    });
    return Array.from(list);
  }, [purchases]);

  // Dynamic Filtering
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSearch =
        p.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        // Recherche par fournisseur uniquement si le champ est autorisé :
        // sinon la barre de recherche permettrait de deviner les noms de
        // fournisseurs masqués en tâtonnant.
        (showFournisseur && p.fournisseur.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchSupplier =
        !showFournisseur || supplierFilter === "Tous" || p.fournisseur === supplierFilter;

      return matchSearch && matchSupplier;
    });
  }, [purchases, searchTerm, supplierFilter, showFournisseur]);

  // Key KPIs
  const totalAchatsMontant = purchases.reduce((acc, p) => acc + p.totalAchat, 0);
  const totalArticlesReappro = purchases.reduce((acc, p) => acc + p.quantite, 0);

  // Filtered Purchases for Report
  // Libellé de la période couverte, écrit une fois pour les deux
  // documents plutôt que répété dans chacun.
  const periodeLabel =
    reportPeriod === "today"
      ? `Journée du ${todayStr}`
      : reportPeriod === "month"
        ? `Mois de ${currentMonthStr}`
        : "Historique complet";

  const reportPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchSupplier =
        selectedReportSupplier === "all" ||
        p.fournisseur.toLowerCase() === selectedReportSupplier.toLowerCase();
      const matchPeriod =
        reportPeriod === "today"
          ? p.date === todayStr
          : reportPeriod === "month"
            ? p.date.startsWith(currentMonthStr)
            : true;
      return matchSupplier && matchPeriod;
    });
  }, [purchases, selectedReportSupplier, reportPeriod, todayStr, currentMonthStr]);

  const reportTotalAmount = useMemo(
    () => reportPurchases.reduce((acc, p) => acc + p.totalAchat, 0),
    [reportPurchases],
  );
  const reportTotalQty = useMemo(
    () => reportPurchases.reduce((acc, p) => acc + p.quantite, 0),
    [reportPurchases],
  );

  /**
   * Le document exporté est une capture de l'élément ci-dessous, pas une
   * seconde mise en page : ce que l'utilisateur voit est exactement ce
   * qu'il télécharge.
   */
  const documentRef = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const exporter = async (type: "pdf" | "image") => {
    const noeud = documentRef.current;
    if (!noeud || exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const nom = nomDeFichier("Journal_achats", reportPeriod);
      if (type === "pdf") await exporterPdf(noeud, paper, nom);
      else await exporterImage(noeud, nom, "png");
    } catch (err) {
      setExportErreur(
        err instanceof Error ? err.message : "Le document n'a pas pu être exporté.",
      );
    } finally {
      setExportEnCours(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<ShoppingCart className="w-5 h-5 t-danger" />}
        title="Achats"
        subtitle="Enregistrez vos entrées en stock et ce qu'elles vous ont coûté."
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
              Nouvel achat
            </button>
          </>
        }
      />

      {/* Indicateurs */}
      <div className="app-statbar grid-cols-1 sm:grid-cols-3">
        {showPrix && (
          <StatCol
            label="Total des achats"
            value={formatCurrency(totalAchatsMontant)}
            hint="sorti de la trésorerie"
            icon={<DollarSign className="w-5 h-5" />}
            tone="danger"
          />
        )}

        <StatCol
          label="Articles reçus"
          value={`${totalArticlesReappro}`}
          hint="unités entrées en stock"
          icon={<PackageCheck className="w-5 h-5" />}
          tone="success"
        />

        {showFournisseur && (
          <StatCol
            label="Fournisseurs"
            value={`${suppliersList.length}`}
            hint={`partenaire${suppliersList.length > 1 ? "s" : ""} actif${suppliersList.length > 1 ? "s" : ""}`}
            icon={<Truck className="w-5 h-5" />}
            tone="info"
          />
        )}
      </div>

      {/* Recherche et filtres */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          showFournisseur
            ? "Rechercher un produit, une référence, un fournisseur…"
            : "Rechercher un produit, une référence…"
        }
        activeFilterCount={supplierFilter !== "Tous" ? 1 : 0}
        onReset={() => {
          setSearchTerm("");
          setSupplierFilter("Tous");
        }}
      >
        {showFournisseur && (
          <FilterField label="Fournisseur">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="app-field-sm lg:w-auto"
            >
              <option value="Tous">Tous les fournisseurs</option>
              {suppliersList.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </FilterField>
        )}
      </FilterBar>

      {/* Liste unique — desktop ET mobile.
          Un achat se lit par « quel produit, chez qui, pour combien » :
          le fournisseur monte donc dans la ligne grise, et l'effet sur
          la trésorerie devient le complément du montant plutôt qu'une
          colonne à part. */}
      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucun achat ne correspond à ces filtres."
          items={filteredPurchases.map((p) => ({
            id: p.id,
            primary: (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {getPurchaseLabel(p, products)} ×{p.quantite}
                </span>
                <VariantBadge prix={getPurchaseVariant(p, products)} autorise={showPrix} />
              </span>
            ),
            meta: [
              formatDateLocale(p.date, locale),
              showFournisseur ? p.fournisseur || null : null,
              showPrix ? `${formatCurrency(p.prixAchatUnit)} / u` : null,
            ],
            amount: showPrix ? formatCurrency(p.totalAchat) : undefined,
            amountHint: showPrix ? (
              <span className="t-danger">{formatCurrency(p.impactTresorerie)} en caisse</span>
            ) : undefined,
            detailTitle: getPurchaseLabel(p, products),
            detailSubtitle: `Achat ${p.numero}`,
            details: [
              { label: "Date", value: formatDateLocale(p.date, locale) },
              { label: "Référence", value: p.numero },
              { label: "Quantité", value: `${p.quantite}` },
              ...(showPrix
                ? [
                    { label: "Prix unitaire", value: formatCurrency(p.prixAchatUnit) },
                    { label: "Total", value: formatCurrency(p.totalAchat) },
                    {
                      label: "Effet sur la trésorerie",
                      value: (
                        <span className="t-danger">{formatCurrency(p.impactTresorerie)}</span>
                      ),
                    },
                  ]
                : []),
              ...(showFournisseur
                ? [{ label: "Fournisseur", value: p.fournisseur || "-", hideIfEmpty: true }]
                : []),
            ],
            actions: (
              <button
                onClick={() => setSelectedPurchaseReceipt(p)}
                className="app-btn-secondary"
              >
                <Eye className="w-4 h-4" />
                Voir le bon
              </button>
            ),
          }))}
        />
      </div>

      {/* ── Bon d'approvisionnement ──
          Le bloc porte `printable-receipt` : sans cette accroche, la
          feuille d'impression masque tout et le bouton « Imprimer »
          sortait une page blanche. */}
      {selectedPurchaseReceipt && (
        <Modal
          open
          onClose={() => setSelectedPurchaseReceipt(null)}
          size="md"
          icon={<FileText className="h-4 w-4" />}
          title="Bon d'approvisionnement"
          description={`N° ${selectedPurchaseReceipt.numero}`}
          footer={
            <>
              <button onClick={() => window.print()} className="app-btn-secondary">
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
              <button
                onClick={() => setSelectedPurchaseReceipt(null)}
                className="app-btn-primary"
              >
                Fermer
              </button>
            </>
          }
        >
          <div className="printable-receipt printable-invoice rounded-xl border border-slate-200 p-4">
            <div className="mb-3 border-b border-slate-200 pb-3 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                {settings?.storeName || "BALSAMA AUTO GESTION"}
              </p>
              <p className="text-xs text-slate-500">
                Bon d'approvisionnement n° {selectedPurchaseReceipt.numero}
              </p>
            </div>

            <dl className="divide-y divide-border">
              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Date</dt>
                <dd className="text-right font-medium text-slate-900">
                  {formatDateLocale(selectedPurchaseReceipt.date, locale)}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Code produit</dt>
                <dd className="text-right font-mono font-medium text-slate-900">
                  {products.find((prod) => prod.id === selectedPurchaseReceipt.productId)?.numero ||
                    selectedPurchaseReceipt.productId}
                </dd>
              </div>

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Produit</dt>
                <dd className="min-w-0 text-right font-medium text-slate-900">
                  {getPurchaseLabel(selectedPurchaseReceipt, products)}
                </dd>
              </div>

              {showFournisseur && (
                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-slate-500">Fournisseur</dt>
                  <dd className="min-w-0 text-right font-medium text-slate-900">
                    {selectedPurchaseReceipt.fournisseur || "Grossiste général"}
                  </dd>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 text-slate-500">Quantité</dt>
                <dd className="text-right font-mono font-medium text-slate-900">
                  {selectedPurchaseReceipt.quantite} unité
                  {selectedPurchaseReceipt.quantite > 1 ? "s" : ""}
                </dd>
              </div>

              {showPrix && (
                <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="shrink-0 text-slate-500">Prix unitaire</dt>
                  <dd className="text-right font-mono font-medium text-slate-900">
                    {formatCurrency(selectedPurchaseReceipt.prixAchatUnit)}
                  </dd>
                </div>
              )}

              {showPrix && (
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="shrink-0 text-sm font-medium text-slate-900">
                    Total décaissement
                  </dt>
                  <dd className="text-right font-mono text-base font-semibold text-foreground">
                    {formatCurrency(selectedPurchaseReceipt.totalAchat)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Modal>
      )}

      {/* ── Nouvel achat ── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        icon={<ShoppingCart className="h-4 w-4" />}
        title="Nouvel achat"
        description="Un approvisionnement de stock, avec sa sortie de trésorerie."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="purchase-add-form" className="app-btn-primary">
              Enregistrer l'achat
            </button>
          </>
        }
      >
        <form id="purchase-add-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Recharge rapide depuis le catalogue
            </label>
            <select
              onChange={(e) => handleSelectExistingProduct(e.target.value)}
              className="app-field"
            >
              <option value="">Choisir un produit existant...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numero} — {getProductLabel(p, products)} ({formatCurrency(p.prixAchat)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Date d'achat *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="app-field font-mono"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Désignation *
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="ex : kapa"
                className="app-field"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Quantité *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantite}
                  onChange={(e) => setQuantite(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Prix d'achat unitaire (Ar) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={prixAchatUnit}
                  onChange={(e) => setPrixAchatUnit(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Fournisseur
              </label>
              <input
                type="text"
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
                placeholder="ex : Grossiste Antanimena"
                className="app-field"
              />
            </div>
          </div>

          <div className="app-statbar grid-cols-1">
            <StatCol label="Total de l'achat" value={formatCurrency(quantite * prixAchatUnit)} />
          </div>
        </form>
      </Modal>

      {/* ── Journal & bilan des achats ──
          Le document imprimable est conservé tel quel. */}
      {isReportModalOpen && (
        <Modal
          open
          onClose={() => setIsReportModalOpen(false)}
          size="3xl"
          icon={<Printer className="h-4 w-4" />}
          title="Journal des achats"
          description={
            showFournisseur && selectedReportSupplier !== "all"
              ? selectedReportSupplier
              : "Approvisionnements de stock"
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
              <button
                onClick={() => imprimerDocument(paper)}
                className="app-btn-secondary"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
              <button
                onClick={() => exporter("image")}
                disabled={exportEnCours !== null}
                className="app-btn-secondary"
                title="Télécharger une image, pratique à envoyer par messagerie"
              >
                <ImageIcon className="h-4 w-4" />
                {exportEnCours === "image" ? "Création..." : "Image"}
              </button>
              <button
                onClick={() => exporter("pdf")}
                disabled={exportEnCours !== null}
                className="app-btn-primary"
                title={`Télécharger le PDF au format ${paper.label}`}
              >
                <Download className="h-4 w-4" />
                {exportEnCours === "pdf" ? "Création..." : "PDF"}
              </button>
              <button
                onClick={() => {
                  // Le fichier exporté doit respecter exactement les
                  // mêmes masquages que l'écran : sinon un
                  // collaborateur contournerait la restriction en
                  // téléchargeant le journal.
                  const textContent = `
=== ${settings?.storeName || "BALSAMA AUTO GESTION"} ===
JOURNAL & BILAN DES ACHATS / APPROVISIONNEMENT STOCK
${showFournisseur ? `FOURNISSEUR: ${selectedReportSupplier === "all" ? "TOUS LES FOURNISSEURS" : selectedReportSupplier.toUpperCase()}\n` : ""}PÉRIODE: ${reportPeriod === "today" ? "Aujourd'hui" : reportPeriod === "month" ? "Ce Mois-ci" : "Tout l'historique"}
Date de génération: ${new Date().toLocaleString()}
------------------------------------------------
${showPrix ? `TOTAL ACHATS: ${formatCurrency(reportTotalAmount)}\n` : ""}TOTAL ARTICLES RÉAPPROVISIONNÉS: ${reportTotalQty} unités (${reportPurchases.length} achats)
------------------------------------------------
${reportPurchases
  .map(
    (p) =>
      `[${p.date}] ${p.numero} | Prod: ${products.find((prod) => prod.id === p.productId)?.numero || p.productId} - ${getPurchaseLabel(p, products)} | Qté: ${p.quantite}${showPrix ? ` | Prix unit: ${formatCurrency(p.prixAchatUnit)} | Total: ${formatCurrency(p.totalAchat)}` : ""}${showFournisseur ? ` | Fournisseur: ${p.fournisseur || "Non spécifié"}` : ""}`,
  )
  .join("\n")}
================================================
                  `.trim();

                  const element = document.createElement("a");
                  const file = new Blob([textContent], { type: "text/plain" });
                  element.href = URL.createObjectURL(file);
                  element.download = `Journal_Achats_${selectedReportSupplier}_${reportPeriod}.txt`;
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
            <div
              className={`no-print grid grid-cols-1 gap-3 ${showFournisseur ? "sm:grid-cols-2" : ""}`}
            >
              {showFournisseur && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Fournisseur
                  </label>
                  <select
                    value={selectedReportSupplier}
                    onChange={(e) => setSelectedReportSupplier(e.target.value)}
                    className="app-field-sm"
                  >
                    <option value="all">Tous les fournisseurs</option>
                    {suppliersList.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
            {exportErreur && (
              <p className="no-print rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm t-danger">
                {exportErreur}
              </p>
            )}

            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {isTicket ? (
                /* ── Ticket ── */
                <div
                  ref={documentRef}
                  className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white p-4 font-mono leading-relaxed text-slate-900 shadow-sm ${paperId === "t58" ? "text-[10px]" : "text-[11px]"}`}
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
                    Journal des achats
                  </p>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  <dl className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Période</dt>
                      <dd className="min-w-0 text-right text-slate-900">{periodeLabel}</dd>
                    </div>
                    {showFournisseur && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Fournisseur</dt>
                        <dd className="min-w-0 text-right text-slate-900">
                          {selectedReportSupplier === "all" ? "Tous" : selectedReportSupplier}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Édité le</dt>
                      <dd className="text-slate-900">{new Date().toLocaleDateString("fr-FR")}</dd>
                    </div>
                  </dl>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  {reportPurchases.length === 0 ? (
                    <p className="py-2 text-center text-[10px] italic text-slate-500">
                      Aucun achat pour cette sélection.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {reportPurchases.map((p) => (
                        <div key={p.id}>
                          <p className="font-semibold text-slate-900">
                            {getPurchaseLabel(p, products)}
                          </p>
                          <div className="flex justify-between gap-3 text-[10px] text-slate-600">
                            <span>
                              {p.quantite} unité{p.quantite > 1 ? "s" : ""}
                              {showPrix ? ` × ${formatCurrency(p.prixAchatUnit)}` : ""}
                            </span>
                            {showPrix && (
                              <span className="font-semibold text-slate-900">
                                {formatCurrency(p.totalAchat)}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-slate-400">
                            {[
                              formatDateLocale(p.date, locale),
                              products.find((prod) => prod.id === p.productId)?.numero,
                              showFournisseur ? p.fournisseur || "Grossiste" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  <div className="space-y-1 text-[10px]">
                    {showPrix && (
                      <div className="flex justify-between gap-3 border-b border-slate-900 pb-1 text-[13px] font-bold text-slate-900">
                        <span>TOTAL</span>
                        <span>{formatCurrency(reportTotalAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 pt-1 text-slate-600">
                      <span>Réapprovisionnement</span>
                      <span className="text-slate-900">{reportTotalQty} unités</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Journal A4 ── */
                <div
                  ref={documentRef}
                  className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white font-sans text-xs text-slate-900 shadow-sm ${paperId === "a5" ? "p-6" : "p-8"}`}
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
                        Journal des achats
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
                        {showFournisseur && (
                          <div className="flex gap-2 sm:justify-end">
                            <dt>Fournisseur</dt>
                            <dd className="font-medium text-slate-700">
                              {selectedReportSupplier === "all"
                                ? "Tous les fournisseurs"
                                : selectedReportSupplier}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </header>

                  <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Réapprovisionnement
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {reportTotalQty} unités
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Mouvements
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {reportPurchases.length}
                      </p>
                    </div>
                    {showPrix && (
                      <div className="min-w-0 sm:text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Total décaissé
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                          {formatCurrency(reportTotalAmount)}
                        </p>
                      </div>
                    )}
                  </section>

                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 px-2 font-semibold">Désignation</th>
                        <th className="py-2 px-2 text-center font-semibold">Qté</th>
                        {showPrix && (
                          <th className="py-2 px-2 text-right font-semibold">Prix unit.</th>
                        )}
                        {showPrix && <th className="py-2 pl-2 text-right font-semibold">Total</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {reportPurchases.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3 + (showPrix ? 2 : 0)}
                            className="py-6 text-center italic text-slate-500"
                          >
                            Aucun achat enregistré sur cette période.
                          </td>
                        </tr>
                      ) : (
                        reportPurchases.map((p, i) => (
                          <tr
                            key={p.id}
                            className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                          >
                            <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-500">
                              {formatDateLocale(p.date, locale)}
                            </td>
                            <td className="px-2 py-2.5">
                              <span className="font-medium text-slate-900">
                                {getPurchaseLabel(p, products)}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                                {[
                                  products.find((prod) => prod.id === p.productId)?.numero,
                                  showFournisseur ? p.fournisseur || "Grossiste" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-center tabular-nums text-slate-700">
                              {p.quantite}
                            </td>
                            {showPrix && (
                              <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-700">
                                {formatCurrency(p.prixAchatUnit)}
                              </td>
                            )}
                            {showPrix && (
                              <td className="py-2.5 pl-2 text-right font-mono font-medium tabular-nums text-slate-900">
                                {formatCurrency(p.totalAchat)}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {showPrix && reportPurchases.length > 0 && (
                    <div className="flex justify-end">
                      <dl className="w-full max-w-[16rem] space-y-1.5 text-[11px]">
                        <div className="flex justify-between gap-4 text-slate-500">
                          <dt>Mouvements</dt>
                          <dd className="font-mono tabular-nums text-slate-700">
                            {reportPurchases.length}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-2">
                          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                            Total décaissé
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
    </div>
  );
};