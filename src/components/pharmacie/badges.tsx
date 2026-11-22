import React from "react";
import { CalendarClock, FileWarning, Snowflake } from "lucide-react";
import {
  delaiLisible,
  REGIMES,
  urgence,
  type Conservation,
  type Regime,
  type Urgence,
} from "../../lib/pharmacie";

const TON: Record<Urgence, string> = {
  perime: "bg-danger-soft t-danger",
  un_mois: "bg-danger-soft t-danger",
  trois_mois: "bg-warning-soft t-warning",
  six_mois: "bg-info-soft t-info",
  plus_tard: "bg-muted text-muted-foreground",
  sans_date: "bg-muted text-muted-foreground",
};

/** La date de péremption, colorée selon l'urgence : « dans 12 j », « 03/2028 ». */
export const BadgePeremption: React.FC<{ date: string | null; aujourdhui: string }> = ({
  date,
  aujourdhui,
}) => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
      TON[urgence(date, aujourdhui)]
    }`}
  >
    <CalendarClock className="h-3 w-3" aria-hidden="true" />
    {delaiLisible(date, aujourdhui)}
  </span>
);

/** « Ordonnance », « Liste I »… rien pour la vente libre. */
export const BadgeRegime: React.FC<{ regime: Regime | null | undefined }> = ({ regime }) => {
  if (!regime || regime === "libre") return null;
  const r = REGIMES.find((x) => x.valeur === regime);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        regime === "stupefiant" ? "bg-danger-soft t-danger" : "bg-warning-soft t-warning"
      }`}
    >
      <FileWarning className="h-3 w-3" />
      {r?.court}
    </span>
  );
};

export const BadgeFroid: React.FC<{ conservation: Conservation | null | undefined }> = ({
  conservation,
}) =>
  conservation === "frais" ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-semibold t-info">
      <Snowflake className="h-3 w-3" />
      Au frais
    </span>
  ) : null;
