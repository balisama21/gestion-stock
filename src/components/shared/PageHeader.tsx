import React from "react";
import { titreAvecLibelle, usePersonnalisation } from "../../lib/personnalisation";

interface PageHeaderProps {
  /** Icône affichée à gauche du titre. */
  icon?: React.ReactNode;
  title: string;
  /**
   * La clé du module, quand la page en représente un. L'en-tête
   * remplace alors le nom prévu par celui que l'entreprise a choisi
   * — « Clients (3) » devient « Patients (3) » sans que l'écran ait
   * à recomposer son titre.
   */
  module?: string;
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
 *
 * L'icône se pose dans une tuile teintée, à gauche du titre ET de sa
 * phrase : l'en-tête tient ainsi sur une seule ligne avec ses actions.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  module,
  subtitle,
  actions,
  metric,
}) => {
  const perso = usePersonnalisation();
  const titre = module ? titreAvecLibelle(perso, module, title) : title;
  return (
    <div className="app-page-head">
      <div className="app-page-head-text">
        {icon && (
          <span className="app-page-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="app-page-title">{titre}</h2>
          {subtitle && <p className="app-page-subtitle">{subtitle}</p>}
        </div>
      </div>

      {(metric || actions) && (
        <div className="app-page-actions">
          {metric}
          {actions}
        </div>
      )}
    </div>
  );
};

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
  <div className="app-head-metric app-feuille">
    <div className="app-head-metric-label">{label}</div>
    <div className="text-right">
      <div className={`app-head-metric-value ${toneClass[tone]}`}>{value}</div>
      {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  </div>
);
