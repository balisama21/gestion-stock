import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActiveTab, StoreSettings } from "../types";
import {
  Store,
  Settings,
  Bell,
  HelpCircle,
  Menu,
  X,
  CheckCheck,
  ChevronDown,
  Building,
  Plus,
  KeyRound,
  LogOut,
  UserRound,
} from "lucide-react";
import { PanneauAide } from "./shared/PanneauAide";
import { AvatarPersonne } from "./shared/AvatarPersonne";
import { Icone } from "./shared/Icone";
import { formatCurrency } from "../utils/formulas";
import { Modal } from "./shared/Modal";
import { Sidebar } from "./Sidebar";
import { MenuPlus } from "./MenuPlus";
import { PanneauNotifications } from "./PanneauNotifications";
import { compterNonVues, estNonLue, useNotificationsLues } from "../lib/notificationsLues";
import { destinationDe } from "../lib/routageNotifications";
import type { ActionNotification, Notification } from "../lib/activite";
import { visibleNavGroups, visibleBottomTabs, canSeeSettings } from "./navigation";
import { useWorkspace } from "../hooks/useWorkspace";
import { useAuth } from "../hooks/useAuth";
import { useBarresAuDefilement } from "../hooks/useBarresAuDefilement";
import { useClicExterieur } from "../hooks/useClicExterieur";
import { useConfirmation } from "../hooks/useConfirmation";
import { supabase } from "../lib/supabase";
import { hoteVisite, peutCreerUneBoutique } from "../lib/marquesBoutiques";
import { abonnementNouvelleBoutique } from "../lib/abonnementNouvelleBoutique";
import { useMarque } from "../hooks/useMarque";
import { usePersonnalisation } from "../lib/personnalisation";

/**
 * Les écrans dont la liste sait recevoir une recherche toute faite
 * (`useRechercheInitiale`). Depuis un autre écran, la recherche de la
 * barre du haut ouvre le premier d'entre eux auquel on a accès.
 */
const ECRANS_RECHERCHABLES: ActiveTab[] = [
  "produits",
  "ventes",
  "clients",
  "achats",
  "commandes",
  "depenses",
  "devis",
  "livraisons",
  "paiements",
];

/**
 * Ce que la barre du haut reçoit — et rien de plus.
 *
 * Elle demandait aussi le résumé du capital, le thème, le nombre
 * d'articles en rupture et quatre tableaux complets (ventes, achats,
 * dépenses, apports). Les quatre tableaux n'étaient lus nulle part : ils
 * traversaient le composant sans servir, en le faisant reconstruire à
 * chaque écriture enregistrée.
 *
 * La trésorerie et son seuil restent : ils s'affichent sous le nom de la
 * boutique. Les notifications arrivent toutes construites — voir
 * src/lib/activite.ts —, la barre ne fait que les présenter. Le
 * catalogue produits n'a donc plus à la traverser : les alertes de stock
 * se calculent là-bas, avec le reste.
 */
interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  /**
   * Ouvrir un écran EN VISANT une ligne. Séparé de `setActiveTab`,
   * qui sert à huit autres endroits et n'a aucune raison de porter
   * un argument dont ils ne se servent pas.
   */
  onViserLigne?: (onglet: ActiveTab, texte: string, filtre?: string, id?: string) => void;
  settings: StoreSettings;
  /** Solde de trésorerie, affiché sous le nom de la boutique. */
  tresorerie: number;
  /** Seuil sous lequel ce solde passe en orange. */
  seuilAlerte: number;
  /**
   * Ouvre les réglages sur l'identité de la boutique — c'est là que se
   * changent le logo et le nom. Branché sur le logo de l'en-tête.
   */
  onOuvrirIdentiteBoutique: () => void;
  /**
   * Ouvre les réglages sur « Mon compte ». Branché sur « Mon profil »,
   * dans le menu de l'avatar. Sans lui, l'entrée ouvre les Paramètres
   * tels quels — ils s'ouvrent déjà sur « Mon compte ».
   */
  onOuvrirMonCompte?: () => void;
  /**
   * Vrai sur le tableau de bord, dont la photo du haut remonte sous la
   * barre (voir coquille.css). Tant que la page est
   * tout en haut, la barre est transparente et ses icônes blanches ; dès
   * qu'on descend, elle reprend son fond.
   */
  surPhoto?: boolean;
  /** Ce qui demande attention et ce qui vient de se passer. */
  notifications: Notification[];
  /**
   * Ce que fait un bouton posé sous une notification.
   *
   * L'en-tête ne le sait pas : il ne connaît que des clés, et
   * `BalsamaApp` sait où elles mènent. Une notification qui décrit
   * quatre produits à commander doit pouvoir ouvrir la liste de ces
   * quatre-là, et c'est la coquille qui tient le filtre.
   */
  onActionNotification?: (action: ActionNotification) => void;
  /**
   * État replié de la sidebar. Il est détenu par BalsamaApp car le
   * décalage du contenu principal doit suivre la largeur de la sidebar :
   * la barre du haut et le <main> l'appliquent tous les deux.
   */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  /**
   * Sur ordinateur, ne pas monter la navigation latérale : les
   * Paramètres ont la leur, et deux colonnes de menus côte à côte se
   * gênaient. Le conteneur racine retire alors son décalage à gauche.
   */
  sansBarreLaterale?: boolean;
  /** Ce qui réclame l'attention, par onglet du menu. */
  badgesNav?: Partial<Record<ActiveTab, number>>;
}

