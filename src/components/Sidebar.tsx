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
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
      {groups.map((group) => (
        <div key={group.title} className="mb-5 last:mb-0">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
          ) : (
            <div className="px-1 pb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </div>
          )}

          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-md py-2.5 text-sm transition-colors ${
                    collapsed ? "justify-center px-0" : "px-3"
                  } ${
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  {/* L'état actif se marque par un filet vertical et un
                      texte plus contrasté, pas par un aplat de couleur :
                      douze entrées surlignées en plein feraient une
                      colonne bariolée. */}
                  {isActive && (
                    <span className="absolute -left-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <span className={isActive ? "text-primary" : "opacity-80"}>{item.icon}</span>
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
