import React from "react";

/**
 * LA CARTE, ET SON EN-TÊTE
 *
 * Toutes les cartes du tableau de bord ont la même forme : un titre en
 * petites capitales grises à gauche, une action facultative à droite,
 * puis le contenu. Le style vit dans `dashboard.css` (`.card`, `.ch`) —
 * ici on ne décrit que la structure.
 *
 * `secondary` marque les cartes que le mode focus masque. Ce n'est pas
 * un jugement sur leur utilité : ce sont celles qu'on consulte, par
 * opposition à celles qu'on surveille.
 */

export interface CardProps {
  /** Largeur dans la grille de douze colonnes. */
  span?: 4 | 5 | 6 | 7 | 8 | 12;
  /** Masquée par le mode focus. */
  secondary?: boolean;
  /**
   * Sert d'ancre : une puce d'attention fait défiler jusqu'à la carte
   * qui porte cet identifiant, puis la fait clignoter.
   */
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLElement, CardProps>(function Card(
  { span = 4, secondary = false, id, className = "", style, children },
  ref,
) {
  return (
    <article
      ref={ref}
      id={id}
      style={style}
      className={`card s${span}${secondary ? " secondary" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </article>
  );
});

export interface CardHeaderProps {
  title: string;
  /** Icône fine et monochrome, à gauche du titre. */
  icon?: React.ReactNode;
  /** Bouton ou étiquette, à droite. */
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, icon, action }) => (
  <div className="ch">
    <h2>
      {icon}
      {title}
    </h2>
    {action}
  </div>
);