/**
 * La barre du haut.
 *
 * Elle ne garde que ce dont on se sert sans y penser : le logo de la
 * marque et le nom de la boutique — qui ouvre le choix d'espace de
 * travail et porte le solde de trésorerie —, la recherche, la cloche
 * des alertes et le profil.
 *
 * UNE CHOSE EN EST SORTIE, et elle n'a pas été perdue : la mention
 * « Espace Fondateur / Collaborateur », qui répétait à longueur de
 * journée une information apprise une fois. Le menu des espaces de
 * travail la porte déjà, boutique par boutique, et la ligne qu'elle
 * occupait porte maintenant la trésorerie.
 *
 * La bascule clair/sombre en est sortie : le thème se choisit une fois,
 * dans Paramètres → Préférences. L'aide de l'écran est passée dans le
 * menu du profil.
 *
 * La trésorerie, elle, avait une ligne d'en-tête à elle seule sur
 * mobile, sur chacun des quinze écrans, dans un cadre étiqueté en
 * capitales. Elle est toujours là, et la barre tient désormais sur une
 * seule rangée.
 */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onViserLigne,
  settings,
  tresorerie,
  seuilAlerte,
  onOuvrirIdentiteBoutique,
  onOuvrirMonCompte,
  surPhoto = false,
  notifications,
  onActionNotification,
  sidebarCollapsed,
  onToggleSidebar,
  sansBarreLaterale = false,
  badgesNav,
}) => {
  const marque = useMarque();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aideOuverte, setAideOuverte] = useState(false);
  // Sur téléphone, la recherche est une icône ; ouverte, son champ
  // recouvre la barre.
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  /**
   * La zone qui englobe la cloche ET son panneau. Cliquer ailleurs le
   * referme, y compris sur la barre laterale et sur la barre du bas,
   * que le voile invisible d avant ne couvrait pas : elles sont en
   * `z-50`, il etait en `z-40`.
   */
  const zoneNotif = useRef<HTMLDivElement>(null);
  const fermerNotif = useCallback(() => setNotifOpen(false), []);
  useClicExterieur(zoneNotif, notifOpen, fermerNotif);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [creatingStore, setCreatingStore] = useState(false);
  const [createStoreError, setCreateStoreError] = useState<string | null>(null);

  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joiningWithCode, setJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joiningWithCode) return;
    setJoiningWithCode(true);
    setJoinCodeError(null);
    const { data, error } = await supabase.rpc("rejoindre_par_code_sur_marque", {
      p_code: joinCode.trim(),
      p_hote: hoteVisite(),
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

  // Une boutique NEUVE, propriétaires comme collaborateurs : rien n'est
  // copié d'une autre boutique. Son ouverture suit le compte de qui la
  // crée — la base l'applique d'elle-même, voir
  // src/lib/abonnementNouvelleBoutique.ts, qui l'annonce dans la fenêtre.
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

  const workspace = useWorkspace();
  const { user, profile, signOut } = useAuth();

  /** Ce que la fenêtre de création annonce de l'ouverture de la boutique. */
  const messageAbonnement = useMemo(() => {
    if (!showCreateStoreModal) return null;
    const date = (iso: string) =>
      new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const etat = abonnementNouvelleBoutique(
      workspace.accessibleStores,
      user?.id,
      workspace.accesMarque.marqueId,
    );
    switch (etat.type) {
      case "a-vie":
        return {
          ton: "t-success",
          texte: "Votre compte est activé à vie : la boutique sera ouverte immédiatement.",
        };
      case "au-mois":
        return {
          ton: "t-success",
          texte: `Votre abonnement s'applique aussi à cette boutique, jusqu'au ${date(etat.jusquAu)}.`,
        };
      case "essai":
        return {
          ton: "t-warning",
          texte: `Elle reprend la période d'essai de votre compte, jusqu'au ${date(etat.jusquAu)}.`,
        };
      case "essai-termine":
        return {
          ton: "t-warning",
          texte:
            "La période d'essai de votre compte est terminée : la boutique sera ouverte dès l'activation du compte.",
        };
      case "essai-neuf":
        return { ton: "t-success", texte: "Elle démarre avec un essai gratuit de 30 jours." };
      default:
        return null;
    }
  }, [showCreateStoreModal, workspace.accessibleStores, workspace.accesMarque.marqueId, user?.id]);
  const { confirmer, modaleConfirmation } = useConfirmation();

  /**
   * LE MENU DU PROFIL. La roue dentée de la barre du haut y est entrée,
   * avec « Mon profil » et la déconnexion : trois gestes qui concernent
   * la personne connectée, rangés derrière son avatar. Les Paramètres
   * restent réservés à qui en a la permission, exactement comme avant.
   */
  const [profilOuvert, setProfilOuvert] = useState(false);
  const zoneProfil = useRef<HTMLDivElement>(null);
  const fermerProfil = useCallback(() => setProfilOuvert(false), []);
  useClicExterieur(zoneProfil, profilOuvert, fermerProfil);
  useEffect(() => {
    if (!profilOuvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfilOuvert(false);
    };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [profilOuvert]);
  const nomComplet = (profile?.full_name ?? "").trim();
  const courriel = profile?.email ?? user?.email ?? "";
  /*
   * L'AVATAR DE LA PERSONNE CONNECTÉE : celui du reste de l'application
   * (`AvatarPersonne`). Sa photo si elle en a choisi une, sinon le visage
   * illustré tiré de son nom. La clé est celle de l'écran Équipe — le nom
   * complet, à défaut l'e-mail —, si bien qu'une photo choisie dans
   * Paramètres → Mon compte y paraît aussi. Elle se change là-bas.
   */
  const nomAvatar = nomComplet || courriel;
  const seDeconnecter = async () => {
    setProfilOuvert(false);
    if (
      await confirmer("Voulez-vous vraiment vous déconnecter ?", {
        danger: true,
        libelle: "Se déconnecter",
      })
    )
      signOut();
  };

  // Un collaborateur sans la permission « capital » ne doit JAMAIS voir
  // la trésorerie globale de l'entreprise, pas même dans cette ligne
  // d'en-tête toujours visible. Contrôle repris tel quel — il ne s'agit
  // pas d'un droit qu'on ajoute, mais de celui qui existait déjà.
  const hasCapitalAccess =
    workspace.isOwner ||
    workspace.memberPermissions === null ||
    workspace.memberPermissions.includes("capital");

  // La liste se construit dans BalsamaApp, où vivent les données. Ici on
  // ne fait que la lire, la séparer en deux et compter ce qui n'a pas
  // encore été vu.
  //
  // La pastille compte ce qui n'a pas encore été VU — ouvrir la cloche la
  // remet à zéro, comme sur un réseau social. Ce qui n'a pas été ouvert
  // reste en gras dans la liste. Les gestes de la personne connectée ne
  // comptent jamais : on ne se notifie pas soi-même.
  const { etats, marquerVues, marquerLues } = useNotificationsLues(
    workspace.activeStore?.id ?? null,
    user?.id ?? null,
  );
  const alertes = notifications.filter((n) => n.genre === "alerte");
  const activites = notifications.filter((n) => n.genre === "activite");
  const nonVues = compterNonVues(notifications, etats);
  const nonLues = notifications.filter((n) => estNonLue(n, etats)).length;
  const toutMarquerLu = () =>
    marquerLues(notifications.filter((n) => estNonLue(n, etats)).map((n) => n.id));

  // Tout ce qui est affiché à l'ouverture est vu. Les notifications qui
  // arrivent pendant que le panneau reste ouvert le sont aussi : on les
  // a sous les yeux.
  useEffect(() => {
    if (!notifOpen) return;
    const aVoir = notifications.filter((n) => !n.deMoi && !etats.has(n.id)).map((n) => n.id);
    if (aVoir.length > 0) marquerVues(aVoir);
  }, [notifOpen, notifications, etats, marquerVues]);

  /** Une notification ouverte : lue, puis on va là où elle mène. */
  const ouvrirNotification = (n: Notification) => {
    marquerLues([n.id]);
    setNotifOpen(false);
    const d = destinationDe(n);
    if (!d) return;
    if (onViserLigne) onViserLigne(d.onglet, d.texte, d.filtre, d.id);
    else setActiveTab(d.onglet);
    setMobileMenuOpen(false);
  };

  // Onglets et filtrage par permissions : voir src/components/navigation.tsx.
  // La sidebar (desktop) et le menu bas (mobile) consomment ces mêmes
  // fonctions, pour qu'un collaborateur voie strictement la même liste
  // d'onglets quel que soit l'appareil.
  // Le vocabulaire et les modules retenus par la boutique.
  const perso = usePersonnalisation();
  const navGroups = visibleNavGroups(workspace.memberPermissions, perso);
  const showSettings = canSeeSettings(workspace.memberPermissions);
  const bottomTabs = visibleBottomTabs(workspace.memberPermissions, perso);

  const handleTabClick = (id: ActiveTab, reference?: string) => {
    if (reference && onViserLigne) onViserLigne(id, reference);
    else setActiveTab(id);
    setMobileMenuOpen(false);
    setNotifOpen(false);
  };

  const [recherche, setRecherche] = useState("");
  const champRecherche = useRef<HTMLInputElement>(null);
  // Ctrl+K (⌘K sur Mac) place le curseur dans la recherche, d'où qu'on soit.
  const surMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  useEffect(() => {
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        champRecherche.current?.focus();
        champRecherche.current?.select();
      }
    };
    window.addEventListener("keydown", raccourci);
    return () => window.removeEventListener("keydown", raccourci);
  }, []);
  const lancerRecherche = () => {
    const texte = recherche.trim();
    if (!texte) return;
    const visibles = navGroups.flatMap((g) => g.items.map((i) => i.id));
    const cible = [activeTab, ...ECRANS_RECHERCHABLES].find(
      (t) => ECRANS_RECHERCHABLES.includes(t) && visibles.includes(t),
    );
    if (cible) handleTabClick(cible, texte);
  };

  // Les deux barres s'effacent ensemble quand on descend. Tant qu'un
  // panneau est ouvert, elles restent en place : la barre du bas porte
  // le bouton qui referme le menu « Plus », et les deux menus déroulants
  // sont ancrés dans la barre du haut — ils la suivraient hors de
  // l'écran, ouverts, au premier mouvement du doigt.
  /* `activeTab` en second : l'en-tête reste monté d'un écran à
     l'autre, donc l'état des barres aussi. Sans cette clé, on
     arrivait sur une page courte avec les barres masquées par la
     page précédente, et rien ne pouvait plus les rappeler. */
  const [enHautDePage, setEnHautDePage] = useState(true);
  useEffect(() => {
    if (!surPhoto) return;
    const lire = () => setEnHautDePage(window.scrollY < 24);
    lire();
    window.addEventListener("scroll", lire, { passive: true });
    return () => window.removeEventListener("scroll", lire);
  }, [surPhoto]);

  const barresMasquees = useBarresAuDefilement(
    !mobileMenuOpen && !notifOpen && !workspaceMenuOpen && !profilOuvert,
    activeTab,
  );

  // Bloc marque + sélecteur d'espace de travail. Rendu à un seul endroit
  // selon la taille d'écran : en haut de la sidebar sur desktop, dans la
  // barre du haut sur mobile (où il n'y a pas de sidebar).
  // Le logo lui-même. Il ne portait aucune action : on le regardait, et
  // pour le changer il fallait passer par la roue dentée, puis « Ma
  // boutique ». C'est pourtant là qu'on pense d'abord à cliquer.
  //
  // C'est le logo de la marque (Tantana Suite, ou celui d'une marque
  // blanche), pas celui que la boutique a importé : ce dernier est fait
  // pour ses factures et ses documents, il n'habille pas l'application.
  const vignetteLogo = (
    <span className="coq-logo coq-logo-marque">
      <img src={marque.logoUrl} alt={marque.nom} />
    </span>
  );

  // Le choix d'espace de travail, ouvert depuis le nom de la boutique
  // (sidebar) ou depuis le logo (barre du haut, sur téléphone).
  const menuEspaces = workspaceMenuOpen && (
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
              {w.id === workspace.activeStore?.id && <CheckCheck className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>
        {peutCreerUneBoutique(workspace.accesMarque) && (
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
  );

  // La trésorerie sous le nom de la boutique. Elle ne se colore que
  // lorsqu'elle a quelque chose à dire : orange sous le seuil d'alerte,
  // rouge à découvert.
  const ligneTresorerie = hasCapitalAccess && (
    <span className="coq-treso">
      <span className="shrink-0">Trésorerie</span>
      <span
        className={`truncate tabular-nums ${
          tresorerie < 0 ? "t-danger" : tresorerie < seuilAlerte ? "t-warning" : "ok"
        }`}
      >
        {formatCurrency(tresorerie)}
      </span>
    </span>
  );

  // Sur téléphone, la marque, le nom de la boutique et sa trésorerie,
  // d'un seul bouton : il ouvre le choix d'espace de travail.
  const brandMobile = (
    <div className="coq-marque">
      <button
        type="button"
        onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
        aria-label="Changer d'espace de travail"
        aria-expanded={workspaceMenuOpen}
        className="coq-marque-bouton"
      >
        {vignetteLogo}
        <span className="coq-marque-texte">
          <span className="coq-nom">
            <span className="truncate">{settings.storeName || marque.nom}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
          </span>
          {ligneTresorerie}
        </span>
      </button>
      {menuEspaces}
    </div>
  );

  const brandBlock = (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      {/* Le raccourci n'est offert qu'au propriétaire : la section « Ma
          boutique » est marquée `ownerOnly` dans SettingsLayout, et un
          collaborateur y arriverait sur une page qu'il n'a pas le droit
          de voir. Pour lui, le logo reste ce qu'il était — une image.
          Rien n'est accordé ici qui ne le soit déjà. */}
      {workspace.isOwner ? (
        // Le bouton fait 44 pixels de haut — la cible tactile minimale,
        // imposée à tous les boutons sous 1024px — mais il est
        // transparent : la vignette de 40 carrés qu'il contient reste
        // exactement ce qu'on voyait avant. L'œil ne voit pas de bouton,
        // le doigt en trouve un.
        <button
          type="button"
          onClick={onOuvrirIdentiteBoutique}
          title="Logo, nom et coordonnées de la boutique"
          aria-label="Modifier l'identité de la boutique"
          className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 active:opacity-60"
        >
          {vignetteLogo}
        </button>
      ) : (
        <span className="shrink-0">{vignetteLogo}</span>
      )}

      {/* min-w-0 doit être présent sur CHAQUE niveau jusqu'au texte,
              sinon truncate n'a aucun effet et le bloc pousse les
              éléments voisins hors de l'écran. */}
      <div className="relative min-w-0 flex-1">
        <button
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          className="flex w-full min-w-0 items-center gap-2 hover:bg-muted/50 py-1 pl-1 pr-2 rounded-lg transition-colors group text-left"
        >
          {/* La deuxième ligne portait « Espace Fondateur » : une
              information qu'on apprend une fois et qu'on relisait toute
              la journée. Elle porte maintenant la trésorerie — la seule
              chose qu'un commerçant regarde vraiment plusieurs fois par
              jour.

              La place ne coûte rien : sous 1024 pixels ce bouton mesure
              déjà 44 pixels de haut, la taille minimale d'une cible
              tactile, et les deux lignes y tiennent. L'en-tête reste sur
              une seule rangée.

              Ni cadre, ni étiquette en capitales, ni vert : le vert est
              la couleur des actions, et un solde sain n'est pas une
              action. La couleur ne paraît que lorsqu'elle dit quelque
              chose — orange sous le seuil d'alerte, rouge à découvert. */}
          <div className="min-w-0 flex-1">
            <h1 className="coq-nom">
              <span className="truncate">{settings.storeName || marque.nom}</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            </h1>
            {ligneTresorerie}
          </div>
        </button>

        {menuEspaces}
      </div>
    </div>
  );

  // Version réduite affichée quand la sidebar est en mode icônes.
  const brandCompact = vignetteLogo;

  return (
    <>
      {!sansBarreLaterale && (
        <Sidebar
          groups={navGroups}
          activeTab={activeTab}
          badges={badgesNav}
          onTabClick={handleTabClick}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={onToggleSidebar}
          brand={brandBlock}
          brandCompact={brandCompact}
        />
      )}

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
        className={`app-bar-auto app-bar-haut coq-top sticky top-0 z-40${
          surPhoto ? ` sur-photo${enHautDePage ? " transparente" : ""}` : ""
        }`}
      >
        <div className={`coq-top-in${rechercheOuverte ? " recherche-ouverte" : ""}`}>
          {/* Sur téléphone : la marque, le nom et la trésorerie. Sur
              ordinateur, ils vivent dans la sidebar — sauf quand
              celle-ci est retirée (Paramètres) : ils reviennent ici. */}
          <div className={`coq-marque-zone${sansBarreLaterale ? "" : " lg:hidden"}`}>
            {brandMobile}
          </div>

          {/* La recherche ouvre l'écran courant — ou le catalogue depuis
              un écran qui n'a pas de liste — avec sa recherche déjà
              remplie : c'est le mécanisme des notifications
              (src/lib/cibleRecherche.ts), rien de plus.
              Sur ordinateur, c'est un champ. Sur téléphone, une icône :
              le champ se déplie par-dessus la barre quand on la touche. */}
          <form
            className="coq-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              lancerRecherche();
              setRechercheOuverte(false);
            }}
          >
            <Icone nom="search" />
            <input
              ref={champRecherche}
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRechercheOuverte(false);
              }}
              placeholder="Rechercher…"
              aria-label="Rechercher"
              aria-keyshortcuts={surMac ? "Meta+K" : "Control+K"}
              enterKeyHint="search"
            />
            <button
              type="button"
              className="coq-search-fermer"
              onClick={() => setRechercheOuverte(false)}
              aria-label="Fermer la recherche"
            >
              <X aria-hidden="true" />
            </button>
          </form>

          <div className="coq-tools">
            <button
              type="button"
              onClick={() => {
                setRechercheOuverte(true);
                requestAnimationFrame(() => champRecherche.current?.focus());
              }}
              className="coq-tool coq-tool-recherche"
              title="Rechercher"
              aria-label="Ouvrir la recherche"
            >
              <Icone nom="search" />
            </button>

            {/* Notifications */}
            <div className="relative" ref={zoneNotif}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className={`coq-tool${notifOpen ? " actif" : ""}`}
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="text-primary" />
                {nonVues > 0 && (
                  <span className="coq-badge" aria-label={`${nonVues} nouvelles notifications`}>
                    {nonVues > 9 ? "9+" : nonVues}
                  </span>
                )}
              </button>

              {notifOpen && (
                <PanneauNotifications
                  alertes={alertes}
                  activites={activites}
                  etats={etats}
                  nonLues={nonLues}
                  onToutMarquerLu={toutMarquerLu}
                  onOuvrir={ouvrirNotification}
                  onAction={onActionNotification}
                  onFermer={fermerNotif}
                />
              )}
            </div>

            {/* Le profil : avatar et menu. « Paramètres » n'y paraît que
                pour les propriétaires et les collaborateurs qui ont la
                permission « settings » — la règle de l'ancienne roue. */}
            <div className="relative" ref={zoneProfil}>
              <button
                type="button"
                onClick={() => setProfilOuvert(!profilOuvert)}
                className={`coq-profil${profilOuvert || activeTab === "settings" ? " actif" : ""}`}
                title={nomComplet || courriel || "Mon profil"}
                aria-label="Menu du profil"
                aria-haspopup="menu"
                aria-expanded={profilOuvert}
              >
                <span className="coq-avatar" aria-hidden="true">
                  <AvatarPersonne nom={nomAvatar} taille={32} />
                </span>
                <ChevronDown className="coq-profil-chev" aria-hidden="true" />
              </button>

              {profilOuvert && (
                <div className="coq-menu" role="menu" aria-label="Profil">
                  {nomAvatar && (
                    <div className="coq-menu-tete">
                      <AvatarPersonne nom={nomAvatar} taille={40} />
                      <div className="min-w-0">
                        {nomComplet && <div className="coq-menu-nom">{nomComplet}</div>}
                        {courriel && <div className="coq-menu-mail">{courriel}</div>}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="coq-menu-item"
                    onClick={() => {
                      setProfilOuvert(false);
                      if (onOuvrirMonCompte) {
                        onOuvrirMonCompte();
                        setMobileMenuOpen(false);
                        setNotifOpen(false);
                      } else handleTabClick("settings");
                    }}
                  >
                    <UserRound aria-hidden="true" />
                    Mon profil
                  </button>
                  {showSettings && (
                    <button
                      type="button"
                      role="menuitem"
                      className="coq-menu-item"
                      onClick={() => {
                        setProfilOuvert(false);
                        handleTabClick("settings");
                      }}
                    >
                      <Settings aria-hidden="true" />
                      Paramètres
                    </button>
                  )}
                  {/* L'aide de l'écran affiché. Elle avait son bouton dans
                      la barre ; la barre ne garde plus que la recherche,
                      la cloche et le profil. */}
                  <button
                    type="button"
                    role="menuitem"
                    className="coq-menu-item"
                    onClick={() => {
                      setProfilOuvert(false);
                      setAideOuverte(true);
                    }}
                  >
                    <HelpCircle aria-hidden="true" />
                    Aide sur cet écran
                  </button>
                  <div className="coq-menu-sep" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="coq-menu-item danger"
                    onClick={seDeconnecter}
                  >
                    <LogOut aria-hidden="true" />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
            <PanneauAide
              ouvert={aideOuverte}
              onFermer={() => setAideOuverte(false)}
              ecran={activeTab}
            />
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <MenuPlus
          groups={navGroups}
          activeTab={activeTab}
          badges={badgesNav}
          onTabClick={handleTabClick}
          onFermer={() => setMobileMenuOpen(false)}
        />
      )}
      {/* Mobile Bottom Navigation */}
      <nav
        data-masquee={barresMasquees}
        className="app-bar-auto app-bar-bas lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-[0_-4px_18px_rgba(38,58,50,0.07)]"
      >
        {/* Le nombre de colonnes suit le nombre de raccourcis. Il était
            figé à cinq : une boutique qui masquait un module laissait
            une colonne vide et voyait « Plus » se décaler vers la
            gauche au lieu de rester au bord. */}
        <div
          className="grid px-1 pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${bottomTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {/* L'onglet actif se marquait par un `scale-110` : l'icône et
              son libellé grossissaient, poussaient leurs voisins et la
              barre bougeait à chaque changement d'écran. C'est
              maintenant un filet vert au-dessus de l'onglet — la même
              convention que le menu latéral, tournée d'un quart de
              tour — et rien ne se déplace. */}
          {bottomTabs.map((tab) => {
            const estActif = activeTab === tab.id && !mobileMenuOpen;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                aria-current={estActif ? "page" : undefined}
                className={`app-onglet-bas ${estActif ? "text-primary" : "text-muted-foreground"}`}
              >
                {estActif && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
                )}
                {tab.icon}
                <span className="text-[10.5px] font-semibold">{tab.shortLabel}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            className={`app-onglet-bas ${mobileMenuOpen ? "text-primary" : "text-muted-foreground"}`}
          >
            {mobileMenuOpen && (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
            )}
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span className="text-[10.5px] font-semibold">Plus</span>
          </button>
        </div>
      </nav>

      {/* ── Créer une boutique ──
          Une boutique neuve et vide. Elle ne copie rien d'une autre
          boutique ; son ouverture suit le compte (voir plus haut). */}
      <Modal
        open={showCreateStoreModal}
        onClose={() => {
          setShowCreateStoreModal(false);
          setCreateStoreError(null);
        }}
        size="sm"
        icon={<Store className="h-4 w-4" />}
        title="Créer une boutique"
        description="Vous en devenez propriétaire."
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
          Une boutique neuve, indépendante des autres : ses produits, ventes, clients et réglages
          lui sont propres.
        </p>

        {messageAbonnement && (
          <p className={`mt-3 text-sm font-medium ${messageAbonnement.ton}`}>
            {messageAbonnement.texte}
          </p>
        )}

        <form onSubmit={handleCreateStore} id="create-store-form" className="mt-4 space-y-3">
          <input
            type="text"
            required
            autoFocus
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="Nom de la nouvelle boutique"
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
      {modaleConfirmation}
    </>
  );
};
