import React, { useState, useMemo } from "react";
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
  Printer,
  X,
  Eye,
  RefreshCw,
  AlertCircle,
  Tag,
  Download,
  Receipt,
} from "lucide-react";
import { formatCurrency, formatDateLocale, getProductLabel, getPurchaseLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { MobileCardList } from "./shared/MobileCardList";
import { StatTile } from "./shared/StatTile";

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
  const [reportFormat, setReportFormat] = useState<"ticket" | "a4">("ticket");

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {showPrix && (
          <StatTile
            label="Total des achats"
            value={formatCurrency(totalAchatsMontant)}
            hint="sorti de la trésorerie"
            icon={<DollarSign className="w-5 h-5" />}
            tone="danger"
          />
        )}

        <StatTile
          label="Articles reçus"
          value={`${totalArticlesReappro}`}
          hint="unités entrées en stock"
          icon={<PackageCheck className="w-5 h-5" />}
          tone="success"
        />

        {showFournisseur && (
          <StatTile
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

      {/* Liste mobile — remplace le tableau sous 768px */}
      <div className="lg:hidden">
        <MobileCardList
          emptyLabel="Aucun achat ne correspond à ces filtres."
          items={filteredPurchases.map((p) => ({
            id: p.id,
            title: getPurchaseLabel(p, products),
            subtitle: `${formatDateLocale(p.date, locale)} · ×${p.quantite}`,
            amount: showPrix ? formatCurrency(p.totalAchat) : undefined,
            amountTone: "danger" as const,
            fields: [
              { label: "Référence", value: p.numero },
              { label: "Date", value: formatDateLocale(p.date, locale) },
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
                ? [{ label: "Fournisseur", value: p.fournisseur || "Non renseigné" }]
                : []),
            ],
            actions: (
              <button
                onClick={() => setSelectedPurchaseReceipt(p)}
                className="app-btn-secondary flex-1 text-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                Voir le bon
              </button>
            ),
          }))}
        />
      </div>

      {/* Purchases Table */}
      <div className="app-table-wrap hidden lg:block">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5">Référence</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Code produit</th>
                <th className="px-4 py-3.5">Produit</th>
                <th className="px-4 py-3.5 text-right">Qté</th>
                {showPrix && <th className="px-4 py-3.5 text-right">Prix unitaire</th>}
                {showPrix && <th className="px-4 py-3.5 text-right">Total</th>}
                {showFournisseur && <th className="px-4 py-3.5">Fournisseur</th>}
                {showPrix && <th className="px-4 py-3.5 text-right">Effet trésorerie</th>}
                <th className="px-4 py-3.5 text-center">Bon</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={6 + (showPrix ? 3 : 0) + (showFournisseur ? 1 : 0)}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun achat ne correspond à vos filtres.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{p.numero}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {formatDateLocale(p.date, locale)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold t-success">
                      {products.find((prod) => prod.id === p.productId)?.numero || "—"}
                    </td>
                   <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                      {getPurchaseLabel(p, products)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold">{p.quantite}</td>
                    {showPrix && (
                      <td className="px-4 py-3.5 text-right font-mono">
                        {formatCurrency(p.prixAchatUnit)}
                      </td>
                    )}
                    {showPrix && (
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                        {formatCurrency(p.totalAchat)}
                      </td>
                    )}
                    {showFournisseur && (
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {p.fournisseur || "Non spécifié"}
                      </td>
                    )}
                    {showPrix && (
                      <td className="px-4 py-3.5 text-right font-mono font-bold t-danger">
                        {formatCurrency(p.impactTresorerie)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedPurchaseReceipt(p)}
                        className="p-1.5 text-muted-foreground hover:t-success bg-muted hover:bg-accent rounded-lg transition-colors inline-flex items-center gap-1"
                        title="Voir le bon de commande"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Bon</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bon de Commande Modal */}
      {selectedPurchaseReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-2xl text-foreground space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 t-success" />
                <h3 className="font-bold text-base">
                  Bon d'Approvisionnement #{selectedPurchaseReceipt.numero}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPurchaseReceipt(null)}
                className="p-1 text-muted-foreground hover:text-foreground bg-muted rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-background p-4 rounded-xl border border-border font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date :</span>
                <span className="text-foreground">
                  {formatDateLocale(selectedPurchaseReceipt.date, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Code produit :</span>
                <span className="t-success font-bold">
                  {products.find((prod) => prod.id === selectedPurchaseReceipt.productId)
                    ?.numero || selectedPurchaseReceipt.productId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produit :</span>
                <span className="text-foreground font-bold">
                  {getPurchaseLabel(selectedPurchaseReceipt, products)}
                </span>
              </div>
              {showFournisseur && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fournisseur :</span>
                  <span className="t-info">
                    {selectedPurchaseReceipt.fournisseur || "Grossiste Général"}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-muted-foreground">Quantité :</span>
                <span className="text-foreground font-bold">
                  {selectedPurchaseReceipt.quantite} unités
                </span>
              </div>
              {showPrix && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prix unitaire :</span>
                  <span className="text-foreground">
                    {formatCurrency(selectedPurchaseReceipt.prixAchatUnit)}
                  </span>
                </div>
              )}
              {showPrix && (
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground font-bold">Total Décaissement :</span>
                  <span className="t-danger font-bold">
                    {formatCurrency(selectedPurchaseReceipt.totalAchat)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer Bon
              </button>
              <button
                onClick={() => setSelectedPurchaseReceipt(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-md p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 t-danger" />
              Saisie d'un Nouvel Achat
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Recharge rapide depuis le catalogue (Optionnel) :
                </label>
                <select
                  onChange={(e) => handleSelectExistingProduct(e.target.value)}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Choisir un produit existant --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero} - {getProductLabel(p, products)} ({formatCurrency(p.prixAchat)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border pt-2">
                <label className="block text-muted-foreground font-medium mb-1">
                  Date d'achat :
                </label>
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
                  Désignation du produit (ex: kapa) :
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="ex: kapa"
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Quantité :</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={quantite}
                    onChange={(e) => setQuantite(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Prix Achat Unit. (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={prixAchatUnit}
                    onChange={(e) => setPrixAchatUnit(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Fournisseur :
                </label>
                <input
                  type="text"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value)}
                  placeholder="ex: Grossiste Antanimena"
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20 text-right font-mono">
                <span className="text-muted-foreground text-[11px] block">
                  Total Achat Calculé :
                </span>
                <span className="text-base font-bold t-danger">
                  {formatCurrency(quantite * prixAchatUnit)}
                </span>
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
                  Enregistrer l'Achat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print & Export Report Modal for Achats */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl text-foreground space-y-6 my-8">
            {/* Modal Header */}
            <div className="space-y-4 border-b border-border pb-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 t-success" />
                  <h3 className="text-base font-bold text-foreground">
                    Journal & Bilan des Achats / Approvisionnements Stock
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer Document
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
                {showFournisseur && (
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Fournisseur Sélectionné :
                    </label>
                    <select
                      value={selectedReportSupplier}
                      onChange={(e) => setSelectedReportSupplier(e.target.value)}
                      className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value="all">Tous les Fournisseurs</option>
                      {suppliersList.map((sup) => (
                        <option key={sup} value={sup}>
                          {sup}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Période d'Activité :
                  </label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as any)}
                    className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
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
                          ? "bg-emerald-600 text-white"
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
                <div className="printable-receipt bg-emerald-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-emerald-200">
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
                    <h3 className="font-bold text-xs uppercase bg-emerald-200 py-0.5 rounded text-emerald-950">
                      BILAN D'APPROVISIONNEMENT
                    </h3>
                    {showFournisseur && (
                      <p className="text-[10px] font-semibold text-slate-800">
                        FOURNISSEUR :{" "}
                        <span className="font-bold uppercase text-slate-950">
                          {selectedReportSupplier === "all"
                            ? "TOUS LES FOURNISSEURS"
                            : selectedReportSupplier}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  <div className="space-y-1.5 text-[10px]">
                    {showPrix && (
                      <div className="flex justify-between font-bold text-emerald-900 bg-emerald-100 p-1.5 rounded">
                        <span>TOTAL ACHATS :</span>
                        <span>{formatCurrency(reportTotalAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 px-1">
                      <span>RÉAPPROVISIONNEMENT :</span>
                      <span className="font-bold">{reportTotalQty} unités</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  <div className="space-y-2">
                    <p className="font-bold text-[10px] uppercase text-slate-700">
                      Détail des achats :
                    </p>
                    {reportPurchases.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        Aucun achat pour cette sélection.
                      </p>
                    ) : (
                      <table className="w-full text-[9px] text-left">
                        <thead>
                          <tr className="border-b border-slate-300 font-bold uppercase">
                            <th className="py-1">Produit</th>
                            <th className="py-1 text-center">Qté</th>
                            {showPrix && <th className="py-1 text-right">Total</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportPurchases.map((p) => (
                            <tr key={p.id}>
                              <td className="py-1 pr-1">
                               <span className="font-bold block text-emerald-950">
                                  {getPurchaseLabel(p, products)}
                                </span>
                                <span className="text-[8px] text-slate-600 block">
                                  ID: {products.find((prod) => prod.id === p.productId)?.numero ||
                                    p.productId}
                                  {showFournisseur ? ` | ${p.fournisseur || "Grossiste"}` : ""}
                                </span>
                              </td>
                              <td className="py-1 text-center font-semibold">{p.quantite}</td>
                              {showPrix && (
                                <td className="py-1 text-right font-bold text-emerald-900">
                                  {formatCurrency(p.totalAchat)}
                                </td>
                              )}
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
                <div className="printable-receipt bg-white text-slate-900 w-full max-w-2xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div>
                      <h1 className="text-lg font-black text-slate-900 uppercase">
                        {settings?.storeName || "BALSAMA AUTO GESTION"}
                      </h1>
                      <p className="text-muted-foreground text-[11px]">
                        Journal des Achats & Approvisionnements Stock
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="inline-block bg-emerald-600 text-white px-3 py-1 rounded font-bold text-xs uppercase">
                        RELEVÉ D'ACHATS
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Édité le {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {showFournisseur && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Fournisseur :
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          {selectedReportSupplier === "all"
                            ? "TOUS LES FOURNISSEURS"
                            : selectedReportSupplier}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Qté Réapprovisionnée :
                      </span>
                      <span className="font-black text-emerald-600 text-sm font-mono">
                        {reportTotalQty} unités
                      </span>
                    </div>
                    {showPrix && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Total Décaissements :
                        </span>
                        <span className="font-black text-rose-600 text-sm font-mono">
                          {formatCurrency(reportTotalAmount)}
                        </span>
                      </div>
                    )}
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-y border-slate-300">
                        <th className="p-2">Date</th>
                        <th className="p-2">Code</th>
                        <th className="p-2">Désignation</th>
                        <th className="p-2 text-center">Qté</th>
                        {showPrix && <th className="p-2 text-right">Prix Unit.</th>}
                        {showPrix && <th className="p-2 text-right">Total</th>}
                        {showFournisseur && <th className="p-2">Fournisseur</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reportPurchases.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4 + (showPrix ? 2 : 0) + (showFournisseur ? 1 : 0)}
                            className="p-4 text-center text-muted-foreground italic"
                          >
                            Aucun achat enregistré.
                          </td>
                        </tr>
                      ) : (
                        reportPurchases.map((p) => (
                          <tr key={p.id}>
                            <td className="p-2 font-mono text-muted-foreground">{p.date}</td>
                            <td className="p-2 font-mono font-bold text-emerald-600">
                              {products.find((prod) => prod.id === p.productId)?.numero ||
                                p.productId}
                            </td>
                            <td className="p-2 font-bold text-slate-900">{getPurchaseLabel(p, products)}</td>
                            <td className="p-2 text-center font-bold">{p.quantite}</td>
                            {showPrix && (
                              <td className="p-2 text-right font-mono text-slate-600">
                                {formatCurrency(p.prixAchatUnit)}
                              </td>
                            )}
                            {showPrix && (
                              <td className="p-2 text-right font-bold text-slate-900 font-mono">
                                {formatCurrency(p.totalAchat)}
                              </td>
                            )}
                            {showFournisseur && (
                              <td className="p-2 text-slate-600">{p.fournisseur || "-"}</td>
                            )}
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
    </div>
  );
};