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
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { StatBar } from "./shared/StatBar";
import { Modal } from "./shared/Modal";

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
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-sm text-amber-600 dark:t-warning">
          <Lock className="w-5 h-5 shrink-0" />
          <span>
            Vous n'avez pas accès à l'historique complet des ventes de la boutique — seules{" "}
            <strong>vos propres ventes</strong> sont affichées ci-dessous.
          </span>
        </div>
      )}
      {/* Header */}
      <PageHeader
        icon={<DollarSign className="w-5 h-5 t-info" />}
        title="Ventes"
        subtitle="Enregistrez vos ventes et suivez les paiements de vos clients."
        metric={
          showMontant ? (
            <HeaderMetric
              label="Chiffre d'affaires"
              value={formatCurrency(totalVentesCA)}
              hint={showMargeCumulee ? `Marge : +${formatCurrency(totalMarges)}` : undefined}
              tone="info"
            />
          ) : undefined
        }
        actions={
          <button onClick={() => setIsModalOpen(true)} className="app-btn-primary w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Nouvelle vente
          </button>
        }
      />

      {/* Indicateurs */}
      {(showPaiement || showSolde || showMargeCumulee) && (
        <StatBar
          className="sm:grid-cols-3 xl:grid-cols-3"
          items={[
            ...(showPaiement
              ? [
                  {
                    key: "encaisse",
                    label: "Encaissé",
                    value: formatCurrency(totalPayeEncaisse),
                    hint: "déjà reçu des clients",
                    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                  },
                ]
              : []),
            ...(showSolde
              ? [
                  {
                    key: "solde",
                    label: "Reste à encaisser",
                    value: formatCurrency(totalSoldeDuCredit),
                    hint: "crédits clients en cours",
                    alert: totalSoldeDuCredit > 0,
                    icon: <Clock className="h-3.5 w-3.5" />,
                  },
                ]
              : []),
            ...(showMargeCumulee
              ? [
                  {
                    key: "marge",
                    label: "Marge",
                    value: `+${formatCurrency(totalMarges)}`,
                    hint: "bénéfice brut cumulé",
                    icon: <TrendingUp className="h-3.5 w-3.5" />,
                  },
                ]
              : []),
          ]}
        />
      )}

      {/* Recherche et filtres */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher un produit, un client, une référence…"
        activeFilterCount={
          (selectedSellerFilter !== "Tous" ? 1 : 0) + (selectedStatusFilter !== "Tous" ? 1 : 0)
        }
        onReset={() => {
          setSelectedSellerFilter("Tous");
          setSelectedStatusFilter("Tous");
          setSearchQuery("");
        }}
      >
        <FilterField label="Vendeur">
          <select
            value={selectedSellerFilter}
            onChange={(e) => setSelectedSellerFilter(e.target.value)}
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

        <FilterField label="Paiement">
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="app-field-sm lg:w-auto"
          >
            <option value="Tous">Tous les statuts</option>
            <option value="Payé">Payé</option>
            <option value="Partiel">Partiellement payé</option>
            <option value="Impayé">Impayé</option>
          </select>
        </FilterField>
      </FilterBar>

      {/* Liste unique — desktop ET mobile.
          L'ancien tableau alignait treize colonnes : sur grand écran il
          fallait faire glisser une barre en bas pour lire la fin d'une
          ligne, et suivre cette ligne du regard sur toute la largeur.
          Ici l'essentiel tient à gauche, le montant à droite, le statut
          à l'extrême droite, et le reste s'ouvre au clic. */}
      <div className="app-card overflow-hidden">
        <DataList
          emptyLabel="Aucune vente ne correspond à ces filtres."
          items={filteredSales.map((s) => {
            const prod = products.find((p) => p.id === s.productId);
            const nom = prod ? getProductLabel(prod, products) : s.designation;
            return {
              id: s.id,
              primary: `${nom} ×${s.quantite}`,
              meta: [
                formatDateLocale(s.date, locale),
                s.vendeur,
                showMontant ? `${formatCurrency(s.prixVenteUnit)} / u` : null,
                showMargeLigne ? `marge +${formatCurrency(s.margeTotale)}` : null,
                s.clientCredit || null,
              ],
              amount: showMontant ? formatCurrency(s.totalVente) : undefined,
              amountHint:
                showSolde && s.soldeDu > 0 ? (
                  <span className="t-warning">reste {formatCurrency(s.soldeDu)}</span>
                ) : undefined,
              badge: (
                <span
                  className={`app-badge ${
                    s.statutCredit === "Payé"
                      ? "app-badge-success"
                      : s.statutCredit === "Partiel"
                        ? "app-badge-warning"
                        : "app-badge-danger"
                  }`}
                >
                  {s.statutCredit}
                </span>
              ),
              detailTitle: nom,
              detailSubtitle: `Vente ${s.numero}`,
              details: [
                { label: "Date", value: formatDateLocale(s.date, locale) },
                { label: "Référence", value: s.numero },
                { label: "Code produit", value: prod?.numero ?? "—" },
                { label: "Quantité", value: `${s.quantite}` },
                ...(showMontant
                  ? [
                      { label: "Prix unitaire", value: formatCurrency(s.prixVenteUnit) },
                      { label: "Total", value: formatCurrency(s.totalVente) },
                    ]
                  : []),
                ...(showMargeLigne
                  ? [
                      {
                        label: "Marge",
                        value: <span className="t-success">+{formatCurrency(s.margeTotale)}</span>,
                      },
                    ]
                  : []),
                { label: "Vendeur", value: s.vendeur },
                { label: "Client", value: s.clientCredit || "-", hideIfEmpty: true },
                ...(showPaiement
                  ? [{ label: "Payé", value: formatCurrency(s.montantPaye) }]
                  : []),
                ...(showSolde && s.soldeDu > 0
                  ? [
                      {
                        label: "Reste à payer",
                        value: <span className="t-warning">{formatCurrency(s.soldeDu)}</span>,
                      },
                    ]
                  : []),
                { label: "Statut", value: s.statutCredit },
              ],
              actions: (
                <>
                  <button
                    onClick={() => setSelectedReceiptSale(s)}
                    className="app-btn-secondary"
                  >
                    <Receipt className="w-4 h-4" />
                    Reçu
                  </button>
                  {onEditSale && (
                    <button onClick={() => setEditingSale(s)} className="app-btn-secondary">
                      <Edit3 className="w-4 h-4" />
                      Modifier
                    </button>
                  )}
                  {onDeleteSale && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la vente ${s.numero} (${nom}) ?`)) {
                          onDeleteSale(s.id);
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
            };
          })}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-lg p-6 shadow-xl text-foreground space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 t-info" />
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
                    Vendeur :
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
                  <label className="block t-info font-bold mb-1 flex items-center justify-between">
                    <span>Prix de vente unitaire :</span>
                    <span className="text-[10px] t-success font-normal">Saisie libre</span>
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
                    className="w-full bg-info-soft border border-info-border rounded-xl px-3 py-2 t-info font-mono font-bold focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Prérempli avec prix réf ({currentProduct?.prixVenteDefaut} Ar), modifiable.
                  </span>
                </div>
              </div>

              {/* Credit Customer section */}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold t-warning">
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
                  <span className="text-muted-foreground text-[10px] block">Total de la vente :</span>
                  <span className="text-lg font-bold t-info">
                    {formatCurrency(calculatedTotalVente)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-[10px] block">Reste à payer :</span>
                  <span className="text-base font-bold t-warning">
                    {formatCurrency(calculatedTotalVente - montantPaye)}
                  </span>
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-xs t-danger bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
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
              <Edit3 className="w-5 h-5 t-info" />
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
                  <label className="block t-info font-bold mb-1">
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
                    className="w-full bg-info-soft border border-info-border rounded-xl px-3 py-2 t-info font-mono font-bold focus:outline-none focus:border-primary"
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
        <Modal
          open
          onClose={() => setSelectedReceiptSale(null)}
          size="2xl"
          icon={<Receipt className="w-4 h-4" />}
          title={receiptMode === "facture" ? "Facture" : "Reçu de caisse"}
          description={`N° ${selectedReceiptSale.numero}`}
          bodyClassName="space-y-4"
          headerAside={
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
              <button
                onClick={() => setReceiptMode("ticket")}
                aria-pressed={receiptMode === "ticket"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  receiptMode === "ticket"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Ticket
              </button>
              <button
                onClick={() => setReceiptMode("facture")}
                aria-pressed={receiptMode === "facture"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  receiptMode === "facture"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Facture A4
              </button>
            </div>
          }
          footer={
            <>
              <button
                  onClick={() => window.print()}
                  className="app-btn-primary"
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
                  className="app-btn-secondary"
                  title="Télécharger un résumé au format texte"
                >
                  <Download className="w-4 h-4" />
                  Télécharger (.txt)
                </button>
            </>
          }
        >
            {/* Print Container Rendering */}
            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {receiptMode === "ticket" ? (
                /* Ticket Thermal Receipt Format */
                <div className="printable-receipt mx-auto shrink-0 bg-amber-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-amber-200">
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
                <div className="printable-receipt mx-auto shrink-0 bg-white text-slate-900 w-full max-w-xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
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
        </Modal>
      )}
    </div>
  );
};