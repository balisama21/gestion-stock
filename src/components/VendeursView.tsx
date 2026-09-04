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
  Wallet,
  TrendingUp,
  History,
  Trash2,
  Edit3,
  Search,
  Filter,
  Eye,
  X,
  Zap,
  ShoppingBag,
  Printer,
  FileText,
  Receipt,
  Download,
  Calendar,
  Building,
} from "lucide-react";
import { formatCurrency, formatDateLocale, getSaleLabel } from "../utils/formulas";
import { MobileCardList } from "./shared/MobileCardList";

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

  return (
    <div className="space-y-6">
      {/* ── Invite Modal ── */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Inviter un Vendeur</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Une invitation sécurisée sera envoyée par e-mail
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setInviteStatus(null);
                }}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Adresse e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="vendeur@exemple.com"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Rôle</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                >
                  <option value="seller">Vendeur — Peut enregistrer des ventes</option>
                  <option value="collaborator">Collaborateur — Accès étendu</option>
                </select>
              </div>

              {inviteStatus && (
                <div
                  className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    inviteStatus.type === "success"
                      ? "bg-emerald-500/15 t-success border border-emerald-500/30"
                      : "bg-rose-500/15 t-danger border border-rose-500/30"
                  }`}
                >
                  {inviteStatus.type === "success" ? "✅" : "❌"} {inviteStatus.msg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setInviteStatus(null);
                  }}
                  className="flex-1 px-4 py-3 bg-muted border border-border rounded-xl text-foreground text-sm font-semibold hover:bg-accent transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Envoyer l'invitation
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs t-info">
                💡 Le vendeur recevra un e-mail avec un lien sécurisé pour créer son compte et
                rejoindre votre boutique. Il n'a pas besoin de code d'activation payant.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 t-success" />
            Vendeurs
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Suivez l'activité de chaque vendeur : ventes, dépenses et solde en poche.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedReportSeller("all");
              setIsReportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-accent t-success border border-emerald-500/30 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            title="Imprimer ou télécharger le bilan d'activité vendeur"
          >
            <Printer className="w-4 h-4 t-success" />
            Relevé & Bilan Activité
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un Vendeur
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-2xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Total Ventes Tous Vendeurs
          </div>
          <div className="text-2xl font-bold font-mono t-info mt-1">
            {formatCurrency(grandTotalSales)}
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase">
            Total Dépenses Vendeurs
          </div>
          <div className="text-2xl font-bold font-mono t-danger mt-1">
            {formatCurrency(grandTotalExpenses)}
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl bg-success-soft border-success-border">
          <div className="text-xs font-semibold t-success uppercase">
            Solde Net Cumulé ("Dans les poches")
          </div>
          <div className="text-2xl font-bold font-mono t-success mt-1">
            {formatCurrency(grandTotalPocket)}
          </div>
        </div>
      </div>

      {/* Sellers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sellers.map((v) => {
          const sellerSales = sales.filter((s) => s.vendeur === v.nom);
          const sellerExpenses = expenses.filter((e) => e.vendeur === v.nom);

          return (
            <div
              key={v.id}
              className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:border-muted-foreground/20 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold t-success text-base shadow-inner">
                      {v.nom.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{v.nom}</h3>
                      <span className="text-[10px] t-success font-medium">
                        ● Vendeur Actif
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (
                        window.confirm(`Voulez-vous vraiment supprimer le vendeur "${v.nom}" ?`)
                      ) {
                        onDeleteSeller(v.id);
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:t-danger bg-muted hover:bg-accent rounded-lg transition-colors"
                    title="Supprimer ce vendeur"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/60">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 t-info" />
                      Ventes Réalisées :
                    </span>
                    <span className="font-bold font-mono t-info">
                      {formatCurrency(v.totalVentesMontant)} ({v.totalVentesNombre} ventes)
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-border/60">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 t-danger" />
                      Dépenses / Retraits :
                    </span>
                    <span className="font-bold font-mono t-danger">
                      - {formatCurrency(v.totalDepenses)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 bg-muted/60 px-3 rounded-xl border border-muted-foreground/20">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 t-success" />
                      Solde Net en Poche :
                    </span>
                    <span className="font-bold font-mono text-base t-success">
                      {formatCurrency(v.soldeNetEnPoche)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setActiveSellerModal(v)}
                  className="flex-1 py-2 px-3 bg-muted hover:bg-accent t-info border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5 t-info" />
                  Activités
                </button>
                <button
                  onClick={() => {
                    setSelectedReportSeller(v.nom);
                    setIsReportModalOpen(true);
                  }}
                  className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 t-success border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-sm"
                  title="Imprimer le relevé/bilan d'activité de ce vendeur"
                >
                  <Printer className="w-3.5 h-3.5 t-success" />
                  Relevé
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seller Drill-down Modal */}
      {activeSellerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-4xl p-6 shadow-2xl text-foreground space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold t-success text-xl shadow-inner">
                  {activeSellerModal.nom.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    Fiche & Activités de{" "}
                    <span className="t-success">{activeSellerModal.nom}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Journal détaillé de toutes les ventes et dépenses associées à ce vendeur.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedReportSeller(activeSellerModal.nom);
                    setIsReportModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                  title="Générer et imprimer le bilan/reçu d'activité pour ce vendeur"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer Bilan / Relevé
                </button>

                <button
                  onClick={() => setActiveSellerModal(null)}
                  className="p-2 text-muted-foreground hover:text-foreground bg-muted rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Seller KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Ventes Totales
                </span>
                <span className="text-base font-bold font-mono t-info">
                  {formatCurrency(activeSellerModal.totalVentesMontant)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({activeSellerSales.length} opérations)
                </span>
              </div>

              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Marge Totale Générée
                </span>
                <span className="text-base font-bold font-mono t-success">
                  +{formatCurrency(totalMarginGenerated)}
                </span>
                <span className="text-[10px] text-muted-foreground block">Bénéfice magasin</span>
              </div>

              <div className="bg-muted/80 p-3 rounded-xl border border-muted-foreground/20">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Dépenses & Retraits
                </span>
                <span className="text-base font-bold font-mono t-danger">
                  - {formatCurrency(activeSellerModal.totalDepenses)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  ({activeSellerExpenses.length} retraits)
                </span>
              </div>

              <div className="bg-success-soft p-3 rounded-xl border border-success-border">
                <span className="t-success block text-[10px] uppercase font-semibold">
                  Solde Net en Poche
                </span>
                <span className="text-lg font-bold font-mono t-success">
                  {formatCurrency(activeSellerModal.soldeNetEnPoche)}
                </span>
                <span className="text-[10px] t-success block">En espèces</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Toutes Activités
                </button>
                <button
                  onClick={() => setActiveTab("ventes")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    activeTab === "ventes"
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Ventes ({activeSellerSales.length})
                </button>
                <button
                  onClick={() => setActiveTab("depenses")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    activeTab === "depenses"
                      ? "bg-rose-600 text-white font-semibold"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dépenses ({activeSellerExpenses.length})
                </button>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-muted border border-muted-foreground/20 rounded-lg pl-8 pr-3 py-1 text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sales Table section */}
            {(activeTab === "all" || activeTab === "ventes") && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold t-info uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 t-info" />
                  Ventes de {activeSellerModal.nom}
                </h4>

                {/* Liste mobile — remplace le tableau sous 1024px */}
                <div className="lg:hidden">
                  <MobileCardList
                    emptyLabel="Aucune vente enregistrée pour ce vendeur."
                    items={activeSellerSales
                      .filter(
                        (s) =>
                          !searchQuery ||
                          s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchQuery.toLowerCase()),
                      )
                      .map((s) => ({
                        id: s.id,
                        title: getSaleLabel(s, products),
                        subtitle: `${formatDateLocale(s.date, locale)} · ×${s.quantite}`,
                        amount: formatCurrency(s.totalVente),
                        fields: [
                          { label: "Date", value: formatDateLocale(s.date, locale) },
                          { label: "Quantité", value: `${s.quantite}` },
                          { label: "Prix unitaire", value: formatCurrency(s.prixVenteUnit) },
                          {
                            label: "Marge",
                            value: <span className="t-success">+{formatCurrency(s.margeTotale)}</span>,
                          },
                        ],
                        actions: (
                          <>
                            {onEditSale && (
                              <button
                                onClick={() => onEditSale(s)}
                                className="app-btn-secondary flex-1 text-xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Modifier
                              </button>
                            )}
                            {onDeleteSale && (
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Supprimer la vente ${s.id} (${getSaleLabel(s, products)}) ?`,
                                    )
                                  ) {
                                    onDeleteSale(s.id);
                                  }
                                }}
                                className="app-btn-danger flex-1 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
                              </button>
                            )}
                          </>
                        ),
                      }))}
                  />
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-border bg-background lg:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-[10px] font-semibold uppercase text-muted-foreground">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Produit</th>
                        <th className="p-2.5 text-right">Qté</th>
                        <th className="p-2.5 text-right">Prix unitaire</th>
                        <th className="p-2.5 text-right">Total</th>
                        <th className="p-2.5 text-right">Marge</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {activeSellerSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-muted-foreground italic">
                            Aucune vente enregistrée pour ce vendeur.
                          </td>
                        </tr>
                      ) : (
                        activeSellerSales
                          .filter(
                            (s) =>
                              !searchQuery ||
                              s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              s.id.toLowerCase().includes(searchQuery.toLowerCase()),
                          )
                          .map((s) => (
                            <tr key={s.id} className="hover:bg-muted/40">
                              <td className="p-2.5 font-mono text-muted-foreground">
                                {formatDateLocale(s.date, locale)}
                              </td>
                              <td className="p-2.5 font-bold text-foreground">{getSaleLabel(s, products)}</td>
                              <td className="p-2.5 text-right font-mono font-semibold">
                                {s.quantite}
                              </td>
                              <td className="p-2.5 text-right font-mono t-info">
                                {formatCurrency(s.prixVenteUnit)}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-foreground">
                                {formatCurrency(s.totalVente)}
                              </td>
                              <td className="p-2.5 text-right font-mono t-success">
                                +{formatCurrency(s.margeTotale)}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {onEditSale && (
                                    <button
                                      onClick={() => onEditSale(s)}
                                      className="p-1 text-muted-foreground hover:t-info bg-muted hover:bg-accent rounded transition-colors"
                                      title="Modifier"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onDeleteSale && (
                                    <button
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Supprimer la vente ${s.id} (${getSaleLabel(s, products)}) ?`,
                                          )
                                        ) {
                                          onDeleteSale(s.id);
                                        }
                                      }}
                                      className="p-1 text-muted-foreground hover:t-danger bg-muted hover:bg-accent rounded transition-colors"
                                      title="Supprimer"
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
            )}

            {/* Expenses Table section */}
            {(activeTab === "all" || activeTab === "depenses") && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold t-danger uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 t-danger" />
                  Dépenses & Retraits de {activeSellerModal.nom}
                </h4>

                {/* Liste mobile — remplace le tableau sous 1024px */}
                <div className="lg:hidden">
                  <MobileCardList
                    emptyLabel="Aucune dépense enregistrée pour ce vendeur."
                    items={activeSellerExpenses
                      .filter(
                        (e) =>
                          !searchQuery ||
                          e.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.id.toLowerCase().includes(searchQuery.toLowerCase()),
                      )
                      .map((e) => ({
                        id: e.id,
                        title: e.type,
                        subtitle: formatDateLocale(e.date, locale),
                        amount: `- ${formatCurrency(e.montant)}`,
                        amountTone: "danger" as const,
                        fields: [
                          { label: "Date", value: formatDateLocale(e.date, locale) },
                          { label: "Type", value: e.type },
                          { label: "Note", value: e.note || "Aucune note" },
                        ],
                        actions: (
                          <>
                            {onEditExpense && (
                              <button
                                onClick={() => onEditExpense(e)}
                                className="app-btn-secondary flex-1 text-xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
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
                                className="app-btn-danger flex-1 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Supprimer
                              </button>
                            )}
                          </>
                        ),
                      }))}
                  />
                </div>

                <div className="hidden overflow-x-auto rounded-xl border border-border bg-background lg:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-[10px] font-semibold uppercase text-muted-foreground">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Note</th>
                        <th className="p-2.5 text-right">Montant</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {activeSellerExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                            Aucune dépense enregistrée pour ce vendeur.
                          </td>
                        </tr>
                      ) : (
                        activeSellerExpenses
                          .filter(
                            (e) =>
                              !searchQuery ||
                              e.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              e.id.toLowerCase().includes(searchQuery.toLowerCase()),
                          )
                          .map((e) => (
                            <tr key={e.id} className="hover:bg-muted/40">
                              <td className="p-2.5 font-mono text-muted-foreground">
                                {formatDateLocale(e.date, locale)}
                              </td>
                              <td className="p-2.5">
                                <span className="app-badge app-badge-warning">{e.type}</span>
                              </td>
                              <td className="p-2.5 text-muted-foreground italic">
                                {e.note || "Aucune note"}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold t-danger">
                                - {formatCurrency(e.montant)}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {onEditExpense && (
                                    <button
                                      onClick={() => onEditExpense(e)}
                                      className="p-1 text-muted-foreground hover:t-info bg-muted hover:bg-accent rounded transition-colors"
                                      title="Modifier"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onDeleteExpense && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Supprimer la dépense ${e.numero} ?`)) {
                                          onDeleteExpense(e.id);
                                        }
                                      }}
                                      className="p-1 text-muted-foreground hover:t-danger bg-muted hover:bg-accent rounded transition-colors"
                                      title="Supprimer"
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
            )}
          </div>
        </div>
      )}

      {/* Seller Activity Report & Receipt Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-muted-foreground/20 rounded-2xl w-full max-w-3xl p-6 shadow-2xl text-foreground space-y-6 my-8">
            {/* Modal Controls Bar (hidden during printing) */}
            <div className="space-y-4 border-b border-border pb-4 no-print">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 t-success" />
                  <h3 className="text-base font-bold text-foreground">
                    Bilan & Relevé d'Activité Vendeur
                  </h3>
                </div>

                {/* Print / Download / Close Actions */}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-foreground border border-muted-foreground/20 rounded-xl text-xs font-semibold transition-colors"
                    title="Télécharger résumé texte"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger (.TXT)
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filters Bar: Select Seller, Select Period, Select Format */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-background p-3 rounded-xl border border-border text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Vendeur Sélectionné :
                  </label>
                  <select
                    value={selectedReportSeller}
                    onChange={(e) => setSelectedReportSeller(e.target.value)}
                    className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="all">Tous les Vendeurs (Cumulé)</option>
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
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="w-full bg-muted border border-muted-foreground/20 text-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="today">Aujourd'hui ({todayStr})</option>
                    <option value="month">Ce Mois-ci ({currentMonthStr})</option>
                    <option value="all">Historique Complet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                    Format du Document :
                  </label>
                  <div className="flex items-center bg-muted p-0.5 rounded-lg border border-muted-foreground/20">
                    <button
                      onClick={() => setReportMode("ticket")}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                        reportMode === "ticket"
                          ? "bg-emerald-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Receipt className="w-3 h-3" />
                      Ticket Caisse
                    </button>
                    <button
                      onClick={() => setReportMode("a4")}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 ${
                        reportMode === "a4"
                          ? "bg-blue-600 text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      Bilan A4
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Container Rendering */}
            <div className="receipt-viewport flex justify-center bg-background p-4 rounded-xl border border-border max-h-[60vh] overflow-y-auto">
              {reportMode === "ticket" ? (
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
                      <div className="inline-block bg-card text-white px-4 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider">
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
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
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
          </div>
        </div>
      )}
    </div>
  );
};