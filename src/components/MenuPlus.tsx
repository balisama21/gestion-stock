import React from "react";
import type { ActiveTab } from "../types";
import type { NavGroup } from "./navigation";

interface MenuPlusProps {
  groups: NavGroup[];
  activeTab: ActiveTab;
  onTabClick: (id: ActiveTab) => void;
  onFermer: () => void;
}

/**
 * Le sommaire de l'application, sur mobile.
 *
 * Il alignait treize boutons identiques sur deux colonnes. À 375
 * pixels, « Paiements à recevoir » s'y affichait « Paiements à re… », et
 * rien ne disait qu'un devis et un bilan ne sont pas la même sorte de
 * chose. Une grille de boutons égaux n'est pas une organisation.
 *
 * C'est maintenant une liste en une colonne, avec les mêmes sections que
 * le menu latéral — elles viennent de la même fonction, donc les deux ne
 * peuvent pas diverger. Les noms s'écrivent en entier.
 *
 * L'écran courant se marque comme dans le menu latéral : un filet vert
 * et un texte plus contrasté, jamais un aplat de couleur. Quinze entrées
 * dont une surlignée en plein feraient une page bariolée.
 */
export const MenuPlus: React.FC<MenuPlusProps> = ({ groups, activeTab, onTabClick, onFermer }) => (
  <>
    <div
      className="lg:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
      onClick={onFermer}
    />
    <div className="lg:hidden fixed bottom-[68px] left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-accent" />
      <nav aria-label="Tous les écrans" className="max-h-[60vh] overflow-y-auto px-3 pb-4 pt-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            <div className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </div>
            {group.items.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabClick(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors active:bg-muted ${
                    isActive ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <span className={isActive ? "text-primary" : "opacity-80"}>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  </>
);
