import React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ActiveTab } from "../types";
import type { NavGroup } from "./navigation";

interface SidebarProps {
  groups: NavGroup[];
  activeTab: ActiveTab;
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
 * La largeur (16rem ouverte / 4.5rem repliée) est reprise côté contenu
 * par les classes de décalage dans BalsamaApp.tsx — les deux doivent
 * rester cohérentes.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  activeTab,
  onTabClick,
  collapsed,
  onToggleCollapsed,
  brand,
  brandCompact,
}) => (
  <aside
    className={`fixed inset-y-0 left-0 z-50 hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex ${
      collapsed ? "w-18" : "w-64"
    } transition-[width] duration-200`}
  >
    {/* Marque */}
    <div
      className={`flex min-h-16 items-center border-b border-sidebar-border ${
        collapsed ? "justify-center px-2" : "px-3"
      }`}
    >
      {collapsed ? brandCompact : brand}
    </div>

    {/* Navigation */}
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
      {groups.map((group) => (
        <div key={group.title} className="mb-4 last:mb-0">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
          ) : (
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </div>
          )}

          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-0" : "px-3"
                  } ${
                    isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  {/* Barre d'accent : l'état actif ne repose pas uniquement
                      sur la couleur du texte, difficile à repérer d'un
                      coup d'œil dans une liste de douze entrées. */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                  )}
                  <span className={isActive ? "text-sidebar-primary" : ""}>{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    {/* Pied : repli en mode icônes.
        Les paramètres ne sont volontairement pas repris ici : ils vivent
        dans la barre du haut, aux côtés du thème et des notifications. */}
    <div className="border-t border-sidebar-border p-2">
      <button
        onClick={onToggleCollapsed}
        title={collapsed ? "Déplier le menu" : "Replier le menu"}
        aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground ${
          collapsed ? "justify-center px-0" : "px-3"
        }`}
      >
        {collapsed ? (
          <PanelLeftOpen className="w-4 h-4" />
        ) : (
          <PanelLeftClose className="w-4 h-4" />
        )}
        {!collapsed && <span className="truncate">Replier</span>}
      </button>
    </div>
  </aside>
);
