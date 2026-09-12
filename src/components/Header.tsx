import React, { useState, useMemo } from "react";
import { ActiveTab, StoreSettings, Product } from "../types";
import {
  Settings,
  Store,
  Menu,
  X,
  Bell,
  CheckCheck,
  ChevronDown,
  Building,
  Plus,
  Copy,
  KeyRound,
} from "lucide-react";
import { getProductLabel } from "../utils/formulas";
import { Modal } from "./shared/Modal";
import { Sidebar } from "./Sidebar";
import { MenuPlus } from "./MenuPlus";
import { useNotificationPrefs } from "../lib/notificationPrefs";
import { visibleNavGroups, visibleBottomTabs, canSeeSettings } from "./navigation";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import { useBarresAuDefilement } from "../hooks/useBarresAuDefilement";
import { supabase } from "../lib/supabase";
import { APP_NAME } from "../lib/appConfig";
import { usePersonnalisation } from "../lib/personnalisation";

/**
 * Ce que la barre du haut reçoit — et rien de plus.
 *
 * Elle demandait aussi la trésorerie, son seuil d'alerte, le résumé du
 * capital, le thème, le nombre d'articles en rupture et quatre tableaux
 * complets (ventes, achats, dépenses, apports). Les quatre tableaux
 * n'étaient lus nulle part : ils traversaient le composant sans servir,
 * en le faisant reconstruire à chaque écriture enregistrée. Le reste a
 * été retiré de l'affichage lors du nettoyage de l'en-tête.
 *
 * `products` reste : les alertes de stock bas en dépendent.
 */
interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: StoreSettings;
  products?: Product[];
  /**
   * État replié de la sidebar. Il est détenu par BalsamaApp car le
   * décalage du contenu principal doit suivre la largeur de la sidebar :
   * la barre du haut et le <main> l'appliquent tous les deux.
   */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

/**
 * La barre du haut.
 *
 * Elle ne garde que ce dont on se sert sans y penser : le nom de la
 * boutique (qui ouvre le choix d'espace de travail), la cloche des
 * alertes, et l'accès aux réglages. Trois choses en sont sorties, et
 * aucune n'a été perdue :
 *
 * — la mention « Espace Fondateur / Collaborateur », qui répétait à
 *   longueur de journée une information apprise une fois. Le menu des
 *   espaces de travail la porte déjà, boutique par boutique ;
 * — la bascule clair/sombre, qui existe dans Paramètres →
 *   Préférences. On choisit son thème une fois, pas dix fois par jour ;
 * — le badge Trésorerie, que le Tableau de bord affiche déjà en
 *   vignette, avec en plus ses bandeaux d'alerte quand le solde passe
 *   sous le seuil ou devient négatif. Sur mobile, il occupait à lui
 *   seul une deuxième ligne d'en-tête sur chacun des quinze écrans.
 *
 * Sur mobile, l'en-tête passe ainsi de deux lignes à une seule.
 */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
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
  // Le vocabulaire et les modules retenus par la boutique.
  const perso = usePersonnalisation();
  const navGroups = visibleNavGroups(workspace.memberPermissions, perso);
  const showSettings = canSeeSettings(workspace.memberPermissions);
  const bottomTabs = visibleBottomTabs(workspace.memberPermissions, perso);

  const handleTabClick = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setNotifOpen(false);
  };

  // Les deux barres s'effacent ensemble quand on descend. Tant qu'un
  // panneau est ouvert, elles restent en place : la barre du bas porte
  // le bouton qui referme le menu « Plus », et les deux menus déroulants
  // sont ancrés dans la barre du haut — ils la suivraient hors de
  // l'écran, ouverts, au premier mouvement du doigt.
  const barresMasquees = useBarresAuDefilement(!mobileMenuOpen && !notifOpen && !workspaceMenuOpen);

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
          {/* Une seule ligne : le nom de la boutique. La mention
              « Espace Fondateur / Collaborateur » qui vivait ici ne se
              lisait qu'une fois, à la découverte, puis occupait une
              ligne tous les jours. Le menu qu'ouvre ce bouton dit déjà
              « Propriétaire » ou « Collaborateur » en face de chaque
              boutique, là où l'information sert vraiment : au moment de
              choisir entre plusieurs espaces. */}
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight text-foreground md:text-lg">
              <span className="truncate">{settings.storeName || APP_NAME}</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            </h1>
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
          BalsamaApp.tsx, qui englobe cette barre et le contenu.

          Cet élément ne contient plus que la barre elle-même. Le menu du
          bas, le panneau « Plus » et les modales en ont été sortis, et
          ce n'est pas un rangement : un ancêtre porteur d'un `transform`
          devient le référentiel de ses descendants en `position: fixed`.
          Laissés dedans, ils auraient suivi la barre hors de l'écran au
          premier défilement. */}
      <header
        data-masquee={barresMasquees}
        className="app-bar-auto app-bar-haut bg-card border-b border-border sticky top-0 z-40 shadow-sm"
      >
        {/* Top Banner */}
        <div className="app-container py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Marque : uniquement sur mobile — sur desktop elle vit dans la sidebar */}
            <div className="flex min-w-0 flex-1 lg:hidden">{brandBlock}</div>

            {/* Ce que la barre du haut garde : de quoi être averti, et de
                quoi aller aux réglages. Le badge Trésorerie et la bascule
                clair/sombre en sont partis — le raisonnement est en tête
                de ce fichier. */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-auto">
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
        </div>

        {/* La barre d'onglets horizontale desktop est remplacée par la
          sidebar : à douze onglets elle débordait de son conteneur sans
          aucun indicateur de défilement. */}
      </header>

      {mobileMenuOpen && (
        <MenuPlus
          groups={navGroups}
          activeTab={activeTab}
          onTabClick={handleTabClick}
          onFermer={() => setMobileMenuOpen(false)}
        />
      )}
      {/* Mobile Bottom Navigation */}
      <nav
        data-masquee={barresMasquees}
        className="app-bar-auto app-bar-bas lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      >
        {/* Le nombre de colonnes suit le nombre de raccourcis. Il était
            figé à cinq : une boutique qui masquait un module laissait
            une colonne vide et voyait « Plus » se décaler vers la
            gauche au lieu de rester au bord. */}
        <div
          className="grid px-1 pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${bottomTabs.length + 1}, minmax(0, 1fr))` }}
        >
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
            boutique. Les produits, ventes et données ne sont pas copiés : c'est une boutique neuve,
            indépendante.
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
    </>
  );
};
