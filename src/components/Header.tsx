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
import { Modal } from "./shared/Modal";
import { Sidebar } from "./Sidebar";
import { useNotificationPrefs } from "../lib/notificationPrefs";
import {
  visibleNavGroups,
  visibleNavItems,
  visibleBottomTabs,
  canSeeSettings,
} from "./navigation";
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
  /**
   * État replié de la sidebar. Il est détenu par BalsamaApp car le
   * décalage du contenu principal doit suivre la largeur de la sidebar :
   * la barre du haut et le <main> l'appliquent tous les deux.
   */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
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
  sidebarCollapsed,
  onToggleSidebar,
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

  const [notificationPrefs] = useNotificationPrefs();
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

    // Réglage « Alertes de stock bas » (Paramètres → Notifications).
    if (!notificationPrefs.stockAlerts) return list;

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
          badgeColor: "app-badge-warning",
        });
      });

    return list;
  }, [products, notificationPrefs.stockAlerts]);

  const unreadCount = allNotifications.filter((n) => !readNotifIds.includes(n.id)).length;
  const markAllRead = () => setReadNotifIds(allNotifications.map((n) => n.id));

  // Onglets et filtrage par permissions : voir src/components/navigation.tsx.
  // La sidebar (desktop) et le menu bas (mobile) consomment ces mêmes
  // fonctions, pour qu'un collaborateur voie strictement la même liste
  // d'onglets quel que soit l'appareil.
  const navGroups = visibleNavGroups(workspace.memberPermissions);
  const visibleTabs = visibleNavItems(workspace.memberPermissions);
  const showSettings = canSeeSettings(workspace.memberPermissions);
  const bottomTabs = visibleBottomTabs(workspace.memberPermissions);

  const handleTabClick = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setNotifOpen(false);
  };

  // Badge Trésorerie — rendu à deux endroits : en ligne avec les actions
  // à partir de 640px, et sur une ligne dédiée en dessous. Sur un écran
  // de 320px il n'y a pas la place pour le nom de la boutique ET le
  // montant côte à côte : c'est ce qui provoquait la superposition.
  const tresorerieBadge = hasCapitalAccess ? (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/80 px-3 py-2 sm:justify-start">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Trésorerie
      </div>
      <div
        className={`font-mono text-sm font-bold tabular-nums sm:text-base ${
          isTresorerieNegative ? "t-danger" : isTresorerieLow ? "t-warning" : "t-success"
        }`}
      >
        {formatCurrency(tresorerie)}
      </div>
    </div>
  ) : null;

  // Bloc marque + sélecteur d'espace de travail. Rendu à un seul endroit
  // selon la taille d'écran : en haut de la sidebar sur desktop, dans la
  // barre du haut sur mobile (où il n'y a pas de sidebar).
  const brandBlock = (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 shrink-0 bg-muted flex items-center justify-center">
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

          {/* min-w-0 doit être présent sur CHAQUE niveau jusqu'au texte,
              sinon truncate n'a aucun effet et le bloc pousse les
              éléments voisins hors de l'écran. */}
          <div className="relative min-w-0 flex-1">
            <button
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              className="flex w-full min-w-0 items-center gap-2 hover:bg-muted/50 py-1 pl-1 pr-2 rounded-lg transition-colors group text-left"
            >
              <div className="min-w-0 flex-1">
                <h1 className="flex min-w-0 items-center gap-1.5 text-base font-bold tracking-tight text-foreground md:text-lg">
                  <span className="truncate">{settings.storeName || APP_NAME}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h1>
                <p className="truncate text-[11px] font-semibold md:text-xs">
                  {workspace.isOwner ? (
                    <span className="t-success">👑 Espace Fondateur</span>
                  ) : (
                    <span className="t-info">🤝 Espace Collaborateur</span>
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left ${w.id === workspace.activeStore?.id ? "bg-success-soft t-success" : "text-foreground"}`}
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left t-success"
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
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left t-success"
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
  );

  // Version réduite affichée quand la sidebar est en mode icônes.
  const brandCompact = (
    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-emerald-500/40 bg-muted">
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt={settings.storeName || "Logo"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 text-xs font-bold uppercase tracking-tight text-white">
          {(settings.storeName || "BA").slice(0, 2)}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Sidebar
        groups={navGroups}
        activeTab={activeTab}
        onTabClick={handleTabClick}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={onToggleSidebar}
        brand={brandBlock}
        brandCompact={brandCompact}
      />

      {/* Le décalage horizontal est appliqué par le conteneur racine dans
          BalsamaApp.tsx, qui englobe cette barre et le contenu. */}
      <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm">
      {/* Top Banner */}
      <div className="app-container py-2.5 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
        {/* Marque : uniquement sur mobile — sur desktop elle vit dans la sidebar */}
        <div className="flex min-w-0 flex-1 lg:hidden">{brandBlock}</div>

        {/* Header Right Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-auto">
          {/* À partir de 640px la trésorerie tient sur la même ligne. */}
          <div className="hidden sm:block">{tresorerieBadge}</div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="app-btn-icon"
            title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 t-warning" />
            ) : (
              <Moon className="w-4 h-4 t-info" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className={`app-btn-icon relative ${
                notifOpen ? "border-success-border bg-success-soft" : ""
              }`}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 t-success" />
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
                      <Bell className="w-4 h-4 t-success" /> Notifications
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-semibold t-success hover:underline flex items-center gap-1"
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
          {showSettings && (
            <button
              onClick={() => handleTabClick("settings")}
              className={`app-btn-icon ${
                activeTab === "settings" ? "border-success-border bg-success-soft" : ""
              }`}
              title="Paramètres"
              aria-label="Paramètres"
            >
              <Settings className="w-4 h-4 t-success" />
            </button>
          )}
        </div>
        </div>

        {/* Trésorerie sur sa propre ligne en dessous de 640px */}
        {tresorerieBadge && <div className="mt-2.5 sm:hidden">{tresorerieBadge}</div>}
      </div>

      {/* La barre d'onglets horizontale desktop est remplacée par la
          sidebar : à douze onglets elle débordait de son conteneur sans
          aucun indicateur de défilement. */}

      {/* Mobile Menus */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-background/70 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed bottom-[68px] left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl px-4 pt-3 pb-4 shadow-2xl animate-in slide-in-from-bottom duration-200">
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {bottomTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${activeTab === tab.id && !mobileMenuOpen ? "t-success scale-110" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.icon}
              <span className="text-[9px] font-semibold">{tab.shortLabel}</span>
            </button>
          ))}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-colors ${mobileMenuOpen ? "t-success" : "text-muted-foreground hover:text-foreground"}`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[9px] font-semibold">Plus</span>
          </button>
        </div>
      </nav>

      {/* ── Dupliquer la boutique active (configuration seulement) ── */}
      {showCopyStoreModal && workspace.activeStore && (
        <Modal
          open
          onClose={() => {
            setShowCopyStoreModal(false);
            setCopyStoreError(null);
          }}
          size="sm"
          icon={<Copy className="h-4 w-4" />}
          title="Dupliquer la boutique"
          description={workspace.activeStore.name}
          dismissible={!copyingStore}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowCopyStoreModal(false);
                  setCopyStoreError(null);
                }}
                className="app-btn-secondary"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="copy-store-form"
                disabled={copyingStore}
                className="app-btn-primary"
              >
                {copyingStore ? "Copie..." : "Dupliquer"}
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            Reprend la configuration (devise, TVA, fournisseurs, coordonnées...) dans une nouvelle
            boutique. Les produits, ventes et données ne sont pas copiés : c'est une boutique
            neuve, indépendante.
          </p>

          <p
            className={`mt-3 text-sm font-medium ${
              workspace.activeStore.activation_status === "active" ? "t-success" : "t-warning"
            }`}
          >
            {workspace.activeStore.activation_status === "active"
              ? "Cette boutique est active à vie : la copie le sera aussi, immédiatement."
              : "Cette boutique est en essai : la copie héritera de la même date de fin d'essai, pas d'un nouvel essai de 7 jours."}
          </p>

          <form onSubmit={handleCopyStore} id="copy-store-form" className="mt-4 space-y-3">
            <input
              type="text"
              required
              autoFocus
              value={copyStoreName}
              onChange={(e) => setCopyStoreName(e.target.value)}
              placeholder="Nom de la nouvelle boutique"
              className="app-field"
            />
            {copyStoreError && <p className="text-sm font-medium t-danger">{copyStoreError}</p>}
          </form>
        </Modal>
      )}

      {/* ── Créer une boutique indépendante ──
          Proposée aux collaborateurs invités : elle ouvre un nouvel essai
          de 7 jours et n'hérite jamais de la boutique où ils collaborent. */}
      <Modal
        open={showCreateStoreModal}
        onClose={() => {
          setShowCreateStoreModal(false);
          setCreateStoreError(null);
        }}
        size="sm"
        icon={<Store className="h-4 w-4" />}
        title="Créer une boutique"
        description="Vous en devenez propriétaire, avec son propre essai gratuit de 7 jours."
        dismissible={!creatingStore}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowCreateStoreModal(false);
                setCreateStoreError(null);
              }}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="create-store-form"
              disabled={creatingStore}
              className="app-btn-primary"
            >
              {creatingStore ? "Création..." : "Créer la boutique"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Elle est totalement indépendante de la boutique où vous collaborez actuellement.
        </p>

        <form onSubmit={handleCreateStore} id="create-store-form" className="mt-4 space-y-3">
          <input
            type="text"
            required
            autoFocus
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="Nom de votre boutique"
            className="app-field"
          />
          {createStoreError && <p className="text-sm font-medium t-danger">{createStoreError}</p>}
        </form>
      </Modal>

      {/* ── Rejoindre une boutique avec un code d'invitation ── */}
      <Modal
        open={showJoinCodeModal}
        onClose={() => setShowJoinCodeModal(false)}
        size="sm"
        icon={<KeyRound className="h-4 w-4" />}
        title="Rejoindre avec un code"
        description="Le code ne fonctionne qu'avec l'adresse e-mail à laquelle il a été destiné."
        dismissible={!joiningWithCode}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowJoinCodeModal(false)}
              className="app-btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="join-code-form"
              disabled={joiningWithCode}
              className="app-btn-primary"
            >
              {joiningWithCode ? "Vérification..." : "Rejoindre"}
            </button>
          </>
        }
      >
        <form onSubmit={handleJoinWithCode} id="join-code-form" className="space-y-3">
          <input
            type="text"
            required
            autoFocus
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="INV-XXXX-XXXX"
            className="app-field text-center font-mono tracking-widest"
          />
          {joinCodeError && <p className="text-sm font-medium t-danger">{joinCodeError}</p>}
        </form>
      </Modal>
      </header>
    </>
  );
};