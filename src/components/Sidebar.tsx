import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import "./coquille.css";
import type { ActiveTab } from "../types";
import type { NavGroup } from "./navigation";
import { BadgeNav } from "./shared/BadgeNav";

interface SidebarProps {
  groups: NavGroup[];
  activeTab: ActiveTab;
  /** Ce qui réclame l'attention, par onglet. Zéro ou absent = rien. */
  badges?: Partial<Record<ActiveTab, number>>;
  onTabClick: (id: ActiveTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Bloc marque (logo + nom de boutique + sélecteur d'espace). */
  brand: React.ReactNode;
  /** Version réduite de la marque, affichée en mode icônes. */
  brandCompact: React.ReactNode;
}

/**
 * Navigation latérale fixe (desktop uniquement, à partir de 768px).
 *
 * Remplace l'ancienne barre d'onglets horizontale qui débordait dès
 * qu'une boutique avait accès à plus de huit onglets. Sur mobile, cette
 * sidebar n'est jamais montée : la navigation basse reste la seule.
 *
 * La largeur (268 px ouverte / 4.5rem repliée) est reprise côté contenu
 * par les classes de décalage dans BalsamaApp.tsx — les deux doivent
 * rester cohérentes.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  activeTab,
  badges,
  onTabClick,
  collapsed,
  onToggleCollapsed,
  brand,
  brandCompact,
}) => (
  <aside
    className={`coq-side fixed inset-y-0 left-0 z-50 hidden shrink-0 flex-col lg:flex ${
      collapsed ? "w-18 replie" : "w-[268px]"
    } transition-[width] duration-200`}
  >
    {/* Marque : logo rond, nom de la boutique, trésorerie */}
    <div className={`coq-shop ${collapsed ? "justify-center" : ""}`}>
      {collapsed ? brandCompact : brand}
    </div>

    <nav className="coq-nav flex-1 overflow-y-auto overflow-x-hidden">
      {groups.map((group) => (
        <div key={group.title} className="coq-groupe">
          {collapsed ? (
            <div className="mx-auto my-3 h-px w-6 bg-sidebar-border" />
          ) : (
            <div className="coq-nav-h">{group.title}</div>
          )}

          {group.items.map((item) => {
            const isActive = activeTab === item.id;
            const badge = badges?.[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabClick(item.id)}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={`coq-lien${isActive ? " on" : ""}${collapsed ? " seul" : ""}`}
              >
                <span className="relative flex">
                  {item.icon}
                  {collapsed && badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && badge > 0 && (
                  <BadgeNav compte={badge} libelle={`${item.label} en retard`} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>

    {/* Pied : repli en mode icônes. Les paramètres vivent dans la barre
        du haut, aux côtés du thème et des notifications. */}
    <div className="coq-fold">
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? "Déplier le menu" : "Replier le menu"}
        aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        className={`coq-lien${collapsed ? " seul" : ""}`}
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        {!collapsed && <span className="truncate">Replier</span>}
      </button>
    </div>
  </aside>
);
