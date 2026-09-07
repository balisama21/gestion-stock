import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sale, Product, Seller, LocaleSetting, StoreSettings } from "../types";
import type { Database } from "../lib/database.types";
import { BoutonScan } from "./shared/BoutonScan";
import { APP_NAME } from "../lib/appConfig";
import {
  DollarSign,
  Lock,
  Minus,
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
import { reprendreApresDeploiement, messageDErreurExport } from "../lib/chunkRecovery";
import {
  PAPER_FORMATS,
  getPaperFormat,
  paperFromLegacyFormat,
  type PaperFormatId,
} from "../lib/paperFormats";

type Client = Database["public"]["Tables"]["clients"]["Row"];

/** Un produit posé dans le panier, avec son prix tel qu'il sera vendu. */
interface LignePanier {
  productId: string;
  quantite: number;
  prixVenteUnit: number;
}

interface VentesViewProps {
  sales: Sale[];
  products: Product[];
  /** Les fiches clients de la boutique, pour rattacher la vente à l'une d'elles. */
  clients: Client[];
  sellers: Seller[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  /**
   * Enregistre un panier : une ligne par produit, reliées par un ticket.
   * Un seul produit reste un panier d'une ligne — un seul chemin, donc
   * un seul endroit où le stock et le paiement sont vérifiés.
   */
  onAddSaleTicket: (panier: {
    date: string;
    vendeur: string;
    clientCredit?: string | null;
    /** La fiche client, quand la vente est rattachée à l'une d'elles. */
    clientId?: string | null;
    montantPaye: number;
    lignes: { productId: string; quantite: number; prixVenteUnit: number }[];
  }) => Promise<{ ventes: Sale[]; error: string | null }>;
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
  clients,
  sellers,
  locale,
  settings,
  onAddSaleTicket,
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
   * Les lignes du ticket qu'on vient d'encaisser.
   *
   * Elles arrivent en retour de l'enregistrement, avant que la liste
   * `sales` n'ait été rechargée : sans elles, le reçu d'un panier de
   * trois produits n'en montrerait qu'un pendant une seconde.
   */
  const [ventesRecu, setVentesRecu] = useState<Sale[] | null>(null);

  /** Toutes les lignes que le document doit montrer. */
  const ventesDuTicket = useMemo(() => {
    if (!selectedReceiptSale) return [];
    if (ventesRecu && ventesRecu.length > 0) return ventesRecu;
    const ticket = selectedReceiptSale.ticketId;
    if (!ticket) return [selectedReceiptSale];
    const lignes = sales.filter((v) => v.ticketId === ticket);
    return lignes.length > 0 ? lignes : [selectedReceiptSale];
  }, [selectedReceiptSale, ventesRecu, sales]);

  /**
   * Les totaux du document, additionnés sur tout le ticket. Une seule
   * ligne d'un panier de trois donnerait un total faux sur le reçu.
   */
  const totauxRecu = useMemo(() => {
    const total = ventesDuTicket.reduce((n, v) => n + v.totalVente, 0);
    const paye = ventesDuTicket.reduce((n, v) => n + v.montantPaye, 0);
    const du = ventesDuTicket.reduce((n, v) => n + v.soldeDu, 0);
    const statut = du <= 0 ? "Payé" : paye > 0 ? "Partiel" : "Impayé";
    return { total, paye, du, statut };
  }, [ventesDuTicket]);

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
  const lignesDocument = useMemo(
    () =>
      ventesDuTicket.map((v) => ({
        id: v.id,
        designation: getSaleLabel(v, products),
        reference: products.find((p) => p.id === v.productId)?.numero ?? null,
        quantite: v.quantite,
        prixUnitaire: v.prixVenteUnit,
        total: v.totalVente,
      })),
    [ventesDuTicket, products],
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
    if (!noeud || !selectedReceiptSale || exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const nom = nomDeFichier(receiptMode === "facture" ? "Facture" : "Recu", selectedReceiptSale.numero);
      if (type === "pdf") await exporterPdf(noeud, paper, nom);
      else await exporterImage(noeud, nom, "png");
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même, inutile d'afficher
      // une erreur technique que personne ne peut interpréter.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  // Seule couleur du document : le statut de règlement, où elle informe.
  const badgeStatut =
    totauxRecu.statut === "Payé"
      ? "app-badge-success"
      : totauxRecu.statut === "Partiel"
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
  // La fiche choisie. Vide = client de passage, et le nom se saisit à
  // la main comme avant : on ne force personne à créer une fiche pour
  // encaisser au comptoir.
  const [clientChoisi, setClientChoisi] = useState("");
  const [codeSaisi, setCodeSaisi] = useState("");
  const [messageCode, setMessageCode] = useState<string | null>(null);
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [montantPaye, setMontantPaye] = useState<number>(0);

  /**
   * Retrouver un produit par son code-barres.
   *
   * Une douchette USB ou Bluetooth se comporte comme un clavier : elle
   * tape le code puis Entrée. Le champ marche donc sans caméra, et sans
   * douchette non plus — on peut taper le code à la main.
   */
  const chercherParCode = (code: string) => {
    const propre = code.trim();
    if (!propre) return;
    const trouve = products.find(
      (p) => (p.codeBarres ?? "").trim() === propre || (p.sku ?? "").trim() === propre,
    );
    if (!trouve) {
      setMessageCode(`Aucun produit ne porte le code « ${propre} ».`);
      return;
    }
    setSelectedProductId(trouve.id);
    setIsCustomPrice(false);
    setCodeSaisi("");
    // Scanner, c'est vouloir vendre : l'article part directement dans le
    // panier, et un second passage sur le même code l'y compte deux fois.
    if (ajouterAuPanier(trouve.id, 1, trouve.prixVenteDefaut)) {
      setMessageCode(`${getProductLabel(trouve, products)} ajouté au panier.`);
    } else {
      setMessageCode(null);
    }
  };

  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [clients],
  );

  const nomDeLaFiche = (c: Client) => [c.nom, c.prenom].filter(Boolean).join(" ");

  /**
   * Le nom reste écrit sur la vente même quand une fiche est choisie :
   * c'est lui qui part sur le reçu, et il garde son sens si la fiche
   * est renommée ou supprimée plus tard.
   */
  const choisirClient = (id: string) => {
    setClientChoisi(id);
    const fiche = clients.find((c) => c.id === id);
    setClientCredit(fiche ? nomDeLaFiche(fiche) : "");
  };

  // Auto pre-fill default price when product changes (Demand 2)
  useEffect(() => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (prod && !isCustomPrice) {
      setPrixVenteUnit(prod.prixVenteDefaut);
    }
  }, [selectedProductId, products, isCustomPrice]);

  // Keep montantPaye updated to Total Vente by default unless partial credit
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const produitDe = (id: string) => products.find((p) => p.id === id);
  const totalPanier = panier.reduce((n, l) => n + l.quantite * l.prixVenteUnit, 0);

  useEffect(() => {
    if (!clientCredit) {
      setMontantPaye(totalPanier);
    }
  }, [totalPanier, clientCredit]);

  /**
   * Poser un produit dans le panier.
   *
   * Un produit déjà présent voit sa quantité augmenter au lieu d'ouvrir
   * une seconde ligne : deux lignes du même produit passeraient chacune
   * le contrôle de stock alors qu'ensemble elles le dépassent. C'est
   * aussi le geste attendu quand on scanne deux fois le même article.
   */
  const ajouterAuPanier = (productId: string, ajout: number, prix: number) => {
    const prod = produitDe(productId);
    if (!prod || ajout <= 0) return false;
    const existante = panier.find((l) => l.productId === productId);
    const voulu = (existante?.quantite ?? 0) + ajout;
    if (voulu > prod.stockDisponible) {
      setFormError(
        prod.stockReserve > 0
          ? `Il ne reste que ${prod.stockDisponible} unité(s) disponible(s) de « ${getProductLabel(prod, products)} » (${prod.stockReserve} réservée(s) par des commandes).`
          : `Il ne reste que ${prod.stockDisponible} unité(s) de « ${getProductLabel(prod, products)} ».`,
      );
      return false;
    }
    setFormError(null);
    setPanier((lignes) =>
      existante
        ? lignes.map((l) => (l.productId === productId ? { ...l, quantite: voulu } : l))
        : [...lignes, { productId, quantite: ajout, prixVenteUnit: prix }],
    );
    return true;
  };

  const changerQuantite = (productId: string, quantite: number) => {
    const prod = produitDe(productId);
    if (quantite <= 0) {
      setPanier((lignes) => lignes.filter((l) => l.productId !== productId));
      return;
    }
    if (prod && quantite > prod.stockDisponible) return;
    setFormError(null);
    setPanier((lignes) =>
      lignes.map((l) => (l.productId === productId ? { ...l, quantite } : l)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    if (panier.length === 0) {
      setFormError("Ajoutez au moins un produit au panier.");
      return;
    }
    if (!vendeur) {
      setFormError("Choisissez le vendeur.");
      return;
    }

    // Le stock est revérifié en base, produit par produit et sous verrou.
    // Ce contrôle-ci sert à répondre tout de suite, pas à faire autorité.
    for (const ligne of panier) {
      const prod = produitDe(ligne.productId);
      if (prod && ligne.quantite > prod.stockDisponible) {
        setFormError(
          `Il ne reste que ${prod.stockDisponible} unité(s) de « ${getProductLabel(prod, products)} », et le panier en demande ${ligne.quantite}.`,
        );
        return;
      }
    }

    const paye = Number(montantPaye);
    if (paye < 0 || paye > totalPanier) {
      setFormError("Le montant payé doit être compris entre zéro et le total du panier.");
      return;
    }

    setSaving(true);
    const result = await onAddSaleTicket({
      date,
      vendeur,
      clientCredit: clientCredit.trim() || null,
      clientId: clientChoisi || null,
      montantPaye: paye,
      lignes: panier,
    });
    setSaving(false);

    if (result.error || result.ventes.length === 0) {
      setFormError(result.error ?? "La vente n'a pas pu être enregistrée.");
      return;
    }

    setIsModalOpen(false);
    setIsCustomPrice(false);
    setPanier([]);
    setClientCredit("");
    setClientChoisi("");
    setCodeSaisi("");
    setMessageCode(null);
    setFormError(null);
    // Le reçu porte sur tout le ticket : on garde les lignes renvoyées
    // par la base, la liste `sales` n'étant pas encore rechargée.
    setVentesRecu(result.ventes);
    setSelectedReceiptSale(result.ventes[0]);
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
        module="ventes"
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
                    onClick={() => {
                      setVentesRecu(null);
                      setSelectedReceiptSale(s);
                    }}
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
            <label
              htmlFor="vente-code"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Code-barres
            </label>
            <div className="flex gap-2">
              <input
                id="vente-code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Scannez ou tapez le code, puis Entrée"
                className="app-field font-mono"
                value={codeSaisi}
                onChange={(e) => {
                  setCodeSaisi(e.target.value);
                  setMessageCode(null);
                }}
                onKeyDown={(e) => {
                  // Entrée cherche le produit au lieu d'envoyer le
                  // formulaire : une douchette termine toujours par là,
                  // et la vente partirait avant d'être remplie.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    chercherParCode(codeSaisi);
                  }
                }}
              />
              <BoutonScan
                onCode={chercherParCode}
                libelle="Scanner le code-barres du produit à vendre"
                titre="Scanner le produit"
              />
            </div>
            {messageCode && (
              <p
                role="status"
                className={`mt-1 text-xs ${
                  messageCode.startsWith("Aucun") ? "t-danger" : "t-success"
                }`}
              >
                {messageCode}
              </p>
            )}
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

          <button
            type="button"
            onClick={() => {
              if (ajouterAuPanier(selectedProductId, Number(quantite), Number(prixVenteUnit))) {
                setIsCustomPrice(false);
                setQuantite(1);
              }
            }}
            disabled={!selectedProductId}
            className="app-btn-secondary w-full"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter au panier
          </button>

          {/* ── Le panier ── */}
          <div className="border-t border-border pt-4">
            <h4 className="app-section-title mb-2">
              Panier {panier.length > 0 ? `(${panier.length})` : ""}
            </h4>
            {panier.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Scannez un code-barres, ou choisissez un produit ci-dessus et
                ajoutez-le.
              </p>
            ) : (
              <div className="app-list rounded-xl border border-border">
                {panier.map((ligne) => {
                  const prod = produitDe(ligne.productId);
                  const nom = prod ? getProductLabel(prod, products) : ligne.productId;
                  return (
                    <div
                      key={ligne.productId}
                      className="app-list-row flex-col items-stretch gap-2"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="app-list-primary min-w-0 flex-1">{nom}</span>
                        <span className="app-list-amount">
                          {formatCurrency(ligne.quantite * ligne.prixVenteUnit)}
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => changerQuantite(ligne.productId, ligne.quantite - 1)}
                            className="app-btn-icon h-7 w-7"
                            aria-label={`Une unité de moins de ${nom}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono text-sm tabular-nums">
                            {ligne.quantite}
                          </span>
                          <button
                            type="button"
                            onClick={() => ajouterAuPanier(ligne.productId, 1, ligne.prixVenteUnit)}
                            className="app-btn-icon h-7 w-7"
                            aria-label={`Une unité de plus de ${nom}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        <span className="app-list-secondary truncate">
                          {formatCurrency(ligne.prixVenteUnit)} / u
                        </span>
                        <button
                          type="button"
                          onClick={() => changerQuantite(ligne.productId, 0)}
                          className="app-btn-icon h-7 w-7"
                          aria-label={`Retirer ${nom} du panier`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="app-section-title">Client et règlement</h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="vente-client"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Client
                </label>
                <select
                  id="vente-client"
                  value={clientChoisi}
                  onChange={(e) => choisirClient(e.target.value)}
                  className="app-field"
                >
                  <option value="">Client de passage</option>
                  {clientsTries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nomDeLaFiche(c)}
                      {c.entreprise ? ` — ${c.entreprise}` : ""}
                    </option>
                  ))}
                </select>
                {clientChoisi === "" ? (
                  <input
                    type="text"
                    value={clientCredit}
                    onChange={(e) => setClientCredit(e.target.value)}
                    placeholder="Nom du client, si vous voulez le noter"
                    className="app-field mt-2"
                    aria-label="Nom du client de passage"
                  />
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    La vente apparaîtra dans la fiche de ce client.
                  </p>
                )}
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
            <StatCol label="Total du panier" value={formatCurrency(totalPanier)} />
            <StatCol
              label="Reste à payer"
              value={formatCurrency(totalPanier - montantPaye)}
              alert={totalPanier - montantPaye > 0}
              hint={totalPanier - montantPaye > 0 ? "Vente à crédit" : undefined}
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
          onClose={() => {
            setSelectedReceiptSale(null);
            setVentesRecu(null);
          }}
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
                      {settings?.storeName || APP_NAME}
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
                      <span>{formatCurrency(totauxRecu.total)}</span>
                    </div>
                    <div className="flex justify-between gap-3 pt-1 text-slate-600">
                      <span>Payé</span>
                      <span className="text-slate-900">
                        {formatCurrency(totauxRecu.paye)}
                      </span>
                    </div>
                    {totauxRecu.du > 0 && (
                      <div className="flex justify-between gap-3 font-semibold text-slate-900">
                        <span>Reste à payer</span>
                        <span>{formatCurrency(totauxRecu.du)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <span className={`app-badge ${badgeStatut} text-[9px]`}>
                      {totauxRecu.statut}
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
                          {settings?.storeName || APP_NAME}
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
                        {totauxRecu.statut}
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
                          {formatCurrency(totauxRecu.total)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 text-slate-500">
                        <dt>Montant encaissé</dt>
                        <dd className="font-mono tabular-nums text-slate-700">
                          {formatCurrency(totauxRecu.paye)}
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
                          {formatCurrency(totauxRecu.du)}
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