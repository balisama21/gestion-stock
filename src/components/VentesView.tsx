import React, { useState, useEffect, useMemo } from "react";
import { Sale, Product, Seller, LocaleSetting, StoreSettings } from "../types";
import {
  DollarSign,
  Lock,
  Plus,
  UserCheck,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Edit3,
  Trash2,
  Printer,
  Receipt,
  FileText,
  X,
  Eye,
  Download,
  Building,
  Phone,
  Mail,
  Check,
} from "lucide-react";
import { formatCurrency, formatDateLocale, getProductLabel, getSaleLabel } from "../utils/formulas";

interface VentesViewProps {
  sales: Sale[];
  products: Product[];
  sellers: Seller[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  onAddSale: (sale: {
    date: string;
    productId: string;
    quantite: number;
    prixVenteUnit: number;
    vendeur: string;
    clientCredit?: string;
    montantPaye: number;
  }) => Promise<{ sale: Sale | null; error: string | null }>;
  onEditSale?: (updatedSale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  /**
   * true si l'utilisateur n'a pas la permission "Ventes" complète : la
   * liste ne contient déjà QUE ses propres ventes (filtrée en amont dans
   * BalsamaApp.tsx) — ce flag sert uniquement à afficher un bandeau
   * explicatif, pas à refiltrer quoi que ce soit ici.
   */
  restrictedToOwnSales?: boolean;
  /**
   * Champs visibles pour l'utilisateur courant — `null`/`undefined` = tout
   * visible (propriétaire). Pour un collaborateur restreint, masque les
   * colonnes et totaux sensibles plutôt que de cacher tout l'onglet.
   * Clés possibles : montant, paiement, solde, benefice, marge
   * (voir src/lib/permissions.ts).
   */
  visibleFields?: string[] | null;
}

export const VentesView: React.FC<VentesViewProps> = ({
  sales,
  products,
  sellers,
  locale,
  settings,
  onAddSale,
  onEditSale,
  onDeleteSale,
  restrictedToOwnSales,
  visibleFields,
}) => {
  // null/undefined = tout visible (propriétaire). Sinon, seuls les champs
  // explicitement listés sont montrés.
  const showField = (key: string) => !visibleFields || visibleFields.includes(key);
  const showMontant = showField("montant");
  const showPaiement = showField("paiement");
  const showSolde = showField("solde");
  // Marge par ligne = "marge". Les cumuls (marge brute totale de la
  // boutique) révèlent la rentabilité globale : ils exigent EN PLUS la
  // permission "benefice", sinon un vendeur autorisé à voir la marge
  // d'une vente déduirait le bénéfice de toute l'entreprise.
  const showMargeLigne = showField("marge");
  const showMargeCumulee = showMargeLigne && showField("benefice");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Receipt / Facture Modal state
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [receiptMode, setReceiptMode] = useState<"ticket" | "facture">("ticket");

  // Form State for New Sale
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [quantite, setQuantite] = useState(1);
  const [prixVenteUnit, setPrixVenteUnit] = useState<number>(products[0]?.prixVenteDefaut || 0);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [vendeur, setVendeur] = useState(sellers[0]?.nom || "");
  const [clientCredit, setClientCredit] = useState("");
  const [montantPaye, setMontantPaye] = useState<number>(0);

  // Auto pre-fill default price when product changes (Demand 2)
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod && !isCustomPrice) {
      setPrixVenteUnit(prod.prixVenteDefaut);
    }
  }, [selectedProductId, products, isCustomPrice]);

  // Keep montantPaye updated to Total Vente by default unless partial credit
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const calculatedTotalVente = quantite * prixVenteUnit;

  useEffect(() => {
    if (!clientCredit) {
      setMontantPaye(calculatedTotalVente);
    }
  }, [calculatedTotalVente, clientCredit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (!selectedProductId || quantite <= 0 || prixVenteUnit < 0 || !vendeur) return;

    const prod = products.find((p) => p.id === selectedProductId);

    // RÈGLE 1 : impossible de vendre plus que le stock disponible
    // (stock actuel moins ce qui est déjà réservé par des commandes).
    if (prod) {
      if (prod.stockDisponible <= 0) {
        setFormError(
          prod.stockReserve > 0
            ? `"${getProductLabel(prod, products)}" n'a plus de stock disponible à la vente directe (${prod.stockReserve} unité(s) réservée(s) par des commandes).`
            : `"${getProductLabel(prod, products)}" est en rupture de stock.`,
        );
        return;
      }
      if (Number(quantite) > prod.stockDisponible) {
        setFormError(
          `Stock disponible insuffisant. Il reste ${prod.stockDisponible} unité(s) disponible(s)` +
            (prod.stockReserve > 0
              ? ` (${prod.stockReserve} unité(s) réservée(s) par des commandes).`
              : `.`),
        );
        return;
      }
    }

    const total = Number(quantite) * Number(prixVenteUnit);
    const paye = Number(montantPaye);
    const solde = total - paye;
    const statut = paye >= total ? "Payé" : paye > 0 ? "Partiel" : "Impayé";

    setSaving(true);
    const result = await onAddSale({
      date,
      productId: selectedProductId,
      quantite: Number(quantite),
      prixVenteUnit: Number(prixVenteUnit),
      vendeur,
      clientCredit: clientCredit.trim() || undefined,
      montantPaye: paye,
    });
    setSaving(false);
    if (result.error || !result.sale) {
      setFormError(result.error ?? "La vente n'a pas pu être créée.");
      return;
    }

    const createdSale: Sale = {
      id: result.sale.id,
      numero: result.sale.numero || `V-${result.sale.id.slice(0, 6)}`,
      date,
      productId: selectedProductId,
      designation: prod ? prod.designation : selectedProductId,
      quantite: Number(quantite),
      prixVenteUnit: Number(prixVenteUnit),
      totalVente: total,
      prixAchatUnitRef: prod ? prod.prixAchat : 0,
      totalAchatRef: (prod ? prod.prixAchat : 0) * Number(quantite),
      margeTotale: (Number(prixVenteUnit) - (prod ? prod.prixAchat : 0)) * Number(quantite),

      vendeur,
      clientCredit: clientCredit.trim() || undefined,
      montantPaye: paye,
      montantRembourse: 0,
      soldeDu: solde > 0 ? solde : 0,
      statutCredit: statut,
    };

    setIsModalOpen(false);
    setIsCustomPrice(false);
    setClientCredit("");
    setFormError(null);
    setSelectedReceiptSale(createdSale);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSellerFilter, setSelectedSellerFilter] = useState("Tous");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Tous");

  // Filtered sales logic
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchSearch =
        s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.clientCredit && s.clientCredit.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSeller = selectedSellerFilter === "Tous" || s.vendeur === selectedSellerFilter;

      const matchStatus =
        selectedStatusFilter === "Tous" || s.statutCredit === selectedStatusFilter;

      return matchSearch && matchSeller && matchStatus;
    });
  }, [sales, searchQuery, selectedSellerFilter, selectedStatusFilter]);

  const totalVentesCA = sales.reduce((acc, s) => acc + s.totalVente, 0);
  const totalMarges = sales.reduce((acc, s) => acc + s.margeTotale, 0);
  const totalPayeEncaisse = sales.reduce((acc, s) => acc + s.montantPaye, 0);
  const totalSoldeDuCredit = sales.reduce((acc, s) => acc + s.soldeDu, 0);

  return (
    <div className="space-y-6">
      {restrictedToOwnSales && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-sm text-amber-600 dark:text-amber-400">
          <Lock className="w-5 h-5 shrink-0" />
          <span>
            Vous n'avez pas accès à l'historique complet des ventes de la boutique — seules{" "}
            <strong>vos propres ventes</strong> sont affichées ci-dessous.
          </span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-blue-400" />
            Onglet Ventes (Prix de vente saisi manuellement & Vendeurs)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Préremplissage automatique du prix par défaut (
            <code className="text-blue-300">Produits!E</code>) modifiable ligne par ligne, avec
            sélection du Vendeur et suivi des créances.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {showMontant && (
            <div className="bg-muted px-4 py-2 rounded-xl border border-muted-foreground/20 text-right">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                Total CA Ventes
              </div>
              <div className="text-lg font-bold font-mono text-blue-400">
                {formatCurrency(totalVentesCA)}
              </div>
              {showMargeCumulee && (
                <div className="text-[10px] text-emerald-400 font-mono">
                  Marge: +{formatCurrency(totalMarges)}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Vente
          </button>
        </div>
      </div>

      {/* Interactive Toolbar & Filters (Replaces static instructions box) */}
      <div className="bg-card border border-border p-4 rounded-2xl space-y-4 shadow-sm">
        {/* KPI Mini Summary Row */}
        {(showPaiement || showSolde || showMargeCumulee) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {showPaiement && (
              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground font-medium block">
                    Total Encaissé (Reçu) :
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {formatCurrency(totalPayeEncaisse)}
                  </span>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            )}

            {showSolde && (
              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground font-medium block">
                    Total Crédits / Reste Dû :
                  </span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {formatCurrency(totalSoldeDuCredit)}
                  </span>
                </div>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
            )}

            {showMargeCumulee && (
              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20/80 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground font-medium block">
                    Marge Brute Cumulée :
                  </span>
                  <span className="text-base font-bold font-mono text-blue-400">
                    +{formatCurrency(totalMarges)}
                  </span>
                </div>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
            )}
          </div>
        )}

        {/* Search and Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher produit, client, ID vente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted border border-muted-foreground/20 rounded-xl pl-9 pr-3 py-2 text-foreground placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Seller Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Vendeur:</span>
            <select
              value={selectedSellerFilter}
              onChange={(e) => setSelectedSellerFilter(e.target.value)}
              className="bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="Tous">Tous les vendeurs</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.nom}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Statut Crédit:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-muted border border-muted-foreground/20 text-foreground rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Payé">Payé (Comptant)</option>
              <option value="Partiel">Partiel (Acompte)</option>
              <option value="Impayé">Impayé (Crédit total)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="app-table-wrap">
        <div className="app-table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th className="px-4 py-3.5">ID Vente</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">ID Produit</th>
                <th className="px-4 py-3.5">Désignation</th>
                <th className="px-4 py-3.5 text-right">Qté</th>
                {/* Le prix unitaire est masqué avec le montant : sinon
                    prix unitaire × quantité redonne trivialement le total,
                    et le masquage ne serait que cosmétique. */}
                {showMontant && (
                  <th className="px-4 py-3.5 text-right bg-blue-950/40 text-blue-300 border-x border-blue-500/20">
                    Prix Vente Saisi (E)
                  </th>
                )}
                {showMontant && <th className="px-4 py-3.5 text-right">Total Vente (F)</th>}
                {showMargeLigne && <th className="px-4 py-3.5 text-right">Marge (I)</th>}
                <th className="px-4 py-3.5">Vendeur (N)</th>
                <th className="px-4 py-3.5">Client Crédit (O)</th>
                {showPaiement && <th className="px-4 py-3.5 text-right">Payé (P)</th>}
                {showSolde && <th className="px-4 py-3.5 text-right">Solde Dû (Q)</th>}
                <th className="px-4 py-3.5 text-center">Statut (R)</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-foreground">
              {filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      9 +
                      (showMontant ? 2 : 0) +
                      (showMargeLigne ? 1 : 0) +
                      (showPaiement ? 1 : 0) +
                      (showSolde ? 1 : 0)
                    }
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucune vente ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const linkedProduct = products.find((p) => p.id === s.productId);
                  return (
                  <tr key={s.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">{s.numero}</td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {formatDateLocale(s.date, locale)}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                      {linkedProduct?.numero || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                      {linkedProduct ? getProductLabel(linkedProduct, products) : s.designation}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold">{s.quantite}</td>
                    {showMontant && (
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-300 bg-blue-950/20 border-x border-blue-500/10">
                        {formatCurrency(s.prixVenteUnit)}
                      </td>
                    )}
                    {showMontant && (
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                        {formatCurrency(s.totalVente)}
                      </td>
                    )}
                    {showMargeLigne && (
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-400">
                        +{formatCurrency(s.margeTotale)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-semibold text-foreground">{s.vendeur}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{s.clientCredit || "-"}</td>
                    {showPaiement && (
                      <td className="px-4 py-3.5 text-right font-mono text-emerald-400">
                        {formatCurrency(s.montantPaye)}
                      </td>
                    )}
                    {showSolde && (
                      <td className="px-4 py-3.5 text-right font-mono text-amber-400">
                        {formatCurrency(s.soldeDu)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          s.statutCredit === "Payé"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : s.statutCredit === "Partiel"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {s.statutCredit}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceiptSale(s)}
                          className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                          title="Imprimer / Télécharger Reçu ou Facture"
                        >
                          <Receipt className="w-3 h-3 text-emerald-400" />
                          Reçu
                        </button>

                        {onEditSale && (
                          <button
                            onClick={() => setEditingSale(s)}
                            className="p-1.5 text-muted-foreground hover:text-blue-400 bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Modifier cette vente"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteSale && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(`Supprimer la vente ${s.numero} (${getSaleLabel(s, products)}) ?`)
                              ) {
                                onDeleteSale(s.id);
                              }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-400 bg-muted hover:bg-accent rounded-lg transition-colors"
                            title="Annuler/Supprimer cette vente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-lg p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Saisie d'une Nouvelle Vente (Prix Libre & Vendeur)
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
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
                    Vendeur ayant réalisé la vente (N) :
                  </label>
                  <select
                    value={vendeur}
                    onChange={(e) => setVendeur(e.target.value)}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    {sellers.map((v) => (
                      <option key={v.id} value={v.nom}>
                        {v.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Sélection du Produit / Variante :
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setIsCustomPrice(false);
                  }}
                  className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono font-bold focus:outline-none focus:border-emerald-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.numero}] {getProductLabel(p, products)} (Prix Réf : {p.prixVenteDefaut} Ar | Disponible :{" "}
                      {p.stockDisponible}
                      {p.stockReserve > 0 ? ` / ${p.stockActuel} total` : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Quantité Vendue :
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={currentProduct?.stockDisponible || 999}
                    value={quantite}
                    onChange={(e) => setQuantite(Number(e.target.value))}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                  />
                  {currentProduct && (
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Disponible : {currentProduct.stockDisponible}
                      {currentProduct.stockReserve > 0
                        ? ` (${currentProduct.stockActuel} en stock, ${currentProduct.stockReserve} réservé(s) par des commandes)`
                        : ""}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-blue-300 font-bold mb-1 flex items-center justify-between">
                    <span>Prix Vente Unit. Saisi (E) :</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Saisie libre</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={prixVenteUnit}
                    onChange={(e) => {
                      setPrixVenteUnit(Number(e.target.value));
                      setIsCustomPrice(true);
                    }}
                    className="w-full bg-blue-950/40 border border-blue-500/50 rounded-xl px-3 py-2 text-blue-200 font-mono font-bold focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Prérempli avec prix réf ({currentProduct?.prixVenteDefaut} Ar), modifiable.
                  </span>
                </div>
              </div>

              {/* Credit Customer section */}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-amber-300">
                    Vente à Crédit / Paiement Partiel (Optionnel) :
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">
                      Nom du Client :
                    </label>
                    <input
                      type="text"
                      value={clientCredit}
                      onChange={(e) => setClientCredit(e.target.value)}
                      placeholder="laisser vide si comptant"
                      className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">
                      Montant Payé Comptant :
                    </label>
                    <input
                      type="number"
                      value={montantPaye}
                      onChange={(e) => setMontantPaye(Number(e.target.value))}
                      className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20 flex justify-between items-center font-mono">
                <div>
                  <span className="text-muted-foreground text-[10px] block">Total Vente (F) :</span>
                  <span className="text-lg font-bold text-blue-300">
                    {formatCurrency(calculatedTotalVente)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-[10px] block">Solde Dû (Q) :</span>
                  <span className="text-base font-bold text-amber-400">
                    {formatCurrency(calculatedTotalVente - montantPaye)}
                  </span>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError(null);
                  }}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Valider la Vente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-lg p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" />
              Modification de la Vente {editingSale.numero} ({getSaleLabel(editingSale, products)})
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onEditSale) return;

                const totalVente = editingSale.quantite * editingSale.prixVenteUnit;
                const totalAchatRef = editingSale.quantite * editingSale.prixAchatUnitRef;
                const margeTotale = totalVente - totalAchatRef;
                const soldeDu = totalVente - editingSale.montantPaye;

                let statutCredit: "Payé" | "Partiel" | "Impayé" = "Payé";
                if (soldeDu > 0 && editingSale.montantPaye > 0) {
                  statutCredit = "Partiel";
                } else if (soldeDu === totalVente) {
                  statutCredit = "Impayé";
                }

                onEditSale({
                  ...editingSale,
                  totalVente,
                  totalAchatRef,
                  margeTotale,
                  soldeDu,
                  statutCredit,
                });

                setEditingSale(null);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Date :</label>
                  <input
                    type="date"
                    required
                    value={editingSale.date}
                    onChange={(e) => setEditingSale({ ...editingSale, date: e.target.value })}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Vendeur affecté :
                  </label>
                  <select
                    value={editingSale.vendeur}
                    onChange={(e) => setEditingSale({ ...editingSale, vendeur: e.target.value })}
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-semibold focus:outline-none focus:border-blue-500"
                  >
                    {sellers.map((v) => (
                      <option key={v.id} value={v.nom}>
                        {v.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">
                    Quantité Vendue :
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingSale.quantite}
                    onChange={(e) =>
                      setEditingSale({ ...editingSale, quantite: Number(e.target.value) })
                    }
                    className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-blue-300 font-bold mb-1">
                    Prix Vente Unit. (Ar) :
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingSale.prixVenteUnit}
                    onChange={(e) =>
                      setEditingSale({ ...editingSale, prixVenteUnit: Number(e.target.value) })
                    }
                    className="w-full bg-blue-950/40 border border-blue-500/50 rounded-xl px-3 py-2 text-blue-200 font-mono font-bold focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">
                      Client Crédit :
                    </label>
                    <input
                      type="text"
                      value={editingSale.clientCredit || ""}
                      onChange={(e) =>
                        setEditingSale({
                          ...editingSale,
                          clientCredit: e.target.value || undefined,
                        })
                      }
                      placeholder="laisser vide si comptant"
                      className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">
                      Montant Payé Comptant :
                    </label>
                    <input
                      type="number"
                      value={editingSale.montantPaye}
                      onChange={(e) =>
                        setEditingSale({
                          ...editingSale,
                          montantPaye: Number(e.target.value),
                        })
                      }
                      className="w-full bg-muted border border-muted-foreground/20 rounded-xl px-3 py-2 text-foreground font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm"
                >
                  Sauvegarder Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt / Facture Preview & Printing Modal */}
      {selectedReceiptSale && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-2xl p-6 shadow-2xl text-foreground space-y-6 my-8">
            {/* Modal Controls Bar (hidden during printing) */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4 no-print">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-foreground">
                  Téléchargement & Impression du Reçu / Facture
                </h3>
              </div>

              {/* Toggle Mode: Ticket Caisse vs Facture A4 */}
              <div className="flex items-center bg-muted p-1 rounded-xl border border-muted-foreground/20 text-xs font-semibold">
                <button
                  onClick={() => setReceiptMode("ticket")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    receiptMode === "ticket"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Ticket Caisse (80mm)
                </button>
                <button
                  onClick={() => setReceiptMode("facture")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    receiptMode === "facture"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Facture Officielle (A4)
                </button>
              </div>

              {/* Print / Download / Close Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
                <button
                  onClick={() => {
                    const textContent = `
=== ${settings?.storeName || "BALSAMA AUTO GESTION"} ===
${settings?.subtitle || "Système unifié Stock, Trésorerie, Vendeurs & Dépenses"}
Adresse: ${settings?.address || "Lot IVG 124, Antananarivo 101"}
Tél: ${settings?.phone || "+261 34 12 345 67"}
${settings?.nifStat || "NIF: 4001234567 | STAT: 50111112023"}
------------------------------------------------
DOCUMENT: ${receiptMode === "facture" ? "FACTURE OFFICIELLE" : "REÇU DE CAISSE"}
N°: #${selectedReceiptSale.numero}
Date: ${selectedReceiptSale.date}
Vendeur: ${selectedReceiptSale.vendeur}
Client: ${selectedReceiptSale.clientCredit || "Comptoir"}
------------------------------------------------
ARTICLE: ${selectedReceiptSale.designation}
QTÉ: ${selectedReceiptSale.quantite}
P.U: ${formatCurrency(selectedReceiptSale.prixVenteUnit)}
TOTAL: ${formatCurrency(selectedReceiptSale.totalVente)}
------------------------------------------------
TOTAL NET: ${formatCurrency(selectedReceiptSale.totalVente)}
MONTANT PAYÉ: ${formatCurrency(selectedReceiptSale.montantPaye)}
SOLDE DÛ: ${formatCurrency(selectedReceiptSale.soldeDu)}
STATUT: ${selectedReceiptSale.statutCredit}
------------------------------------------------
${settings?.receiptFooter || "Merci pour votre confiance ! Ni repris, ni échangé après 48h."}
                    `.trim();

                    const element = document.createElement("a");
                    const file = new Blob([textContent], { type: "text/plain" });
                    element.href = URL.createObjectURL(file);
                    element.download = `${receiptMode === "facture" ? "Facture" : "Recu"}_${selectedReceiptSale.numero}.txt`;
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-foreground border border-muted-foreground/20 rounded-xl text-xs font-semibold transition-colors"
                  title="Télécharger résumé texte"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger (.TXT)
                </button>
                <button
                  onClick={() => setSelectedReceiptSale(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Container Rendering */}
            <div className="flex justify-center bg-background p-4 rounded-xl border border-border max-h-[60vh] overflow-y-auto">
              {receiptMode === "ticket" ? (
                /* Ticket Thermal Receipt Format */
                <div className="printable-receipt bg-amber-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-amber-200">
                  {/* Store Header */}
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
                      {settings?.subtitle || "Système unifié Stock & Ventes"}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {settings?.address || "Lot IVG 124, Antananarivo 101"}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      Tél: {settings?.phone || "+261 34 12 345 67"}
                    </p>
                    {settings?.nifStat && (
                      <p className="text-[9px] text-muted-foreground font-semibold pt-0.5">
                        {settings.nifStat}
                      </p>
                    )}
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 text-[10px] gap-1">
                    <div>
                      <span className="text-muted-foreground">Reçu N°:</span>{" "}
                      <span className="font-bold">#{selectedReceiptSale.numero}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Date:</span>{" "}
                      <span>{selectedReceiptSale.date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendeur:</span>{" "}
                      <span className="font-semibold">{selectedReceiptSale.vendeur}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Client:</span>{" "}
                      <span className="font-semibold">
                        {selectedReceiptSale.clientCredit || "Comptoir"}
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Itemized Table */}
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-300 font-bold uppercase text-slate-700">
                        <th className="py-1">ART.</th>
                        <th className="py-1 text-center">QTÉ</th>
                        <th className="py-1 text-right">P.U</th>
                        <th className="py-1 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                     <tr>
                        <td className="py-1.5 font-semibold text-slate-900 break-words pr-1">
                          {getSaleLabel(selectedReceiptSale, products)}
                          <div className="text-[9px] text-muted-foreground font-normal">
                            Ref:{" "}
                            {products.find((p) => p.id === selectedReceiptSale.productId)
                              ?.numero || selectedReceiptSale.productId}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold">
                          {selectedReceiptSale.quantite}
                        </td>
                        <td className="py-1.5 text-right font-semibold">
                          {formatCurrency(selectedReceiptSale.prixVenteUnit)}
                        </td>
                        <td className="py-1.5 text-right font-bold">
                          {formatCurrency(selectedReceiptSale.totalVente)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Totals Breakdown */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between font-bold text-sm text-slate-950 pt-1">
                      <span>TOTAL NET :</span>
                      <span>{formatCurrency(selectedReceiptSale.totalVente)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-700">
                      <span>Montant Payé (Espèces/Mobile) :</span>
                      <span className="font-semibold text-emerald-800">
                        {formatCurrency(selectedReceiptSale.montantPaye)}
                      </span>
                    </div>
                    {selectedReceiptSale.soldeDu > 0 && (
                      <div className="flex justify-between text-[10px] text-amber-900 font-semibold bg-amber-100 p-1 rounded">
                        <span>Reste à Payer (Crédit) :</span>
                        <span>{formatCurrency(selectedReceiptSale.soldeDu)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] pt-1">
                      <span className="text-muted-foreground">Statut Règlement :</span>
                      <span className="font-bold uppercase tracking-wider text-slate-900">
                        {selectedReceiptSale.statutCredit}
                      </span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Footer Note */}
                  <div className="text-center text-[9px] text-slate-600 italic">
                    {settings?.receiptFooter ||
                      "Merci pour votre confiance ! Ni repris, ni échangé après 48h."}
                  </div>
                </div>
              ) : (
                /* Facture Officielle A4 Format */
                <div className="printable-receipt bg-white text-slate-900 w-full max-w-xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
                  {/* Top Header */}
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div className="space-y-1.5">
                      {settings?.logoUrl && (
                        <img
                          src={settings.logoUrl}
                          alt="Logo"
                          className="w-16 h-16 object-cover rounded-full mb-2"
                        />
                      )}
                      <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                        {settings?.storeName || "BALSAMA AUTO GESTION"}
                      </h1>
                      <p className="text-muted-foreground text-[11px]">
                        {settings?.subtitle || "Vente de pièces détachées & accessoires auto"}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        {settings?.address || "Lot IVG 124, Antananarivo 101"}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        Tél: {settings?.phone || "+261 34 12 345 67"} | Email:{" "}
                        {settings?.email || "contact@balsama-auto.mg"}
                      </p>
                      {settings?.nifStat && (
                        <p className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block">
                          {settings.nifStat}
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <div className="inline-block bg-card text-white px-4 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider">
                        FACTURE N° #{selectedReceiptSale.numero}
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <p>
                          <span className="font-semibold text-slate-800">Date d'émission :</span>{" "}
                          {selectedReceiptSale.date}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">
                            Vendeur responsable :
                          </span>{" "}
                          {selectedReceiptSale.vendeur}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                        Facturé À (Client) :
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {selectedReceiptSale.clientCredit || "Client Comptoir / Anonyme"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                        Statut de Paiement :
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedReceiptSale.statutCredit === "Payé"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : selectedReceiptSale.statutCredit === "Partiel"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {selectedReceiptSale.statutCredit}
                      </span>
                    </div>
                  </div>

                  {/* Detailed Table */}
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-y border-slate-300">
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Désignation de l'Article</th>
                        <th className="p-2.5 text-center">Quantité</th>
                        <th className="p-2.5 text-right">Prix Unitaire</th>
                        <th className="p-2.5 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2.5 font-mono text-muted-foreground font-semibold">
                          {products.find((p) => p.id === selectedReceiptSale.productId)?.numero ||
                            selectedReceiptSale.productId}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {getSaleLabel(selectedReceiptSale, products)}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {selectedReceiptSale.quantite}
                        </td>
                        <td className="p-2.5 text-right font-semibold">
                          {formatCurrency(selectedReceiptSale.prixVenteUnit)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {formatCurrency(selectedReceiptSale.totalVente)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Totals Summary */}
                  <div className="flex justify-end pt-2">
                    <div className="w-64 space-y-2 text-xs border-t border-slate-300 pt-3">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Global :</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedReceiptSale.totalVente)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Montant Encaissé :</span>
                        <span>{formatCurrency(selectedReceiptSale.montantPaye)}</span>
                      </div>
                      {selectedReceiptSale.soldeDu > 0 && (
                        <div className="flex justify-between text-rose-700 font-bold bg-rose-50 p-1.5 rounded border border-rose-200">
                          <span>Solde Restant Dû :</span>
                          <span>{formatCurrency(selectedReceiptSale.soldeDu)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-900">
                        <span>NET À PAYER :</span>
                        <span>{formatCurrency(selectedReceiptSale.totalVente)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Footer */}
                  <div className="border-t border-slate-200 pt-4 text-[10px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-slate-700">Conditions de vente :</p>
                    <p className="italic">
                      {settings?.receiptFooter ||
                        "Merci pour votre confiance ! Ni repris, ni échangé après 48h."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};