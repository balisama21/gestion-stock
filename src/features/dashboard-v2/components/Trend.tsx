import React from "react";
import { pourcent } from "../lib/format";
import { analyserTendance, type Sens, type TendanceData } from "../lib/tendance";

/**
 * L'ÉVOLUTION CONTRE LA PÉRIODE PRÉCÉDENTE, en pastille.
 *
 * Le raisonnement vit dans `lib/tendance.ts` : il est partagé avec la
 * phrase de synthèse de l'en-tête, qui doit dire du même chiffre
 * exactement la même chose.
 */
export const Trend: React.FC<{ data: TendanceData; sens?: Sens; className?: string }> = ({
  data,
  sens = "hausse",
  className = "",
}) => {
  const forme = analyserTendance(data);
  if (forme.genre === "aucune") return null;

  if (forme.genre === "nouveau") {
    return <span className={`trend up ${className}`}>nouveau</span>;
  }
  if (forme.genre === "stable") {
    return <span className={`trend flat ${className}`}>stable</span>;
  }

  // `neutre` : la variation se dit, sans se colorer. Les achats en sont
  // le cas type — acheter plus n'est ni bon ni mauvais, c'est du stock
  // qui change de forme.
  const bon = sens === "neutre" ? null : forme.hausse === (sens === "hausse");
  const ton = bon === null ? "flat" : bon ? "up" : "down";
  const texte =
    forme.genre === "fois"
      ? `×${forme.facteur}`
      : `${forme.valeur > 0 ? "+" : "−"}${pourcent(Math.abs(forme.valeur))}`;

  return <span className={`trend ${ton} ${className}`}>{texte}</span>;
};
