import React from "react";

interface PageHeaderProps {
  /** Icône affichée à gauche du titre. */
  icon?: React.ReactNode;
  title: string;
  /**
   * Une phrase courte, en langage utilisateur, qui dit à quoi sert la
   * page. Optionnelle : mieux vaut pas de sous-titre qu'un sous-titre
   * qui décrit le fonctionnement interne du logiciel.
   */
  subtitle?: string;
  /**
   * Boutons d'action (Nouveau…, Exporter…). Sur mobile ils passent en
   * pleine largeur sous le titre, jamais tronqués sur le côté.
   */
  actions?: React.ReactNode;
  /** Indicateur chiffré facultatif affiché avant les actions. */
  metric?: React.ReactNode;
}

/**
 * En-tête de page commun à toutes les vues.
 *
 * Le bloc titre porte `min-w-0` et le titre `truncate` : un nom long ne
 * peut donc jamais pousser les boutons d'action hors de l'écran, ce qui
 * était la cause des boutons coupés sur mobile.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
  metric,
}) => (
  <div className="app-page-head">
    <div className="app-page-head-text">
      <h2 className="app-page-title">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{title}</span>
      </h2>
      {subtitle && <p className="app-page-subtitle">{subtitle}</p>}
    </div>

    {(metric || actions) && (
      <div className="app-page-actions">
        {metric}
        {actions}
      </div>
    )}
  </div>
);

interface HeaderMetricProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}

const toneClass: Record<NonNullable<HeaderMetricProps["tone"]>, string> = {
  success: "t-success",
  warning: "t-warning",
  danger: "t-danger",
  info: "t-info",
  neutral: "text-foreground",
};

/** Petit indicateur chiffré à poser dans `metric` de PageHeader. */
export const HeaderMetric: React.FC<HeaderMetricProps> = ({
  label,
  value,
  hint,
  tone = "neutral",
}) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/70 px-3 py-2 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className="text-right">
      <div className={`font-mono text-base font-bold tabular-nums ${toneClass[tone]}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  </div>
);
