import React, { useState } from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatErreur } from "../components/States";
import { dateLocale, jourEtMois, nombre } from "../lib/format";
import type { ChiffresStock } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 16. ENTRÉES & SORTIES DE STOCK
 *
 * Des barres de part et d'autre d'un zéro : ce qui entre monte, ce qui
 * sort descend. La forme dit le sens sans qu'on lise la légende, et une
 * journée d'inventaire se repère au premier coup d'œil.
 *
 * LA SOURCE EST `stock_movements`, une table que l'application ne lisait
 * pas jusqu'ici. Quand sa lecture ne rend rien — droits, ou boutique
 * dont les mouvements n'ont jamais été écrits — on retombe sur les
 * quantités des achats et des ventes, et la carte le dit. Ce repli est
 * moins fidèle : un inventaire corrigé à la main n'y figure pas.
 */

const W = 640;
const H = 200;
const MG = { gauche: 40, droite: 10, haut: 12, bas: 26 };

export const CarteMouvements: React.FC<{
  stock: ChiffresStock;
  periode: Periode;
  /**
   * Le message que la lecture de `stock_movements` a renvoyé.
   *
   * La carte le montre elle-même : une lecture refusée ne doit ni
   * passer inaperçue, ni emporter le reste de la page. Le repli sur
   * les achats et les ventes reste affiché dessous — mieux vaut un
   * chiffre approché et signalé qu'une carte vide.
   */
  erreur?: string | null;
  onReessayer?: () => void;
}> = ({ stock, periode, erreur, onReessayer }) => {
  const [survol, setSurvol] = useState<number | null>(null);

  const jours = stock.parJour;
  const max = Math.max(...jours.map((j) => Math.max(j.entrees, j.sorties)), 1);
  const entrees = jours.reduce((a, j) => a + j.entrees, 0);
  const sorties = jours.reduce((a, j) => a + j.sorties, 0);

  const milieu = MG.haut + (H - MG.haut - MG.bas) / 2;
  const moitie = (H - MG.haut - MG.bas) / 2;
  const hauteur = (v: number) => (v / max) * moitie;

  const pas = (W - MG.gauche - MG.droite) / Math.max(1, jours.length);
  const cx = (i: number) => MG.gauche + pas * (i + 0.5);
  const largeur = Math.min(14, pas * 0.55);

  const graduations = [max, max / 2, 0, -max / 2, -max];
  const reperes = jours
    .map((_, i) => i)
    .filter((i) => i === 0 || (i + 1) % 5 === 0 || i === jours.length - 1);

  const jourSurvole = survol != null ? jours[survol] : null;

  return (
    <Card span={8} secondary id="carte-mouvements">
      <CardHeader
        title="Entrées & sorties de stock"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3" />
          </svg>
        }
        action={
          stock.mouvementsEnRepli ? (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              d&apos;après les achats et les ventes
            </span>
          ) : undefined
        }
      />

      {erreur && <EtatErreur message={erreur} onReessayer={onReessayer} />}

      <div className="mvtot">
        <span>
          <i style={{ background: "var(--accent)" }} />
          Entrées <b>+{nombre(entrees)} u.</b>
        </span>
        <span>
          <i style={{ background: "var(--info)" }} />
          Sorties{" "}
          <b>
            {"−"}
            {nombre(sorties)} u.
          </b>
        </span>
        <span>
          Solde{" "}
          <b>
            {entrees - sorties >= 0 ? "+" : "−"}
            {nombre(Math.abs(entrees - sorties))} u.
          </b>
        </span>
      </div>

      <div className="mv chart">
        <div
          className={`tip${jourSurvole ? " on" : ""}`}
          style={
            jourSurvole && survol != null
              ? { left: `${(cx(survol) / W) * 100}%`, top: `${(milieu / H) * 100}%` }
              : undefined
          }
        >
          {jourSurvole && (
            <>
              {jourEtMois(dateLocale(jourSurvole.jour))} · entrées{" "}
              <b>+{nombre(jourSurvole.entrees)}</b> · sorties{" "}
              <b>
                {"−"}
                {nombre(jourSurvole.sorties)}
              </b>
            </>
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Entrées et sorties de stock par jour, ${periode.libelle}`}
          onMouseLeave={() => setSurvol(null)}
        >
          {graduations.map((v, i) => {
            const y = milieu - hauteur(v);
            return (
              <g key={i}>
                <line
                  x1={MG.gauche}
                  x2={W - MG.droite}
                  y1={y}
                  y2={y}
                  style={{ stroke: v === 0 ? "var(--line)" : "var(--line-2)" }}
                  strokeWidth="1"
                />
                <text x={MG.gauche - 8} y={y + 3.5} textAnchor="end">
                  {v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v))}`}
                </text>
              </g>
            );
          })}

          {jours.map((j, i) => (
            <g key={j.jour}>
              {j.entrees > 0 && (
                <rect
                  x={cx(i) - largeur / 2}
                  y={milieu - hauteur(j.entrees)}
                  width={largeur}
                  height={hauteur(j.entrees)}
                  rx="3"
                  style={{ fill: "var(--accent)" }}
                />
              )}
              {j.sorties > 0 && (
                <rect
                  x={cx(i) - largeur / 2}
                  y={milieu}
                  width={largeur}
                  height={hauteur(j.sorties)}
                  rx="3"
                  style={{ fill: "var(--info)" }}
                />
              )}
              <rect
                x={cx(i) - pas / 2}
                y={MG.haut}
                width={pas}
                height={H - MG.haut - MG.bas}
                fill="transparent"
                onMouseEnter={() => setSurvol(i)}
              />
            </g>
          ))}

          {reperes.map((i) => (
            <text key={i} x={cx(i)} y={H - 8} textAnchor="middle">
              {Number(jours[i].jour.slice(8))}
            </text>
          ))}
        </svg>
      </div>
    </Card>
  );
};
