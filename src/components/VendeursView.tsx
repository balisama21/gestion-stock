import React, { useState, useMemo } from "react";
import { Seller, Sale, Expense, Purchase, LocaleSetting, StoreSettings, Product } from "../types";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import {
  Users,
  Plus,
  DollarSign,
  ArrowRightLeft,
  Trash2,
  Edit3,
  Search,
  ChevronRight,
  Printer,
  FileText,
  Receipt,
  Download,
} from "lucide-react";
import { formatCurrency, formatDateLocale, getSaleLabel } from "../utils/formulas";
import { PageHeader } from "./shared/PageHeader";
import { StatCol } from "./shared/StatBar";
import { DataList } from "./shared/DataList";
import { Modal } from "./shared/Modal";

interface VendeursViewProps {
  sellers: Seller[];
  sales: Sale[];
  expenses: Expense[];
  purchases?: Purchase[];
  locale: LocaleSetting;
  settings?: StoreSettings;
  products: Product[];
  onAddSeller: (nom: string) => void;
  onDeleteSeller: (id: string) => void;
  onEditSale?: (updatedSale: Sale) => void;
  onDeleteSale?: (saleId: string) => void;
  onEditExpense?: (updatedExpense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
}

export const VendeursView: React.FC<VendeursViewProps> = ({
  sellers,
  sales,
  expenses,
  purchases = [],
  locale,
  settings,
  products,
  onAddSeller,
  onDeleteSeller,
  onEditSale,
  onDeleteSale,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [activeSellerModal, setActiveSellerModal] = useState<Seller | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "ventes" | "depenses">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Seller Activity Report / Receipt Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportSeller, setSelectedReportSeller] = useState<string>("all"); // 'all' or seller name
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "month" | "all">("today");
  const [reportMode, setReportMode] = useState<"ticket" | "a4">("ticket");

  const workspace = useWorkspace();
  const { user, profile } = useAuth();

  // ── Invitation State ──
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("seller");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspace.activeStore) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: {
          invited_email: inviteEmail.trim(),
          store_id: workspace.activeStore.id,
          role: inviteRole,
          invited_by_name: profile?.full_name || "Propriétaire",
          store_name: workspace.activeStore.name,
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInviteStatus({ type: "success", msg: `Invitation envoyée à ${inviteEmail} !` });
      setInviteEmail("");
      // Close modal after 2 seconds on success
      setTimeout(() => {
        setIsAddModalOpen(false);
        setInviteStatus(null);
      }, 2500);
    } catch (err: any) {
      setInviteStatus({ type: "error", msg: err.message || "Erreur lors de l'envoi" });
    } finally {
      setInviting(false);
    }
  };

  const grandTotalSales = sellers.reduce((acc, v) => acc + v.totalVentesMontant, 0);
  const grandTotalExpenses = sellers.reduce((acc, v) => acc + v.totalDepenses, 0);
  const grandTotalPocket = sellers.reduce((acc, v) => acc + v.soldeNetEnPoche, 0);

  // Today & Month strings
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Report filtered data
  const reportSales = useMemo(() => {
    return sales.filter((s) => {
      const matchSeller =
        selectedReportSeller === "all" ||
        s.vendeur.toLowerCase() === selectedReportSeller.toLowerCase();
      const matchPeriod =
        selectedPeriod === "today"
          ? s.date === todayStr
          : selectedPeriod === "month"
            ? s.date.startsWith(currentMonthStr)
            : true;
      return matchSeller && matchPeriod;
    });
  }, [sales, selectedReportSeller, selectedPeriod, todayStr, currentMonthStr]);

  const reportExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSeller =
        selectedReportSeller === "all" ||
        e.vendeur.toLowerCase() === selectedReportSeller.toLowerCase();
      const matchPeriod =
        selectedPeriod === "today"
          ? e.date === todayStr
          : selectedPeriod === "month"
            ? e.date.startsWith(currentMonthStr)
            : true;
      return matchSeller && matchPeriod;
    });
  }, [expenses, selectedReportSeller, selectedPeriod, todayStr, currentMonthStr]);

  // Report statistics summary
  const reportStats = useMemo(() => {
    const totalCA = reportSales.reduce((acc, s) => acc + s.totalVente, 0);
    const totalEncaisse = reportSales.reduce((acc, s) => acc + s.montantPaye, 0);
    const totalSoldeDu = reportSales.reduce((acc, s) => acc + s.soldeDu, 0);
    const totalMarge = reportSales.reduce((acc, s) => acc + s.margeTotale, 0);
    const totalDepenses = reportExpenses.reduce((acc, e) => acc + e.montant, 0);
    const soldeNetCaisse = totalEncaisse - totalDepenses;

    // Specific CA du jour and CA du mois for the chosen seller
    const sellerSalesAll = sales.filter(
      (s) =>
        selectedReportSeller === "all" ||
        s.vendeur.toLowerCase() === selectedReportSeller.toLowerCase(),
    );
    const caJour = sellerSalesAll
      .filter((s) => s.date === todayStr)
      .reduce((acc, s) => acc + s.totalVente, 0);
    const caMois = sellerSalesAll
      .filter((s) => s.date.startsWith(currentMonthStr))
      .reduce((acc, s) => acc + s.totalVente, 0);

    return {
      totalCA,
      totalEncaisse,
      totalSoldeDu,
      totalMarge,
      totalDepenses,
      soldeNetCaisse,
      caJour,
      caMois,
      countSales: reportSales.length,
      countExpenses: reportExpenses.length,
    };
  }, [reportSales, reportExpenses, sales, selectedReportSeller, todayStr, currentMonthStr]);

  // Active Seller Activity
  const activeSellerSales = useMemo(() => {
    if (!activeSellerModal) return [];
    return sales.filter((s) => s.vendeur.toLowerCase() === activeSellerModal.nom.toLowerCase());
  }, [activeSellerModal, sales]);

  const activeSellerExpenses = useMemo(() => {
    if (!activeSellerModal) return [];
    return expenses.filter((e) => e.vendeur.toLowerCase() === activeSellerModal.nom.toLowerCase());
  }, [activeSellerModal, expenses]);

  const totalMarginGenerated = useMemo(() => {
    return activeSellerSales.reduce((acc, s) => acc + s.margeTotale, 0);
  }, [activeSellerSales]);

  const totalSalesCount = useMemo(
    () => sellers.reduce((acc, v) => acc + v.totalVentesNombre, 0),
    [sellers],
  );

  // Recherche à l'intérieur de la fiche vendeur. Elle porte sur le
  // numéro affiché (V001, DEP004…) et non sur l'identifiant technique,
  // que personne ne saurait taper.
  const filteredSellerSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeSellerSales;
    return activeSellerSales.filter(
      (s) => s.designation.toLowerCase().includes(q) || s.numero.toLowerCase().includes(q),
    );
  }, [activeSellerSales, searchQuery]);

  const filteredSellerExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeSellerExpenses;
    return activeSellerExpenses.filter(
      (e) =>
        e.note.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.numero.toLowerCase().includes(q),
    );
  }, [activeSellerExpenses, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-5 w-5 text-muted-foreground" />}
        title="Vendeurs"
        subtitle="Ce que chaque vendeur a vendu, ce qu'il a dépensé, et ce qui lui reste en poche."
        actions={
          <>
            <button
              onClick={() => {
                setSelectedReportSeller("all");
                setIsReportModalOpen(true);
              }}
              className="app-btn-secondary"
              title="Imprimer ou télécharger le bilan d'activité vendeur"
            >
              <Printer className="h-4 w-4" />
              Relevé &amp; bilan
            </button>

            <button onClick={() => setIsAddModalOpen(true)} className="app-btn-primary">
              <Plus className="h-4 w-4" />
              Ajouter un vendeur
            </button>
          </>
        }
      />

      {/* Le solde net cumulé est le chiffre qui décide s'il faut aller
          récupérer de l'argent : il est posé seul, avant tout le reste. */}
      <div className="app-card flex items-center justify-between gap-4 border-l-2 border-l-primary p-4">
        <div className="min-w-0">
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Solde net en poche — tous vendeurs
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatCurrency(grandTotalPocket)}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {sellers.length} vendeur{sellers.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Les deux composantes de ce solde, en second rang. */}
      <div className="app-statbar grid-cols-1 sm:grid-cols-2">
        <StatCol
          label="Ventes réalisées"
          value={formatCurrency(grandTotalSales)}
          hint={`${totalSalesCount} vente${totalSalesCount > 1 ? "s" : ""}`}
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <StatCol
          label="Dépenses & retraits"
          value={formatCurrency(grandTotalExpenses)}
          hint="Sorties de caisse vendeur"
          icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Une ligne par vendeur : le nom à gauche, son activité résumée
          en dessous, le solde en poche à droite. Le clic ouvre la fiche
          détaillée plutôt que d'étaler l'information en colonnes. */}
      <div className="app-card overflow-hidden">
        {sellers.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Aucun vendeur pour l'instant. Invitez votre premier vendeur pour suivre son activité.
            </p>
          </div>
        ) : (
          <div className="app-list">
            {sellers.map((v) => (
              <div key={v.id} className="app-list-row gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-medium text-muted-foreground">
                  {v.nom.charAt(0).toUpperCase()}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveSellerModal(v)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="app-list-primary block">{v.nom}</span>
                    <span className="app-list-secondary block">
                      {[
                        `${v.totalVentesNombre} vente${v.totalVentesNombre > 1 ? "s" : ""}`,
                        `${formatCurrency(v.totalVentesMontant)} vendus`,
                        v.totalDepenses > 0
                          ? `${formatCurrency(v.totalDepenses)} de dépenses`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="text-right">
                      <span className="block font-mono text-base font-medium tabular-nums text-foreground">
                        {formatCurrency(v.soldeNetEnPoche)}
                      </span>
                      <span className="app-list-secondary block">en poche</span>
                    </span>
                    {v.statut === "Inactif" && (
                      <span className="app-badge app-badge-neutral">Inactif</span>
                    )}
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/50 sm:block" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Voulez-vous vraiment supprimer le vendeur "${v.nom}" ?`)) {
                      onDeleteSeller(v.id);
                    }
                  }}
                  className="app-btn-icon h-9 w-9 shrink-0"
                  title="Supprimer ce vendeur"
                  aria-label={`Supprimer ${v.nom}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Invitation d'un vendeur ── */}
      <Modal
        open={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setInviteStatus(null);
        }}
        size="md"
        icon={<Plus className="h-4 w-4" />}
        title="Inviter un vendeur"
        description="Une invitation sécurisée sera envoyée par e-mail. Le vendeur créera lui-même son compte."
      >
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Adresse e-mail *
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="vendeur@exemple.com"
              className="app-field"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Rôle</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="app-field"
            >
              <option value="seller">Vendeur — peut enregistrer des ventes</option>
              <option value="collaborator">Collaborateur — accès étendu</option>
            </select>
          </div>

          {inviteStatus && (
            <div
              className={`rounded-xl border px-3 py-2.5 text-sm ${
                inviteStatus.type === "success"
                  ? "border-success-border bg-success-soft t-success"
                  : "border-danger-border bg-danger-soft t-danger"
              }`}
            >
              {inviteStatus.msg}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setInviteStatus(null);
              }}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="app-btn-primary"
            >
              {inviting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Envoi...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Envoyer l'invitation
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Fiche vendeur ──
          Les deux tableaux à sept et cinq colonnes ont laissé place à
          deux listes : la vente ou la dépense se lit d'un coup d'œil, et
          le reste des champs s'ouvre au clic dans un panneau de détails. */}
      {activeSellerModal && (
        <Modal
          open
          onClose={() => setActiveSellerModal(null)}
          size="3xl"
          icon={<Users className="h-4 w-4" />}
          title={activeSellerModal.nom}
          description="Journal des ventes et des dépenses de ce vendeur."
          bodyClassName="space-y-5"
          headerAside={
            <button
              onClick={() => {
                setSelectedReportSeller(activeSellerModal.nom);
                setIsReportModalOpen(true);
              }}
              className="app-btn-secondary h-9 px-3 text-xs"
              style={{ minHeight: "36px" }}
              title="Générer le relevé d'activité de ce vendeur"
            >
              <Printer className="h-3.5 w-3.5" />
              Relevé
            </button>
          }
        >
          {/* Indicateurs du vendeur, dans le même bandeau que les listes. */}
          <div className="app-statbar grid-cols-2 sm:grid-cols-4">
            <StatCol
              label="Ventes"
              value={formatCurrency(activeSellerModal.totalVentesMontant)}
              hint={`${activeSellerSales.length} opération${activeSellerSales.length > 1 ? "s" : ""}`}
            />
            <StatCol
              label="Marge générée"
              value={formatCurrency(totalMarginGenerated)}
              hint="Bénéfice magasin"
            />
            <StatCol
              label="Dépenses"
              value={formatCurrency(activeSellerModal.totalDepenses)}
              hint={`${activeSellerExpenses.length} retrait${activeSellerExpenses.length > 1 ? "s" : ""}`}
            />
            <StatCol
              label="Solde en poche"
              value={formatCurrency(activeSellerModal.soldeNetEnPoche)}
              hint="En espèces"
            />
          </div>

          {/* Filtres */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  {
                    key: "all",
                    label: "Tout",
                    count: activeSellerSales.length + activeSellerExpenses.length,
                  },
                  { key: "ventes", label: "Ventes", count: activeSellerSales.length },
                  { key: "depenses", label: "Dépenses", count: activeSellerExpenses.length },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`app-chip ${activeTab === t.key ? "app-chip-active" : ""}`}
                >
                  {t.label}
                  <span className="app-chip-count">{t.count}</span>
                </button>
              ))}
            </div>

            <div className="relative sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="app-field-sm pl-9"
              />
            </div>
          </div>

          {/* Ventes */}
          {(activeTab === "all" || activeTab === "ventes") && (
            <section className="space-y-2">
              <h4 className="app-section-title">
                <DollarSign className="h-4 w-4" />
                Ventes
              </h4>

              <div className="app-card overflow-hidden">
                <DataList
                  emptyLabel="Aucune vente enregistrée pour ce vendeur."
                  items={filteredSellerSales.map((s) => ({
                    id: s.id,
                    primary: getSaleLabel(s, products),
                    meta: [
                      formatDateLocale(s.date, locale),
                      `×${s.quantite}`,
                      formatCurrency(s.prixVenteUnit),
                    ],
                    amount: formatCurrency(s.totalVente),
                    amountHint: (
                      <span className="t-success">+{formatCurrency(s.margeTotale)}</span>
                    ),
                    detailTitle: getSaleLabel(s, products),
                    detailSubtitle: `Vente n° ${s.numero}`,
                    details: [
                      { label: "Date", value: formatDateLocale(s.date, locale) },
                      { label: "Quantité", value: `${s.quantite}` },
                      { label: "Prix unitaire", value: formatCurrency(s.prixVenteUnit) },
                      { label: "Total", value: formatCurrency(s.totalVente) },
                      {
                        label: "Marge",
                        value: (
                          <span className="t-success">+{formatCurrency(s.margeTotale)}</span>
                        ),
                      },
                      { label: "Client", value: s.clientCredit || "", hideIfEmpty: true },
                      {
                        label: "Reste dû",
                        value: s.soldeDu > 0 ? formatCurrency(s.soldeDu) : "",
                        hideIfEmpty: true,
                      },
                    ],
                    actions: (
                      <>
                        {onEditSale && (
                          <button
                            onClick={() => onEditSale(s)}
                            className="app-btn-secondary sm:flex-none"
                          >
                            <Edit3 className="h-4 w-4" />
                            Modifier
                          </button>
                        )}
                        {onDeleteSale && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Supprimer la vente ${s.numero} (${getSaleLabel(s, products)}) ?`,
                                )
                              ) {
                                onDeleteSale(s.id);
                              }
                            }}
                            className="app-btn-danger sm:flex-none"
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </button>
                        )}
                      </>
                    ),
                  }))}
                />
              </div>
            </section>
          )}

          {/* Dépenses & retraits */}
          {(activeTab === "all" || activeTab === "depenses") && (
            <section className="space-y-2">
              <h4 className="app-section-title">
                <ArrowRightLeft className="h-4 w-4" />
                Dépenses &amp; retraits
              </h4>

              <div className="app-card overflow-hidden">
                <DataList
                  emptyLabel="Aucune dépense enregistrée pour ce vendeur."
                  items={filteredSellerExpenses.map((e) => ({
                    id: e.id,
                    primary: e.type,
                    meta: [formatDateLocale(e.date, locale), e.note || null],
                    amount: `- ${formatCurrency(e.montant)}`,
                    detailTitle: e.type,
                    detailSubtitle: `Dépense n° ${e.numero}`,
                    details: [
                      { label: "Date", value: formatDateLocale(e.date, locale) },
                      { label: "Type", value: e.type },
                      { label: "Montant", value: formatCurrency(e.montant) },
                      { label: "Note", value: e.note || "", hideIfEmpty: true },
                    ],
                    actions: (
                      <>
                        {onEditExpense && (
                          <button
                            onClick={() => onEditExpense(e)}
                            className="app-btn-secondary sm:flex-none"
                          >
                            <Edit3 className="h-4 w-4" />
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
                            className="app-btn-danger sm:flex-none"
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </button>
                        )}
                      </>
                    ),
                  }))}
                />
              </div>
            </section>
          )}
        </Modal>
      )}

      {/* ── Relevé & bilan d'activité ──
          Le document imprimable est conservé tel quel : ses tableaux
          sont ceux du papier, pas de l'écran. */}
      {isReportModalOpen && (
        <Modal
          open
          onClose={() => setIsReportModalOpen(false)}
          size="3xl"
          icon={<Printer className="h-4 w-4" />}
          title="Relevé & bilan d'activité"
          description={
            selectedReportSeller === "all" ? "Tous les vendeurs cumulés" : selectedReportSeller
          }
          bodyClassName="space-y-4"
          headerAside={
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
              <button
                onClick={() => setReportMode("ticket")}
                aria-pressed={reportMode === "ticket"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  reportMode === "ticket"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                Ticket
              </button>
              <button
                onClick={() => setReportMode("a4")}
                aria-pressed={reportMode === "a4"}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  reportMode === "a4"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Bilan A4
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
RELEVÉ D'ACTIVITÉ VENDEUR (${selectedPeriod === "today" ? "Aujourd'hui" : selectedPeriod === "month" ? "Ce Mois-ci" : "Tout l'historique"})
VENDEUR: ${selectedReportSeller === "all" ? "TOUS LES VENDEURS CUMULÉS" : selectedReportSeller.toUpperCase()}
Date de génération: ${new Date().toLocaleString()}
------------------------------------------------
CA DU JOUR (${todayStr}): ${formatCurrency(reportStats.caJour)}
CA DU MOIS (${currentMonthStr}): ${formatCurrency(reportStats.caMois)}
------------------------------------------------
TOTAL VENTES PÉRIODE: ${formatCurrency(reportStats.totalCA)} (${reportStats.countSales} ventes)
ENCAISSEMENTS RÉELS (Espèces): ${formatCurrency(reportStats.totalEncaisse)}
CRÉDITS ACCORDÉS (A payer): ${formatCurrency(reportStats.totalSoldeDu)}
DÉPENSES / RETRAITS VENDEUR: -${formatCurrency(reportStats.totalDepenses)}
MARGE BRUTE GÉNÉRÉE: +${formatCurrency(reportStats.totalMarge)}
------------------------------------------------
SOLDE NET EN CAISSE VENDEUR: ${formatCurrency(reportStats.soldeNetCaisse)}
================================================
                  `.trim();

                  const element = document.createElement("a");
                  const file = new Blob([textContent], { type: "text/plain" });
                  element.href = URL.createObjectURL(file);
                  element.download = `Releve_Activite_${selectedReportSeller}_${selectedPeriod}.txt`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="app-btn-secondary"
                title="Télécharger un résumé au format texte"
              >
                <Download className="h-4 w-4" />
                Télécharger (.txt)
              </button>
            </>
          }
        >
            {/* Portée du document — masqué à l'impression. */}
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
                  <option value="all">Tous les vendeurs (cumulé)</option>
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
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="app-field-sm"
                >
                  <option value="today">Aujourd'hui ({todayStr})</option>
                  <option value="month">Ce mois-ci ({currentMonthStr})</option>
                  <option value="all">Historique complet</option>
                </select>
              </div>
            </div>

            <div className="receipt-viewport flex items-start justify-start overflow-x-auto rounded-xl border border-border bg-background p-4">
              {reportMode === "ticket" ? (
                /* Ticket Thermal Receipt Format */
                <div className="printable-receipt printable-ticket mx-auto min-w-0 bg-amber-50 text-slate-900 w-full max-w-[360px] p-6 rounded-lg shadow-lg font-mono text-xs leading-relaxed space-y-4 border border-amber-200">
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
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Header Title & Metadata */}
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-xs uppercase bg-amber-200 py-0.5 rounded text-amber-950">
                      RELEVÉ D'ACTIVITÉ VENDEUR
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-800">
                      VENDEUR :{" "}
                      <span className="font-bold uppercase text-slate-950">
                        {selectedReportSeller === "all"
                          ? "TOUS LES VENDEURS"
                          : selectedReportSeller}
                      </span>
                    </p>
                    <p className="text-[9px] text-slate-600">
                      Période:{" "}
                      {selectedPeriod === "today"
                        ? "Aujourd'hui (" + todayStr + ")"
                        : selectedPeriod === "month"
                          ? "Mois de " + currentMonthStr
                          : "Historique Complet"}
                    </p>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* KPI Highlights for Seller */}
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between bg-amber-100 p-1 rounded font-bold text-slate-900">
                      <span>CA DU JOUR ({todayStr}) :</span>
                      <span>{formatCurrency(reportStats.caJour)}</span>
                    </div>

                    <div className="flex justify-between bg-amber-100 p-1 rounded font-bold text-slate-900">
                      <span>CA DU MOIS ({currentMonthStr}) :</span>
                      <span>{formatCurrency(reportStats.caMois)}</span>
                    </div>

                    <div className="border-b border-slate-300 my-1"></div>

                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Ventes sélectionnées :</span>
                      <span className="font-bold">
                        {formatCurrency(reportStats.totalCA)} ({reportStats.countSales} vtes)
                      </span>
                    </div>

                    <div className="flex justify-between text-emerald-800">
                      <span>Total Encaissé (Espèces) :</span>
                      <span className="font-bold">{formatCurrency(reportStats.totalEncaisse)}</span>
                    </div>

                    {reportStats.totalSoldeDu > 0 && (
                      <div className="flex justify-between text-amber-900 font-semibold">
                        <span>Crédits / Solde Dû :</span>
                        <span>{formatCurrency(reportStats.totalSoldeDu)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-rose-800 font-semibold">
                      <span>Dépenses / Retraits :</span>
                      <span>- {formatCurrency(reportStats.totalDepenses)}</span>
                    </div>

                    <div className="flex justify-between text-emerald-900 font-bold border-t border-slate-400 pt-1 text-xs">
                      <span>SOLDE NET EN POCHE :</span>
                      <span>{formatCurrency(reportStats.soldeNetCaisse)}</span>
                    </div>
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Itemized Transactions List */}
                  <div className="space-y-2">
                    <p className="font-bold text-[10px] uppercase text-slate-700">
                      Détail des opérations ({reportSales.length} ventes) :
                    </p>

                    {reportSales.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        Aucune vente pour cette période.
                      </p>
                    ) : (
                      <table className="w-full text-[9px] text-left">
                        <thead>
                          <tr className="border-b border-slate-300 font-bold uppercase">
                            <th className="py-1">Art.</th>
                            <th className="py-1 text-center">Qté</th>
                            <th className="py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reportSales.map((s) => (
                            <tr key={s.id}>
                              <td className="py-1 font-medium pr-1">
                                {s.designation}
                                {selectedReportSeller === "all" && (
                                  <span className="block text-[8px] text-muted-foreground">
                                    By: {s.vendeur}
                                  </span>
                                )}
                              </td>
                              <td className="py-1 text-center font-bold">{s.quantite}</td>
                              <td className="py-1 text-right font-bold">
                                {formatCurrency(s.totalVente)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="border-b border-dashed border-slate-400 my-2"></div>

                  {/* Footer */}
                  <div className="text-center text-[9px] text-slate-600 italic">
                    Émis le {new Date().toLocaleString()} - GESTIONS STOCK
                  </div>
                </div>
              ) : (
                /* Fiche Bilan A4 Format */
                <div className="printable-receipt printable-invoice mx-auto min-w-0 bg-white text-slate-900 w-full max-w-xl p-8 rounded-lg shadow-xl font-sans text-xs space-y-6 border border-slate-200">
                  {/* Top Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
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
                        {settings?.subtitle || "Gestion unifiée Stock & Vendeurs"}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        {settings?.address || "Lot IVG 124, Antananarivo 101"}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        Tél: {settings?.phone || "+261 34 12 345 67"} | Email:{" "}
                        {settings?.email || "contact@balsama-auto.mg"}
                      </p>
                    </div>

                    <div className="text-right space-y-2">
                      <div className="inline-block rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                        BILAN D'ACTIVITÉ VENDEUR
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-0.5">
                        <p>
                          <span className="font-semibold text-slate-800">Date d'édition :</span>{" "}
                          {new Date().toLocaleDateString()}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Heure :</span>{" "}
                          {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Target Seller & Period Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                        Vendeur Concerne :
                      </span>
                      <span className="text-base font-black text-slate-900">
                        {selectedReportSeller === "all"
                          ? "TOUS LES VENDEURS (CUMULÉ)"
                          : selectedReportSeller}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
                        Période Observée :
                      </span>
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 font-bold rounded-lg text-xs">
                        {selectedPeriod === "today"
                          ? "Aujourd'hui (" + todayStr + ")"
                          : selectedPeriod === "month"
                            ? "Mois de " + currentMonthStr
                            : "Tout l'historique"}
                      </span>
                    </div>
                  </div>

                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                      <span className="text-[9px] uppercase font-bold text-blue-600 block">
                        CA du Jour ({todayStr})
                      </span>
                      <span className="text-sm font-black text-blue-900 font-mono">
                        {formatCurrency(reportStats.caJour)}
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                      <span className="text-[9px] uppercase font-bold text-blue-600 block">
                        CA du Mois ({currentMonthStr})
                      </span>
                      <span className="text-sm font-black text-blue-900 font-mono">
                        {formatCurrency(reportStats.caMois)}
                      </span>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                      <span className="text-[9px] uppercase font-bold text-rose-600 block">
                        Dépenses / Retraits
                      </span>
                      <span className="text-sm font-black text-rose-900 font-mono">
                        - {formatCurrency(reportStats.totalDepenses)}
                      </span>
                    </div>

                    <div className="bg-emerald-100 border border-emerald-300 p-3 rounded-xl">
                      <span className="text-[9px] uppercase font-bold text-emerald-800 block">
                        Solde Net en Poche
                      </span>
                      <span className="text-sm font-black text-emerald-950 font-mono">
                        {formatCurrency(reportStats.soldeNetCaisse)}
                      </span>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Journal des Ventes ({reportSales.length} opérations)
                    </h4>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-y border-slate-300">
                          <th className="p-2">Date</th>
                          <th className="p-2">Article</th>
                          <th className="p-2 text-center">Qté</th>
                          <th className="p-2 text-right">P.U</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Encaissé</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {reportSales.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-3 text-center text-muted-foreground italic"
                            >
                              Aucune vente trouvée pour cette sélection.
                            </td>
                          </tr>
                        ) : (
                          reportSales.map((s) => (
                            <tr key={s.id}>
                              <td className="p-2 font-mono text-muted-foreground">{s.date}</td>
                              <td className="p-2 font-bold text-slate-900">
                                {s.designation}
                                {selectedReportSeller === "all" && (
                                  <span className="block text-[10px] text-muted-foreground font-normal">
                                    Vendeur: {s.vendeur}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center font-bold">{s.quantite}</td>
                              <td className="p-2 text-right">{formatCurrency(s.prixVenteUnit)}</td>
                              <td className="p-2 text-right font-bold text-slate-900">
                                {formatCurrency(s.totalVente)}
                              </td>
                              <td className="p-2 text-right font-bold text-emerald-700">
                                {formatCurrency(s.montantPaye)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-8 text-center text-[10px] text-slate-600">
                    <div className="space-y-12">
                      <p className="font-bold uppercase tracking-wider">Signature du Vendeur</p>
                      <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
                    </div>
                    <div className="space-y-12">
                      <p className="font-bold uppercase tracking-wider">Cachet & Direction</p>
                      <div className="border-b border-dashed border-slate-300 w-32 mx-auto"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </Modal>
      )}
    </div>
  );
};