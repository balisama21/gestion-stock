import React, { useState, useMemo } from "react";
import {
  ActiveTab,
  CapitalSummary,
  StoreSettings,
  Sale,
  Purchase,
  Expense,
  CapitalApport,
  Product,
} from "../types";
import {
  AlertTriangle,
  Wallet,
  Store,
  ArrowRightLeft,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  History,
  Users,
  Settings,
  Menu,
  X,
  CalendarRange,
  Bell,
  Sun,
  Moon,
  CheckCheck,
  ChevronRight,
  Info,
  ChevronDown,
  Building,
  User as UserIcon,
  CreditCard,
  ShoppingBag,
  Plus,
  Copy,
  KeyRound,
} from "lucide-react";
import { formatCurrency, getProductLabel } from "../utils/formulas";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { APP_NAME } from "../lib/appConfig";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  tresorerie: number;
  seuilAlerte: number;
  lowStockCount: number;
  capital: CapitalSummary;
  settings: StoreSettings;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  sales?: Sale[];
  purchases?: Purchase[];
  expenses?: Expense[];
  apports?: CapitalApport[];
  products?: Product[];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  tresorerie,
  seuilAlerte,
  lowStockCount,
  settings,
  theme,
  setTheme,
  sales = [],
  purchases = [],
  expenses = [],
  apports = [],
  products = [],
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [creatingStore, setCreatingStore] = useState(false);
  const [createStoreError, setCreateStoreError] = useState<string | null>(null);

  const [showCopyStoreModal, setShowCopyStoreModal] = useState(false);
  const [copyStoreName, setCopyStoreName] = useState("");
  const [copyingStore, setCopyingStore] = useState(false);
  const [copyStoreError, setCopyStoreError] = useState<string | null>(null);

  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joiningWithCode, setJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joiningWithCode) return;
    setJoiningWithCode(true);
    setJoinCodeError(null);
    const { data, error } = await supabase.rpc("accept_invitation_by_code", {
      p_code: joinCode.trim(),
    });
    setJoiningWithCode(false);
    if (error) {
      setJoinCodeError(error.message || "Code invalide.");
      return;
    }
    await workspace.refreshStores();
    if (data?.store_id) {
      workspace.switchStore(data.store_id);
    }
    setShowJoinCodeModal(false);
    setJoinCode("");
  };

  const handleCopyStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyStoreName.trim() || copyingStore || !workspace.activeStore) return;
    setCopyingStore(true);
    setCopyStoreError(null);
    const { store, error } = await workspace.copyStore(
      workspace.activeStore.id,
      copyStoreName.trim(),
    );
    setCopyingStore(false);
    if (error) {
      setCopyStoreError(error);
      return;
    }
    if (store) {
      setShowCopyStoreModal(false);
      setCopyStoreName("");
      setWorkspaceMenuOpen(false);
    }
  };

  // Création INDÉPENDANTE (jamais un héritage) — c'est celle proposée aux
  // collaborateurs invités : ils deviennent propriétaires d'une toute
  // nouvelle boutique avec son propre essai gratuit de 7 jours, sans
  // aucun lien avec la boutique où ils collaborent déjà.
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || creatingStore) return;
    setCreatingStore(true);
    setCreateStoreError(null);
    const { store, error } = await workspace.createStore({ name: newStoreName.trim() });
    setCreatingStore(false);
    if (error) {
      setCreateStoreError(error);
      return;
    }
    if (store) {
      setShowCreateStoreModal(false);
      setNewStoreName("");
      setWorkspaceMenuOpen(false);
    }
  };

  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);

  const workspace = useWorkspace();
  const { user } = useAuth();

  const isTresorerieLow = tresorerie < seuilAlerte;
  const isTresorerieNegative = tresorerie < 0;
  // Un collaborateur sans la permission "capital" ne doit JAMAIS voir la
  // trésorerie globale de l'entreprise, même dans ce badge d'en-tête
  // toujours visible — c'était affiché sans aucune vérification jusqu'ici.
  const hasCapitalAccess =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("capital");

  // Build aggregated notifications list from recent software activities
  const allNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      type: "sale" | "purchase" | "expense" | "apport" | "stock";
      title: string;
      desc: string;
      date: string;
      amount?: number;
      badgeColor: string;
    }> = [];

    // Stock alert notifications
    products
      .filter((p) => p.stockActuel <= p.seuilAlerte)
      .forEach((p) => {
        list.push({
          id: `notif-stock-${p.id}`,
          type: "stock",
          title: `Alerte Stock Bas: ${getProductLabel(p, products)}`,
          desc: `Stock restant: ${p.stockActuel} (seuil: ${p.seuilAlerte})`,
          date: "Aujourd'hui",
          badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        });
      });

    return list;
  }, [products]);

  const unreadCount = allNotifications.filter((n) => !readNotifIds.includes(n.id)).length;
  const markAllRead = () => setReadNotifIds(allNotifications.map((n) => n.id));

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "capital", label: "Capital", icon: <Wallet className="w-4 h-4" /> },
    {
      id: "commandes",
      label: "Commandes",
      icon: <ShoppingBag className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: "paiements",
      label: "Paiements à recevoir",
      icon: <CreditCard className="w-4 h-4 text-rose-400" />,
    },
    { id: "clients", label: "Clients", icon: <UserIcon className="w-4 h-4 text-cyan-400" /> },
    { id: "produits", label: "Produits", icon: <Package className="w-4 h-4" /> },
    { id: "achats", label: "Achats", icon: <ShoppingCart className="w-4 h-4" /> },
    { id: "ventes", label: "Ventes", icon: <DollarSign className="w-4 h-4" /> },
    { id: "vendeurs", label: "Vendeurs", icon: <Users className="w-4 h-4" /> },
    { id: "depenses", label: "Dépenses", icon: <ArrowRightLeft className="w-4 h-4" /> },
    { id: "rapports", label: "Bilan", icon: <CalendarRange className="w-4 h-4 text-amber-400" /> },
    { id: "historique", label: "Historique", icon: <History className="w-4 h-4" /> },
  ];

  // Owner (memberPermissions === null) = tous les onglets. Collaborateur =
  // uniquement ceux choisis par le propriétaire à l'invitation — SAUF
  // "dashboard", "capital" et "ventes" qui restent toujours visibles :
  // plutôt que de les cacher, leur CONTENU s'adapte (vue personnelle
  // restreinte au lieu des données globales de l'entreprise, voir
  // BalsamaApp.tsx). Ce même principe pourra être étendu aux autres
  // onglets (Achats, Commandes, Dépenses...) selon le même schéma.
  const ALWAYS_VISIBLE_TABS = ["dashboard", "capital", "ventes"];
  const visibleTabs =
    workspace.memberPermissions === null
      ? tabs
      : tabs.filter(
          (tab) =>
            ALWAYS_VISIBLE_TABS.includes(tab.id) || workspace.memberPermissions!.includes(tab.id),
        );
  const canSeeSettings =
    workspace.memberPermissions === null || workspace.memberPermissions.includes("settings");

  const bottomTabs: { id: ActiveTab; shortLabel: string; icon: React.ReactNode }[] = (
    [
      { id: "dashboard", shortLabel: "Accueil", icon: <TrendingUp className="w-5 h-5" /> },
      { id: "commandes", shortLabel: "Cmds", icon: <ShoppingBag className="w-5 h-5" /> },
      { id: "ventes", shortLabel: "Ventes", icon: <DollarSign className="w-5 h-5" /> },
      { id: "produits", shortLabel: "Stock", icon: <Package className="w-5 h-5" /> },
    ] as { id: ActiveTab; shortLabel: string; icon: React.ReactNode }[]
  ).filter(
    (tab) =>
      workspace.memberPermissions === null ||
      ALWAYS_VISIBLE_TABS.includes(tab.id) ||
      workspace.memberPermissions.includes(tab.id),
  );

  const handleTabClick = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setNotifOpen(false);
  };

  return (
    <header className="bg-card text-white border-b border-border sticky top-0 z-40 shadow-md">
      {/* Top Banner */}
      <div className="app-container py-2.5 sm:py-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        {/* Brand & Workspace Switcher */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 shadow-lg shrink-0 bg-muted flex items-center justify-center">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.storeName || "Logo"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-xs text-white uppercase tracking-tight">
                {(settings.storeName || "BA").slice(0, 2)}
              </div>
            )}
          </div>

          <div className="min-w-0 relative">
            <button
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              className="flex items-center gap-2 hover:bg-muted/50 py-1 pl-1 pr-2 rounded-lg transition-colors group text-left"
            >
              <div>
                <h1 className="font-bold text-base md:text-lg tracking-tight text-foreground flex items-center gap-2 truncate">
                  {settings.storeName || APP_NAME}
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h1>
                <p className="text-[11px] md:text-xs font-semibold truncate">
                  {workspace.isOwner ? (
                    <span className="text-emerald-400">👑 Espace Fondateur</span>
                  ) : (
                    <span className="text-blue-400">🤝 Espace Collaborateur</span>
                  )}
                </p>
              </div>
            </button>

            {/* Workspace Dropdown */}
            {workspaceMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWorkspaceMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Espaces de travail
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {workspace.accessibleStores.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          workspace.switchStore(w.id);
                          setWorkspaceMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left ${w.id === workspace.activeStore?.id ? "bg-emerald-500/10 text-emerald-400" : "text-foreground"}`}
                      >
                        <Building className="w-4 h-4 shrink-0" />
                        <div className="truncate flex-1">
                          <div className="text-sm font-semibold truncate">{w.name}</div>
                          <div className="text-[10px] opacity-80">
                            {w.owner_id === user?.id ? "Propriétaire" : "Collaborateur"}
                          </div>
                        </div>
                        {w.id === workspace.activeStore?.id && (
                          <CheckCheck className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {workspace.isOwner ? (
                    <div className="border-t border-border py-1">
                      <button
                        onClick={() => {
                          setWorkspaceMenuOpen(false);
                          setCopyStoreName(
                            workspace.activeStore ? `${workspace.activeStore.name} (copie)` : "",
                          );
                          setShowCopyStoreModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left text-emerald-400"
                      >
                        <Copy className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-semibold">Créer une boutique</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-border py-1">
                      <button
                        onClick={() => {
                          setWorkspaceMenuOpen(false);
                          setNewStoreName("");
                          setCreateStoreError(null);
                          setShowCreateStoreModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left text-emerald-400"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-semibold">Créer une boutique</span>
                      </button>
                    </div>
                  )}
                  <div className="border-t border-border py-1">
                    <button
                      onClick={() => {
                        setWorkspaceMenuOpen(false);
                        setJoinCodeError(null);
                        setJoinCode("");
                        setShowJoinCodeModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left text-foreground"
                    >
                      <KeyRound className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-semibold">Rejoindre avec un code</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {hasCapitalAccess && (
            <div className="flex items-center gap-2 sm:gap-3 bg-muted/80 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-muted-foreground/20">
              <div>
                <div className="text-[9px] sm:text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Trésorerie
                </div>
                <div
                  className={`text-xs sm:text-base font-bold font-mono whitespace-nowrap ${isTresorerieNegative ? "text-red-400 animate-pulse" : isTresorerieLow ? "text-amber-400" : "text-emerald-400"}`}
                >
                  {formatCurrency(tresorerie)}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl bg-muted border border-muted-foreground/20 text-foreground hover:text-amber-400 hover:bg-accent transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-400" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className={`relative p-2.5 rounded-xl border transition-colors ${
                notifOpen
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-muted border-muted-foreground/20 text-foreground hover:bg-accent"
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-emerald-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400" /> Notifications
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {allNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucune notification pour le moment.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {allNotifications.map((n) => {
                          const isRead = readNotifIds.includes(n.id);
                          return (
                            <div
                              key={n.id}
                              className={`px-4 py-3 flex items-start gap-3 transition-colors ${isRead ? "opacity-60" : "bg-emerald-500/[0.03]"}`}
                            >
                              <span
                                className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${isRead ? "bg-transparent" : "bg-emerald-400"}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-foreground truncate">
                                  {n.title}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {n.desc}
                                </div>
                                <div
                                  className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${n.badgeColor}`}
                                >
                                  {n.date}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Settings - visible pour les owners et les collaborateurs avec
              la permission "settings" */}
          {canSeeSettings && (
            <button
              onClick={() => handleTabClick("settings")}
              className={`p-2.5 rounded-xl border transition-colors ${
                activeTab === "settings"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-muted border-muted-foreground/20 text-foreground hover:bg-accent"
              }`}
              title="Paramètres"
            >
              <Settings className="w-4 h-4 text-emerald-400" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Horizontal Navigation Tabs */}
      <div className="hidden md:block bg-background/80 border-t border-border/80 overflow-x-auto">
        <div className="app-container flex items-center gap-1 py-1">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Menus */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-background/70 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed bottom-[68px] left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl px-4 pt-3 pb-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="w-10 h-1 rounded-full bg-accent mx-auto mb-3" />
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {visibleTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold w-full text-left transition-all ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-background text-muted-foreground border border-border hover:bg-muted"
                    }`}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${activeTab === tab.id && !mobileMenuOpen ? "text-emerald-400 scale-110" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.icon}
              <span className="text-[9px] font-semibold">{tab.shortLabel}</span>
            </button>
          ))}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${mobileMenuOpen ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[9px] font-semibold">Plus</span>
          </button>
        </div>
      </nav>

      {/* Modale : créer une nouvelle boutique (multi-boutiques) */}



      {/* Modale : dupliquer la boutique active (config uniquement) */}
      {showCopyStoreModal && workspace.activeStore && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl text-foreground space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Copy className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold">Dupliquer {workspace.activeStore.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reprend la configuration (devise, TVA, fournisseurs, coordonnées...) dans une
              nouvelle boutique. Les produits, ventes et données ne sont PAS copiés — c'est une
              boutique neuve, indépendante.
              {workspace.activeStore.activation_status === "active" ? (
                <span className="block mt-2 text-emerald-400 font-medium">
                  Cette boutique est active à vie : la copie le sera aussi, immédiatement.
                </span>
              ) : (
                <span className="block mt-2 text-amber-400 font-medium">
                  Cette boutique est en essai : la copie héritera de la même date de fin d'essai
                  (pas d'un nouvel essai de 7 jours).
                </span>
              )}
            </p>
            <form onSubmit={handleCopyStore} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={copyStoreName}
                onChange={(e) => setCopyStoreName(e.target.value)}
                placeholder="Nom de la nouvelle boutique"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500"
              />
              {copyStoreError && (
                <p className="text-rose-500 text-sm font-semibold">{copyStoreError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCopyStoreModal(false);
                    setCopyStoreError(null);
                  }}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={copyingStore}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm"
                >
                  {copyingStore ? "Copie..." : "Dupliquer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale : créer une boutique INDÉPENDANTE (nouvel essai de 7 jours,
          proposée aux collaborateurs invités — jamais un héritage de la
          boutique où ils collaborent déjà) */}
      {showCreateStoreModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl text-foreground space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Store className="w-4.5 h-4.5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold">Créer une nouvelle boutique</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous devenez propriétaire de cette nouvelle boutique, avec son propre essai gratuit
              de 7 jours. Elle est totalement indépendante de la boutique où vous collaborez
              actuellement.
            </p>
            <form onSubmit={handleCreateStore} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Nom de votre boutique"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-emerald-500"
              />
              {createStoreError && (
                <p className="text-rose-500 text-sm font-semibold">{createStoreError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateStoreModal(false);
                    setCreateStoreError(null);
                  }}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingStore}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm"
                >
                  {creatingStore ? "Création..." : "Créer la boutique"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale : rejoindre une boutique avec un code d'invitation */}
      {showJoinCodeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl text-foreground space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <KeyRound className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold">Rejoindre avec un code</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Entrez le code d'invitation reçu du propriétaire de la boutique. Le code ne
              fonctionne qu'avec l'adresse e-mail à laquelle il a été destiné.
            </p>
            <form onSubmit={handleJoinWithCode} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="INV-XXXX-XXXX"
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground font-mono tracking-widest text-center focus:outline-none focus:border-blue-500"
              />
              {joinCodeError && (
                <p className="text-rose-500 text-sm font-semibold">{joinCodeError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowJoinCodeModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-accent text-muted-foreground rounded-xl font-medium text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={joiningWithCode}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-semibold text-sm"
                >
                  {joiningWithCode ? "Vérification..." : "Rejoindre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};