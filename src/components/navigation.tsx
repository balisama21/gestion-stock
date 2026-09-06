import React from "react";
import {
  TrendingUp,
  Wallet,
  ShoppingBag,
  CreditCard,
  User as UserIcon,
  Package,
  ShoppingCart,
  DollarSign,
  Users,
  ArrowRightLeft,
  Truck,
  Wrench,
  CalendarRange,
  History,
} from "lucide-react";
import type { ActiveTab } from "../types";

/**
 * Source unique de vérité de la navigation.
 *
 * Extrait de Header.tsx lors du passage à la sidebar : la sidebar
 * (desktop) et le menu bas (mobile) doivent afficher exactement les
 * mêmes onglets pour un même utilisateur. Dupliquer ces listes ferait
 * dériver les deux affichages à la première modification.
 */

export interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
}

export interface NavGroup {
  /** Titre de section affiché dans la sidebar. */
  title: string;
  items: NavItem[];
}

/**
 * Onglets regroupés par thème métier. L'ordre de ce tableau détermine
 * l'ordre d'affichage dans la sidebar comme dans le menu mobile.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: <TrendingUp className="w-4 h-4" /> },
      { id: "rapports", label: "Bilan", icon: <CalendarRange className="w-4 h-4" /> },
      { id: "historique", label: "Historique", icon: <History className="w-4 h-4" /> },
    ],
  },
  {
    title: "Ventes",
    items: [
      { id: "commandes", label: "Commandes", icon: <ShoppingBag className="w-4 h-4" /> },
      { id: "ventes", label: "Ventes", icon: <DollarSign className="w-4 h-4" /> },
      { id: "clients", label: "Clients", icon: <UserIcon className="w-4 h-4" /> },
      { id: "paiements", label: "Paiements à recevoir", icon: <CreditCard className="w-4 h-4" /> },
    ],
  },
  {
    title: "Stock",
    items: [
      { id: "produits", label: "Produits", icon: <Package className="w-4 h-4" /> },
      { id: "achats", label: "Achats", icon: <ShoppingCart className="w-4 h-4" /> },
      { id: "fournisseurs", label: "Fournisseurs", icon: <Truck className="w-4 h-4" /> },
      { id: "prestataires", label: "Prestataires", icon: <Wrench className="w-4 h-4" /> },
    ],
  },
  {
    title: "Finance",
    items: [
      { id: "capital", label: "Capital", icon: <Wallet className="w-4 h-4" /> },
      { id: "depenses", label: "Dépenses", icon: <ArrowRightLeft className="w-4 h-4" /> },
    ],
  },
  {
    title: "Équipe",
    items: [{ id: "vendeurs", label: "Vendeurs", icon: <Users className="w-4 h-4" /> }],
  },
];

/**
 * Onglets toujours visibles, même sans permission explicite : leur
 * CONTENU s'adapte (vue personnelle restreinte au lieu des données
 * globales de l'entreprise, voir BalsamaApp.tsx) plutôt que d'être
 * masqué. Comportement repris tel quel de l'ancien Header.
 */
export const ALWAYS_VISIBLE_TABS = ["dashboard", "capital", "ventes"];

/**
 * Filtre les groupes selon les permissions du membre.
 * `memberPermissions === null` = propriétaire → tous les onglets.
 * Les groupes devenus vides sont retirés pour ne pas laisser un titre
 * de section orphelin dans la sidebar.
 */
export function visibleNavGroups(memberPermissions: string[] | null): NavGroup[] {
  if (memberPermissions === null) return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => ALWAYS_VISIBLE_TABS.includes(item.id) || memberPermissions.includes(item.id),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Liste à plat des onglets visibles (menu mobile « Plus »). */
export function visibleNavItems(memberPermissions: string[] | null): NavItem[] {
  return visibleNavGroups(memberPermissions).flatMap((g) => g.items);
}

/** Raccourcis de la barre de navigation basse sur mobile. */
export const BOTTOM_TABS: { id: ActiveTab; shortLabel: string; icon: React.ReactNode }[] = [
  { id: "dashboard", shortLabel: "Accueil", icon: <TrendingUp className="w-5 h-5" /> },
  { id: "commandes", shortLabel: "Cmds", icon: <ShoppingBag className="w-5 h-5" /> },
  { id: "ventes", shortLabel: "Ventes", icon: <DollarSign className="w-5 h-5" /> },
  { id: "produits", shortLabel: "Stock", icon: <Package className="w-5 h-5" /> },
];

export function visibleBottomTabs(memberPermissions: string[] | null) {
  return BOTTOM_TABS.filter(
    (tab) =>
      memberPermissions === null ||
      ALWAYS_VISIBLE_TABS.includes(tab.id) ||
      memberPermissions.includes(tab.id),
  );
}

export function canSeeSettings(memberPermissions: string[] | null): boolean {
  return memberPermissions === null || memberPermissions.includes("settings");
}
