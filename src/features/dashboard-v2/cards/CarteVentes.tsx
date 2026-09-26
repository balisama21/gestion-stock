import React, { useMemo, useState } from "react";
import { Card, CardHeader } from "../components/Card";
import { Trend } from "../components/Trend";
import { dateLocale, jourEtMois, montant, nombre, montantMasque } from "../lib/format";
import { versAffichage } from "../../../lib/affichageDevise";
import type { ChiffresVentes } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";
import { decalerJours } from "../hooks/useDashboardPeriod";

/**
 * 2. VENTES — la courbe cumulée
 *
 * SVG écrit à la main, sans bibliothèque. La maquette en fait autant, et
 * pour une courbe à deux tracés, une librairie de graphiques pèserait
 * plus lourd que tout le reste de l'écran.
 *
 * POURQUOI LE CUMUL ET NON LES VENTES DU JOUR. Une boutique qui vend
 * trois cent mille ariary un dimanche et rien les six jours suivants
 * donne, en barres quotidiennes, un pic et six trous — on lit
 * l'irrégularité, pas la marche du mois. Le cumul monte toujours : sa
 * pente dit le rythme, et la comparer à celle du mois précédent dit si
 * l'on est devant ou derrière.
 *
 * L'ÉCHELLE SUIT LES DONNÉES. La maquette plafonnait à 500 000, le
 * montant de son objectif d'exemple ; aucun objectif n'existe en base,
 * l'axe se cale donc sur le plus haut des deux cumuls, arrondi au
 * palier supérieur pour que les graduations tombent juste.
 */

const W = 640;
const H = 250;
const MG = { gauche: 48, droite: 14, haut: 14, bas: 28 };

/** Un palier rond au-dessus du maximum : 1, 2, 5 × une puissance de dix. */
function palier(max: number): number {
  if (max <= 0) return 1000;
  const dix = Math.pow(10, Math.floor(Math.log10(max)));
  for (const facteur of [1, 2, 2.5, 5, 10]) {
    if (facteur * dix >= max) return facteur * dix;
  }
  return 10 * dix;
}

/** « 120 k », « 1,2 M » — les graduations, dites court. */
function court(brut: number): string {
  const v = versAffichage(brut);
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (v >= 1000) return `${Math.round(v / 1000)} k`;
  return nombre(v);
}

