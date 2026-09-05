import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Image as ImageIcon,
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
import {
  formatCurrency,
  formatDateLocale,
  getProductLabel,
  getSaleLabel,
  getSaleVariant,
} from "../utils/formulas";
import { VariantBadge } from "./shared/VariantBadge";
import { PageHeader, HeaderMetric } from "./shared/PageHeader";
import { FilterBar, FilterField } from "./shared/FilterBar";
import { DataList } from "./shared/DataList";
import { StatBar, StatCol } from "./shared/StatBar";
import { Modal } from "./shared/Modal";
import { useInvoicePrefs } from "../lib/invoicePrefs";
import {
  exporterPdf,
  exporterImage,
  imprimerDocument,
  nomDeFichier,
} from "../lib/documentExport";
import {
  PAPER_FORMATS,
  getPaperFormat,
  paperFromLegacyFormat,
  type PaperFormatId,
} from "../lib/paperFormats";

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

  /**
   * Les préférences d'impression étaient réglables dans Paramètres →
   * Facturation, avec un aperçu qui les reflétait fidèlement… mais le
   * document réel ne les lisait nulle part. Cocher « ne pas imprimer le
   * logo » ou « afficher l'e-mail » n'avait donc aucun effet sur ce qui
   * sortait de l'imprimante. Elles pilotent désormais le reçu comme la
   * facture, `defaultFormat` compris.
   */
  const [invoicePrefs] = useInvoicePrefs();

  /**
   * Format de papier du document. Il détermine trois choses d'un coup :
   * la disposition (facture tabulaire ou ticket en pleine largeur), la
   * largeur exacte de l'aperçu, et le format que la boîte d'impression
   * proposera — donc aussi celui du PDF si l'utilisateur enregistre.
   */
  const [paperId, setPaperId] = useState<PaperFormatId>(
    paperFromLegacyFormat(invoicePrefs.defaultFormat),
  );
  const paper = getPaperFormat(paperId);
  const receiptMode = paper.layout === "invoice" ? "facture" : "ticket";

  // Le format par défaut est lu depuis le stockage local après le premier
  // rendu : on aligne l'état une fois qu'il est connu, tant qu'aucun reçu
  // n'est ouvert pour ne pas changer le format sous les yeux de
  // l'utilisateur.
  useEffect(() => {
    if (!selectedReceiptSale) setPaperId(paperFromLegacyFormat(invoicePrefs.defaultFormat));
  }, [invoicePrefs.defaultFormat, selectedReceiptSale]);

  /**
   * Lignes du document. Une vente ne porte aujourd'hui qu'un seul
   * produit, mais le document est écrit pour une liste : le jour où une
   * commande sera facturable, seule cette valeur changera.
   */
  const lignesDocument = useMemo(() => {
    if (!selectedReceiptSale) return [];
    return [
      {
        id: selectedReceiptSale.id,
        designation: getSaleLabel(selectedReceiptSale, products),
        reference:
          products.find((p) => p.id === selectedReceiptSale.productId)?.numero ?? null,
        quantite: selectedReceiptSale.quantite,
        prixUnitaire: selectedReceiptSale.prixVenteUnit,
        total: selectedReceiptSale.totalVente,
      },
    ];
  }, [selectedReceiptSale, products]);

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
    if (!noeud || !selectedReceiptSale || exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const nom = nomDeFichier(receiptMode === "facture" ? "Facture" : "Recu", selectedReceiptSale.numero);
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

  // Seule couleur du document : le statut de règlement, où elle informe.
  const badgeStatut =
    selectedReceiptSale?.statutCredit === "Payé"
      ? "app-badge-success"
      : selectedReceiptSale?.statutCredit === "Partiel"
        ? "app-badge-warning"
        : "app-badge-danger";

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
            const nom = prod ? getProductLabel(prod, products) : getSaleLabel(s, products);
            return {
              id: s.id,
              primary: (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {nom} ×{s.quantite}
                  </span>
                  {/* Le prix d'achat révèle la marge dès lors que le prix
                      de vente est visible : même permission. */}
                  <VariantBadge prix={getSaleVariant(s, products)} autorise={showMargeLigne} />
                </span>
              ),
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

      {/* ── Nouvelle vente ── */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormError(null);
        }}
        size="lg"
        icon={<DollarSign className="h-4 w-4" />}
        title="Nouvelle vente"
        description="Le prix de vente est libre : il est prérempli, puis modifiable."
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setFormError(null);
              }}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button type="submit" form="sale-add-form" className="app-btn-primary">
              Valider la vente
            </button>
          </>
        }
      >
        <form id="sale-add-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
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
                    {v.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Produit</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setIsCustomPrice(false);
              }}
              className="app-field font-mono"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.numero}] {getProductLabel(p, products)} (réf {p.prixVenteDefaut} Ar |
                  disponible {p.stockDisponible}
                  {p.stockReserve > 0 ? ` / ${p.stockActuel} total` : ""})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Quantité</label>
              <input
                type="number"
                required
                min="1"
                max={currentProduct?.stockDisponible || 999}
                value={quantite}
                onChange={(e) => setQuantite(Number(e.target.value))}
                className="app-field font-mono"
              />
              {currentProduct && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Disponible : {currentProduct.stockDisponible}
                  {currentProduct.stockReserve > 0
                    ? ` (${currentProduct.stockActuel} en stock, ${currentProduct.stockReserve} réservés par des commandes)`
                    : ""}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Prix de vente unitaire
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
                className="app-field font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Prérempli au prix de référence ({currentProduct?.prixVenteDefaut} Ar).
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="app-section-title">Crédit ou paiement partiel</h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Client</label>
                <input
                  type="text"
                  value={clientCredit}
                  onChange={(e) => setClientCredit(e.target.value)}
                  placeholder="Laisser vide si comptant"
                  className="app-field"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Montant payé comptant
                </label>
                <input
                  type="number"
                  value={montantPaye}
                  onChange={(e) => setMontantPaye(Number(e.target.value))}
                  className="app-field font-mono"
                />
              </div>
            </div>
          </div>

          {/* Récapitulatif */}
          <div className="app-statbar grid-cols-2">
            <StatCol label="Total de la vente" value={formatCurrency(calculatedTotalVente)} />
            <StatCol
              label="Reste à payer"
              value={formatCurrency(calculatedTotalVente - montantPaye)}
              alert={calculatedTotalVente - montantPaye > 0}
              hint={calculatedTotalVente - montantPaye > 0 ? "Vente à crédit" : undefined}
            />
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm t-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
        </form>
      </Modal>

      {/* ── Modification d'une vente ── */}
      {editingSale && (
        <Modal
          open
          onClose={() => setEditingSale(null)}
          size="lg"
          icon={<Edit3 className="h-4 w-4" />}
          title={`Vente ${editingSale.numero}`}
          description={getSaleLabel(editingSale, products)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button type="submit" form="sale-edit-form" className="app-btn-primary">
                Enregistrer
              </button>
            </>
          }
        >
          <form
            id="sale-edit-form"
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
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
                <input
                  type="date"
                  required
                  value={editingSale.date}
                  onChange={(e) => setEditingSale({ ...editingSale, date: e.target.value })}
                  className="app-field font-mono"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Vendeur</label>
                <select
                  value={editingSale.vendeur}
                  onChange={(e) => setEditingSale({ ...editingSale, vendeur: e.target.value })}
                  className="app-field"
                >
                  {sellers.map((v) => (
                    <option key={v.id} value={v.nom}>
                      {v.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Quantité</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editingSale.quantite}
                  onChange={(e) =>
                    setEditingSale({ ...editingSale, quantite: Number(e.target.value) })
                  }
                  className="app-field font-mono"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Prix de vente unitaire (Ar)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editingSale.prixVenteUnit}
                  onChange={(e) =>
                    setEditingSale({ ...editingSale, prixVenteUnit: Number(e.target.value) })
                  }
                  className="app-field font-mono"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="app-section-title">Crédit ou paiement partiel</h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Client</label>
                  <input
                    type="text"
                    value={editingSale.clientCredit || ""}
                    onChange={(e) =>
                      setEditingSale({
                        ...editingSale,
                        clientCredit: e.target.value || undefined,
                      })
                    }
                    placeholder="Laisser vide si comptant"
                    className="app-field"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Montant payé comptant
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
                    className="app-field font-mono"
                  />
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Receipt / Facture Preview & Printing Modal */}
      {selectedReceiptSale && (
        <Modal
          open
          onClose={() => setSelectedReceiptSale(null)}
          size="2xl"
          icon={<Receipt className="w-4 h-4" />}
          title={receiptMode === "facture" ? "Facture" : "Reçu de caisse"}
          description={`N° ${selectedReceiptSale.numero} · ${paper.label}`}
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
ARTICLE: ${getSaleLabel(selectedReceiptSale, products)}
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
                  Résumé (.txt)
                </button>
            </>
          }
        >
            {/* ── Documents imprimables ──
                Couleurs figées en `slate` et non en jetons de thème : une
                feuille de reçu est du papier blanc, en mode clair comme
                en mode sombre. Le vert n'apparaît que sur le badge de
                statut, seul endroit où il porte une information.

                Le fond de l'aperçu est blanc, comme le papier : ce qui
                s'affiche est exactement ce qui s'imprime. */}
            {/* Le format choisi pilote la page nommée : la boîte
                d'impression s'ouvre déjà calée dessus, et « Enregistrer au
                format PDF » produit donc un PDF exactement à ce format. */}
            <p className="no-print text-xs text-muted-foreground">
              {paper.hint} · Pour un PDF, choisissez « Enregistrer au format PDF » dans la boîte
              d'impression : le fichier sortira exactement à ce format.
            </p>

            {exportErreur && (
              <p className="no-print rounded-xl border border-danger-border bg-danger-soft px-3 py-2.5 text-sm t-danger">
                {exportErreur}
              </p>
            )}

            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {receiptMode === "ticket" ? (
                /* ── Reçu de caisse ── */
                <div
                  ref={documentRef}
                  className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white p-4 font-mono leading-relaxed text-slate-900 shadow-sm ${paperId === "t58" ? "text-[10px]" : "text-[11px]"}`}
                  style={{ maxWidth: paper.previewWidth }}
                >
                  {/* En-tête boutique */}
                  <div className="space-y-0.5 text-center">
                    {invoicePrefs.showLogo && settings?.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt=""
                        className="mx-auto mb-2 h-12 w-12 rounded object-contain"
                      />
                    )}
                    <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-900">
                      {settings?.storeName || "BALSAMA AUTO GESTION"}
                    </h2>
                    {invoicePrefs.showAddress && (
                      <p className="text-[10px] text-slate-500">
                        {settings?.address || "Lot IVG 124, Antananarivo 101"}
                      </p>
                    )}
                    {invoicePrefs.showPhone && (
                      <p className="text-[10px] text-slate-500">
                        Tél. {settings?.phone || "+261 34 12 345 67"}
                      </p>
                    )}
                    {invoicePrefs.showEmail && settings?.email && (
                      <p className="text-[10px] text-slate-500">{settings.email}</p>
                    )}
                    {invoicePrefs.showNif && settings?.nifStat && (
                      <p className="text-[9px] text-slate-400">{settings.nifStat}</p>
                    )}
                  </div>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  {/* Références */}
                  <dl className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Reçu n°</dt>
                      <dd className="font-bold text-slate-900">{selectedReceiptSale.numero}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Date</dt>
                      <dd className="text-slate-900">
                        {formatDateLocale(selectedReceiptSale.date, locale)}
                      </dd>
                    </div>
                    {invoicePrefs.showSeller && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Vendeur</dt>
                        <dd className="text-slate-900">{selectedReceiptSale.vendeur}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Client</dt>
                      <dd className="min-w-0 text-right text-slate-900">
                        {selectedReceiptSale.clientCredit || "Comptoir"}
                      </dd>
                    </div>
                  </dl>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  {/* Articles.
                      Sur 80 mm, quatre colonnes serrées deviennent
                      illisibles. La désignation prend donc toute la
                      largeur, et la ligne de calcul se lit en dessous —
                      c'est la disposition des tickets de caisse. */}
                  <div className="space-y-2">
                    {lignesDocument.map((l) => (
                      <div key={l.id}>
                        <p className="font-semibold text-slate-900">{l.designation}</p>
                        <div className="flex justify-between gap-3 text-[10px] text-slate-600">
                          <span>
                            {l.quantite} × {formatCurrency(l.prixUnitaire)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(l.total)}
                          </span>
                        </div>
                        {l.reference && (
                          <p className="text-[9px] text-slate-400">Réf. {l.reference}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="my-3 border-t border-dashed border-slate-300" />

                  {/* Totaux */}
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between gap-3 border-b border-slate-900 pb-1 text-[13px] font-bold text-slate-900">
                      <span>TOTAL</span>
                      <span>{formatCurrency(selectedReceiptSale.totalVente)}</span>
                    </div>
                    <div className="flex justify-between gap-3 pt-1 text-slate-600">
                      <span>Payé</span>
                      <span className="text-slate-900">
                        {formatCurrency(selectedReceiptSale.montantPaye)}
                      </span>
                    </div>
                    {selectedReceiptSale.soldeDu > 0 && (
                      <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>Reste à payer</span>
                        <span>{formatCurrency(selectedReceiptSale.soldeDu)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <span className={`app-badge ${badgeStatut} text-[9px]`}>
                      {selectedReceiptSale.statutCredit}
                    </span>
                  </div>

                  {invoicePrefs.showFooter && (
                    <>
                      <div className="my-3 border-t border-dashed border-slate-300" />
                      <p className="text-center text-[9px] italic text-slate-500">
                        {settings?.receiptFooter ||
                          "Merci pour votre confiance ! Ni repris, ni échangé après 48h."}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                /* ── Facture A4 ── */
                <div
                  ref={documentRef}
                  className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white font-sans text-xs text-slate-900 shadow-sm ${paperId === "a5" ? "p-6" : "p-8"}`}
                  style={{ maxWidth: paper.previewWidth }}
                >
                  {/* En-tête : identité à gauche, référence du document à
                      droite. `flex-wrap` pour que le second bloc passe
                      dessous plutôt que de se serrer sur écran étroit. */}
                  <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
                    <div className="min-w-0 space-y-2">
                      {invoicePrefs.showLogo && settings?.logoUrl && (
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
                        {settings?.subtitle && (
                          <p className="text-[11px] text-slate-500">{settings.subtitle}</p>
                        )}
                        {invoicePrefs.showAddress && (
                          <p className="text-[11px] text-slate-500">
                            {settings?.address || "Lot IVG 124, Antananarivo 101"}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {[
                            invoicePrefs.showPhone
                              ? `Tél. ${settings?.phone || "+261 34 12 345 67"}`
                              : null,
                            invoicePrefs.showEmail ? settings?.email : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {invoicePrefs.showNif && settings?.nifStat && (
                          <p className="text-[10px] text-slate-400">{settings.nifStat}</p>
                        )}
                      </div>
                    </div>

                    {/* Référence du document : le numéro domine, la date
                        et le vendeur restent discrets sous lui. */}
                    <div className="min-w-0 space-y-1 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Facture
                      </p>
                      <p className="font-mono text-xl font-bold tracking-tight text-slate-900">
                        {selectedReceiptSale.numero}
                      </p>
                      <dl className="space-y-0.5 pt-1 text-[11px] text-slate-500">
                        <div className="flex gap-2 sm:justify-end">
                          <dt>Émise le</dt>
                          <dd className="font-medium text-slate-700">
                            {formatDateLocale(selectedReceiptSale.date, locale)}
                          </dd>
                        </div>
                        {invoicePrefs.showSeller && (
                          <div className="flex gap-2 sm:justify-end">
                            <dt>Vendeur</dt>
                            <dd className="font-medium text-slate-700">
                              {selectedReceiptSale.vendeur}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </header>

                  {/* Client et statut, sur un fond très léger qui les
                      détache du reste sans peser à l'impression. */}
                  <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Facturé à
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {selectedReceiptSale.clientCredit || "Client comptoir"}
                      </p>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Statut
                      </p>
                      <span className={`app-badge mt-1 ${badgeStatut}`}>
                        {selectedReceiptSale.statutCredit}
                      </span>
                    </div>
                  </section>

                  {/* Articles */}
                  <table className="mt-6 w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-3 font-semibold">Désignation</th>
                        <th className="py-2 px-2 text-center font-semibold">Qté</th>
                        <th className="py-2 px-2 text-right font-semibold">Prix unitaire</th>
                        <th className="py-2 pl-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesDocument.map((l, i) => (
                        <tr
                          key={l.id}
                          className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                        >
                          <td className="py-2.5 pr-3">
                            <span className="font-medium text-slate-900">{l.designation}</span>
                            {l.reference && (
                              <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                                {l.reference}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-center tabular-nums text-slate-700">
                            {l.quantite}
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(l.prixUnitaire)}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono font-medium tabular-nums text-slate-900">
                            {formatCurrency(l.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totaux, alignés à droite sous le tableau. */}
                  <div className="mt-5 flex justify-end">
                    <dl className="w-full max-w-[16rem] space-y-1.5 text-[11px]">
                      <div className="flex justify-between gap-4 text-slate-500">
                        <dt>Total</dt>
                        <dd className="font-mono tabular-nums text-slate-700">
                          {formatCurrency(selectedReceiptSale.totalVente)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 text-slate-500">
                        <dt>Montant encaissé</dt>
                        <dd className="font-mono tabular-nums text-slate-700">
                          {formatCurrency(selectedReceiptSale.montantPaye)}
                        </dd>
                      </div>
                      {/* « Net à payer » porte le solde restant dû, et non
                          le total de la vente. C'est le sens de la mention
                          sur une facture : ce que le client doit encore
                          sortir. Elle répétait jusqu'ici le total, si bien
                          qu'un acompte de 3 000 sur 6 500 donnait
                          « encaissé 3 000 » suivi de « net à payer 6 500 » —
                          de quoi faire payer deux fois.
                          La ligne « Reste dû » disparaît : elle disait
                          désormais la même chose. */}
                      <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-2">
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                          Net à payer
                        </dt>
                        <dd className="font-mono text-base font-bold tabular-nums text-slate-900">
                          {formatCurrency(selectedReceiptSale.soldeDu)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {invoicePrefs.showFooter && (
                    <footer className="mt-8 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
                      <p className="font-semibold text-slate-600">Conditions de vente</p>
                      <p>
                        {settings?.receiptFooter ||
                          "Merci pour votre confiance ! Ni repris, ni échangé après 48h."}
                      </p>
                    </footer>
                  )}
                </div>
              )}
            </div>
        </Modal>
      )}
    </div>
  );
};