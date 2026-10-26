import React from "react";
import type { ActiveTab } from "../../types";
import type { NavItem } from "../navigation";

interface SousNavigationProps {
  /** L'écran affiché en ce moment. */
  actif: ActiveTab;
  /** Les écrans du même univers, déjà filtrés (voir `universDe`). */
  items: NavItem[];
  onChoisir: (id: ActiveTab) => void;
}

/**
 * La rangée qui relie les écrans d'un même univers.
 *
 * Depuis la caisse on atteint un devis, depuis le catalogue on atteint
 * les achats — sans repasser par le menu. C'est le mouvement que font
 * les grandes plateformes : garder une navigation courte, et ranger le
 * reste à l'intérieur de son univers plutôt que d'aligner dix-sept
 * entrées au même niveau.
 *
 * Deux choix d'affichage méritent leur explication :
 *
 * — pas d'icônes. Elles sont dans le menu, et le titre juste en dessous
 *   porte déjà celle de l'écran. Quatre de plus en rangée feraient du
 *   bruit et, à 375 pixels, feraient passer la rangée à la ligne. En
 *   texte seul, elle tient sur une ligne et se lit comme ce qu'elle
 *   est : une série d'onglets.
 * — l'écran courant se marque par un filet vert sous son nom, pas par
 *   un aplat. C'est la même convention que le menu latéral, où l'entrée
 *   active porte un filet et non un fond plein. Un filet gris court sous
 *   toute la rangée : elle se lit comme une barre d'onglets qui coiffe
 *   l'écran, et non comme des mots flottant au-dessus du titre.
 *
 * La rangée passe à la ligne si les mots sont longs — une boutique peut
 * renommer ses modules. Jamais de défilement horizontal.
 */
export const SousNavigation: React.FC<SousNavigationProps> = ({ actif, items, onChoisir }) => {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Écrans liés" className="app-sous-nav">
      {items.map((item) => {
        const estActif = item.id === actif;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChoisir(item.id)}
            aria-current={estActif ? "page" : undefined}
            className="app-sous-nav-item"
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};