export const CarteVentes: React.FC<{
  ventes: ChiffresVentes;
  periode: Periode;
  montantVisible: boolean;
  /** « Mes ventes » quand la portée est limitée au lecteur. */
  titre?: string;
  onDetails?: () => void;
}> = ({ ventes, periode, montantVisible, titre, onDetails }) => {
  const [survol, setSurvol] = useState<number | null>(null);

  /**
   * Les jours dessinés.
   *
   * Pour « Ce mois », on trace le mois ENTIER et on ombre ce qui reste :
   * la courbe s'arrête à aujourd'hui, et la place vide dit qu'il reste
   * des jours pour la faire monter. Pour les autres périodes, l'axe
   * s'arrête où la période s'arrête.
   */
  const { jours, coupureIndex } = useMemo(() => {
    const dessines = ventes.cumul.map((c) => c.jour);
    if (periode.cle !== "month" || dessines.length === 0) {
      return { jours: dessines, coupureIndex: dessines.length - 1 };
    }
    const fin = dateLocale(periode.intervalle.fin);
    const dernier = new Date(fin.getFullYear(), fin.getMonth() + 1, 0).getDate();
    const complet = [...dessines];
    let suivant = periode.intervalle.fin;
    while (complet.length < dernier) {
      suivant = decalerJours(suivant, 1);
      complet.push(suivant);
    }
    return { jours: complet, coupureIndex: dessines.length - 1 };
  }, [ventes.cumul, periode]);

  const max = palier(
    Math.max(ventes.cumul.at(-1)?.cumule ?? 0, ventes.cumulPrecedent.at(-1)?.cumule ?? 0, 1),
  );

  const n = Math.max(1, jours.length - 1);
  const x = (i: number) => MG.gauche + (i / n) * (W - MG.gauche - MG.droite);
  const y = (v: number) => MG.haut + (1 - v / max) * (H - MG.haut - MG.bas);

  const trace = (points: [number, number][]) =>
    points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  const courbe = ventes.cumul.map((c, i) => [x(i), y(c.cumule)] as [number, number]);
  const precedente = ventes.cumulPrecedent.map((c, i) => [x(i), y(c.cumule)] as [number, number]);

  const graduations = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const reperes = jours
    .map((_, i) => i)
    .filter((i) => i === 0 || (i + 1) % 5 === 0 || i === jours.length - 1);

  const finCourbe = courbe.at(-1);
  const point = survol != null ? ventes.cumul[survol] : null;

  return (
    <Card span={7} id="carte-ventes">
      <CardHeader
        title={titre ?? `Ventes · ${periode.libelle}`}
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 17l6-6 4 4 8-8" />
          </svg>
        }
        action={
          onDetails && (
            <button className="link" type="button" onClick={onDetails}>
              Détails
            </button>
          )
        }
      />

      <div className="kpi-row">
        <span className="v num">{montantVisible ? montant(ventes.total) : montantMasque()}</span>
        <Trend data={{ valeur: ventes.total, reference: ventes.totalPrecedent }} />
        <span className="c">
          vs {periode.libellePrecedent} ({montantVisible ? montant(ventes.totalPrecedent) : "•••"})
        </span>
      </div>

      <div className="chart">
        <div
          className={`tip${point ? " on" : ""}`}
          style={
            point && survol != null
              ? { left: `${(x(survol) / W) * 100}%`, top: `${(y(point.cumule) / H) * 100}%` }
              : undefined
          }
        >
          {point && (
            <>
              {jourEtMois(dateLocale(point.jour))} · jour <b>{montant(point.duJour)}</b>
              <br />
              cumul <b>{montant(point.cumule)}</b>
            </>
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Cumul des ventes, ${periode.libelle}, comparé à ${periode.libellePrecedent}`}
          onMouseLeave={() => setSurvol(null)}
        >
          <defs>
            <linearGradient id="dash2-aire" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {graduations.map((v) => (
            <g key={v}>
              <line
                x1={MG.gauche}
                x2={W - MG.droite}
                y1={y(v)}
                y2={y(v)}
                style={{ stroke: "var(--line-2)" }}
                strokeWidth="1"
              />
              <text x={MG.gauche - 8} y={y(v) + 3.5} textAnchor="end">
                {court(v)}
              </text>
            </g>
          ))}

          {reperes.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle">
              {Number(jours[i].slice(8))}
            </text>
          ))}

          {/* Ce qui reste du mois : une zone sourde, pas un vide. */}
          {coupureIndex < jours.length - 1 && (
            <>
              <rect
                x={x(coupureIndex)}
                y={MG.haut}
                width={W - MG.droite - x(coupureIndex)}
                height={H - MG.haut - MG.bas}
                style={{ fill: "var(--surface-2)" }}
                opacity="0.6"
              />
              <text x={x(coupureIndex) + 8} y={MG.haut + 14} textAnchor="start">
                reste du mois
              </text>
            </>
          )}

          {precedente.length > 1 && (
            <path
              d={trace(precedente)}
              fill="none"
              style={{ stroke: "var(--muted)" }}
              strokeWidth="1.6"
              strokeDasharray="5 4"
            />
          )}

          {courbe.length > 1 && finCourbe && (
            <>
              <path
                d={`${trace(courbe)} L${finCourbe[0]} ${y(0)} L${courbe[0][0]} ${y(0)} Z`}
                style={{ fill: "url(#dash2-aire)" }}
              />
              <path
                d={trace(courbe)}
                fill="none"
                style={{ stroke: "var(--accent)" }}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <circle
                cx={finCourbe[0]}
                cy={finCourbe[1]}
                r="5"
                style={{ fill: "var(--accent)", stroke: "var(--surface)" }}
                strokeWidth="2.5"
              />
            </>
          )}

          {survol != null && (
            <>
              <line
                x1={x(survol)}
                x2={x(survol)}
                y1={MG.haut}
                y2={H - MG.bas}
                style={{ stroke: "var(--muted)" }}
                strokeWidth="1"
              />
              <circle
                cx={x(survol)}
                cy={y(ventes.cumul[survol].cumule)}
                r="4"
                style={{ fill: "var(--surface)", stroke: "var(--accent)" }}
                strokeWidth="2"
              />
            </>
          )}

          {/* Une bande invisible par jour : le survol n'a pas à viser la courbe. */}
          {ventes.cumul.map((c, i) => (
            <rect
              key={c.jour}
              x={x(i) - (W - MG.gauche - MG.droite) / (2 * n)}
              y={MG.haut}
              width={(W - MG.gauche - MG.droite) / n}
              height={H - MG.haut - MG.bas}
              fill="transparent"
              onMouseEnter={() => setSurvol(i)}
            />
          ))}
        </svg>
      </div>

      <div className="legend">
        <span>
          <i />
          Cumul · {periode.libelle}
        </span>
        <span>
          <i className="dash" />
          Cumul · {periode.libellePrecedent}
        </span>
      </div>
    </Card>
  );
};
