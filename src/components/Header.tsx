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
} from "lucide-react";
import { formatCurrency, getProductLabel } from "../utils/formulas";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
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

  const bottomTabs: { id: ActiveTab; shortLabel: string; icon: React.ReactNode }[] = [
    { id: "dashboard", shortLabel: "Accueil", icon: <TrendingUp className="w-5 h-5" /> },
    { id: "commandes", shortLabel: "Cmds", icon: <ShoppingBag className="w-5 h-5" /> },
    { id: "ventes", shortLabel: "Ventes", icon: <DollarSign className="w-5 h-5" /> },
    { id: "produits", shortLabel: "Stock", icon: <Package className="w-5 h-5" /> },
  ];

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
                  <div className="border-t border-border py-1">
                    <button
                      onClick={() => {
                        setWorkspaceMenuOpen(false);
                        setShowCreateStoreModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left text-emerald-400"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-semibold">Créer une boutique</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
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

          {/* Settings - visible for all authenticated users */}
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
        </div>
      </div>

      {/* Desktop Horizontal Navigation Tabs */}
      <div className="hidden md:block bg-background/80 border-t border-border/80 overflow-x-auto">
        <div className="app-container flex items-center gap-1 py-1">
          {tabs.map((tab) => {
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
              {tabs.map((tab) => {
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
              Un même compte peut gérer plusieurs boutiques. Cette nouvelle boutique démarre avec
              son propre essai gratuit de 7 jours, indépendant de vos autres boutiques.
            </p>
            <form onSubmit={handleCreateStore} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="Ex: Ma Deuxième Boutique"
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
    </header>
  );
};