import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Tone } from "./MobileCardList";

export interface Trend {
  /** Évolution en pourcentage vs la période précédente. */
  percent: number;
  /** Ce à quoi on compare, ex. « vs mois dernier ». */
  label: string;
  /**
   * Sens « positif » de la hausse. Une hausse du chiffre d'affaires est
   * bonne, une hausse des dépenses ne l'est pas : sans ce réglage, les
   * deux s'afficheraient en vert.
   */
  goodDirection?: "up" | "down";
  /**
   * Vrai quand la période précédente était vide : le pourcentage n'a
   * alors aucun sens et on affiche « nouveau » à la place.
   */
  noBaseline?: boolean;
}

interface StatTileProps {
  /** Libellé discret, au-dessus du montant. */
  label: string;
  /** Donnée principale : c'est l'élément le plus fort visuellement. */
  value: string;
  /** Information secondaire sous le montant (nombre de lignes, marge…). */
  hint?: string;
  hintTone?: Tone;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Rend la tuile cliquable, avec élévation au survol. */
  onClick?: () => void;
  /** Évolution vs période précédente, quand elle est calculable. */
  trend?: Trend;
  /** Pastille d'alerte discrète en coin (stock bas, commandes en cours…). */
  flag?: boolean;
}

const toneText: Record<Tone, string> = {
  success: "t-success",
  warning: "t-warning",
  danger: "t-danger",
  info: "t-info",
  violet: "t-violet",
  neutral: "text-foreground",
};

const toneIconBg: Record<Tone, string> = {
  success: "bg-success-soft border-success-border t-success",
  warning: "bg-warning-soft border-warning-border t-warning",
  danger: "bg-danger-soft border-danger-border t-danger",
  info: "bg-info-soft border-info-border t-info",
  violet: "bg-violet-soft border-violet-border t-violet",
  neutral: "bg-muted border-border text-muted-foreground",
};

/**
 * Tuile d'indicateur chiffré.
 *
 * Hiérarchie volontaire : libellé discret en petit → montant dominant →
 * information secondaire colorée. Toutes les tuiles de l'application
 * partagent cette structure pour que l'œil trouve toujours le chiffre
 * important au même endroit.
 */
const TrendBadge: React.FC<{ trend: Trend }> = ({ trend }) => {
  if (trend.noBaseline) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" />
        {trend.label}
      </span>
    );
  }

  const rounded = Math.round(trend.percent);
  const flat = rounded === 0;
  const up = trend.percent > 0;
  const good = flat ? null : up === ((trend.goodDirection ?? "up") === "up");
  const cls = flat ? "text-muted-foreground" : good ? "t-success" : "t-danger";
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {flat ? "stable" : `${up ? "+" : ""}${rounded} %`}
      <span className="font-normal text-muted-foreground">{trend.label}</span>
    </span>
  );
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon,
  tone = "neutral",
  onClick,
  trend,
  flag,
}) => {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={`${onClick ? "app-card-interactive" : "app-card"} relative w-full p-4 text-left sm:p-5 lg:p-6`}
    >
      {flag && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-warning" aria-hidden />
      )}

      {/* Hiérarchie : libellé discret → montant dominant → contexte. */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneIconBg[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        className={`mt-2.5 font-mono text-xl font-bold tabular-nums sm:text-2xl lg:text-[1.75rem] lg:leading-tight ${toneText[tone]}`}
      >
        {value}
      </div>

      {(hint || trend) && (
        <div className="mt-1.5 space-y-1">
          {trend && <TrendBadge trend={trend} />}
          {hint && <div className={`text-xs font-medium ${toneText[hintTone]}`}>{hint}</div>}
        </div>
      )}
    </Wrapper>
  );
};
