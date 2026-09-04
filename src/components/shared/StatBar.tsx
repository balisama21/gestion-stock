import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface StatItem {
  key: string;
  label: string;
  value: string;
  /** Information secondaire, en gris sous le chiffre. */
  hint?: string;
  /** Icône fine et monochrome. Jamais de pastille colorée. */
  icon?: React.ReactNode;
  onClick?: () => void;
  /** Évolution vs période précédente, quand elle est calculable. */
  trend?: {
    percent: number;
    label: string;
    goodDirection?: "up" | "down";
    noBaseline?: boolean;
  };
  /**
   * Signale une valeur qui demande une action (stock bas, impayés).
   * Seul cas où une couleur entre dans la barre — et uniquement sur le
   * texte secondaire, jamais en fond.
   */
  alert?: boolean;
}

interface StatBarProps {
  items: StatItem[];
  /** Nombre de colonnes aux différents paliers. */
  className?: string;
}

const Trend: React.FC<{ trend: NonNullable<StatItem["trend"]> }> = ({ trend }) => {
  if (trend.noBaseline) {
    return <span className="text-xs text-muted-foreground">{trend.label}</span>;
  }
  const rounded = Math.round(trend.percent);
  const flat = rounded === 0;
  const up = trend.percent > 0;
  const good = flat ? null : up === ((trend.goodDirection ?? "up") === "up");
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {!flat && (
        <span className={`inline-flex items-center ${good ? "t-success" : "t-danger"}`}>
          <Icon className="h-3 w-3" />
          {Math.abs(rounded)} %
        </span>
      )}
      {flat && <span>stable</span>}
      <span>{trend.label}</span>
    </span>
  );
};

interface StatColProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Signale une valeur qui demande une action ; colore le seul texte. */
  alert?: boolean;
  /** Conservé pour compatibilité d'appel — sans effet visuel. */
  tone?: string;
  hintTone?: string;
  onClick?: () => void;
}

/**
 * Une colonne de la barre d'indicateurs, à utiliser directement quand la
 * liste des colonnes est conditionnelle (permissions) et se prête mal à
 * un tableau d'objets.
 *
 * `tone` et `hintTone` sont acceptés mais ignorés : la couleur de fond
 * et la pastille d'icône ont disparu avec le passage au style sobre.
 */
export const StatCol: React.FC<StatColProps> = ({
  label,
  value,
  hint,
  icon,
  alert,
  onClick,
}) => {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className="app-statbar-item"
    >
      <span className="app-statbar-label">
        {icon && <span className="shrink-0 opacity-70">{icon}</span>}
        <span className="truncate">{label}</span>
      </span>
      <span className="app-statbar-value truncate">{value}</span>
      {hint && <span className={`app-statbar-hint ${alert ? "t-warning" : ""}`}>{hint}</span>}
    </Wrapper>
  );
};

/**
 * Bande d'indicateurs compacte, à la manière des barres de statistiques
 * en haut des listes d'un ERP.
 *
 * Remplace la grille de cartes colorées : un seul bloc blanc, colonnes
 * séparées par un filet vertical, libellé gris en petit au-dessus et
 * chiffre en taille moyenne. Aucune pastille ni fond coloré — à cette
 * densité, la couleur décorative fatigue plus qu'elle n'aide.
 */
export const StatBar: React.FC<StatBarProps> = ({ items, className = "" }) => (
  <div
    className={`app-statbar grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 ${className}`}
  >
    {items.map((item) => {
      const Wrapper = item.onClick ? "button" : "div";
      return (
        <Wrapper
          key={item.key}
          {...(item.onClick ? { onClick: item.onClick, type: "button" as const } : {})}
          className="app-statbar-item"
        >
          <span className="app-statbar-label">
            {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </span>

          <span className="app-statbar-value truncate">{item.value}</span>

          {item.trend ? (
            <Trend trend={item.trend} />
          ) : (
            item.hint && (
              <span className={`app-statbar-hint ${item.alert ? "t-warning" : ""}`}>
                {item.hint}
              </span>
            )
          )}
        </Wrapper>
      );
    })}
  </div>
);
