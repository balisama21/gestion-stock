import React, { useState } from "react";
import { LeadImage, TeteCarte } from "../components/Tn";
import { EtatErreur } from "../components/States";
import { dateLocale, jourEtMois, nombre } from "../lib/format";
import type { ChiffresStock } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";
import { leadEntreesSorties } from "../assets/images";

/**
 * ENTRÉES & SORTIES DE STOCK — les unités entrées, sorties, et leur solde,
 * jour par jour sur la période.
 *
 * La source est `stock_movements` ; quand la table ne rend rien, les
 * quantités sont reconstituées à partir des achats et des ventes (le
 * sous-titre le dit).
 */

const W = 590;
const H = 170;
const G = 44;
const D = 580;
const HAUT = 20;
const BAS = 120;

const signe = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "+");

export const CarteMouvements: React.FC<{
  stock: ChiffresStock;
  periode: Periode;
  /** Le choix de période, posé dans l'en-tête de la carte. */
  selecteur?: React.ReactNode;
  erreur?: string | null;
  onReessayer?: () => void;
}> = ({ stock, periode, selecteur, erreur, onReessayer }) => {
  const [survol, setSurvol] = useState<number | null>(null);

  const jours = stock.parJour;
  const entrees = jours.reduce((a, j) => a + j.entrees, 0);
  const sorties = jours.reduce((a, j) => a + j.sorties, 0);
  const solde = entrees - sorties;

  const max = Math.max(
    1,
    ...jours.map((j) => Math.max(j.entrees, j.sorties, Math.abs(j.entrees - j.sorties))),
  );
  const milieu = (HAUT + BAS) / 2;
  const Y = (v: number) => milieu - (v / max) * ((BAS - HAUT) / 2);
  const pas = jours.length > 1 ? (D - 20 - (G + 20)) / (jours.length - 1) : 0;
  const X = (i: number) => (jours.length > 1 ? G + 20 + pas * i : (G + D) / 2);
  const ligne = (f: (j: (typeof jours)[number]) => number) =>
    jours.map((j, i) => `${X(i)},${Y(f(j))}`).join(" ");
  const pasLibelle = Math.max(1, Math.ceil(jours.length / 7));
  const jourSurvole = survol != null ? jours[survol] : null;
  const graduation = (v: number) => (v === 0 ? "0" : `${signe(v)}${nombre(Math.abs(v))}`);

  return (
    <article className="card" id="carte-mouvements">
      <TeteCarte
        lead={<LeadImage src={leadEntreesSorties} largeur={38} />}
        titre="Entrées & sorties de stock"
        sous={stock.mouvementsEnRepli ? "D'après les achats et les ventes" : undefined}
        action={selecteur}
      />

      {erreur && <EtatErreur message={erreur} onReessayer={onReessayer} />}

      <div className="io">
        <div>
          <span>
            <i className="vert" />
            Entrées
          </span>
          <b className="num">+{nombre(entrees)} u.</b>
        </div>
        <div>
          <span>
            <i className="bleu" />
            Sorties
          </span>
          <b className="num bleu">−{nombre(sorties)} u.</b>
        </div>
        <div>
          <span>
            <i className="gris" />
            Solde
          </span>
          <b className="num">
            {signe(solde)}
            {nombre(Math.abs(solde))} u.
          </b>
        </div>
      </div>

      <div className="legend">
        <span>
          <i className="vert" />
          Entrées
        </span>
        <span>
          <i className="bleu" />
          Sorties
        </span>
        <span>
          <i className="gris" />
          Solde
        </span>
        {jourSurvole && (
          <span className="survol num">
            {jourEtMois(dateLocale(jourSurvole.jour))} · +{nombre(jourSurvole.entrees)} · −
            {nombre(jourSurvole.sorties)}
          </span>
        )}
      </div>

      <svg
        className="mvchart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Entrées et sorties de stock par jour, ${periode.libelle}`}
        onMouseLeave={() => setSurvol(null)}
      >
        {[max, 0, -max].map((v) => (
          <g key={v}>
            <line x1={G} x2={D} y1={Y(v)} y2={Y(v)} className="grille" />
            <text x={G - 10} y={Y(v) + 4} textAnchor="end" className="axe">
              {graduation(v)}
            </text>
          </g>
        ))}
        <polyline points={ligne((j) => j.entrees)} className="l-vert" />
        <polyline points={ligne((j) => -j.sorties)} className="l-bleu" />
        <polyline points={ligne((j) => j.entrees - j.sorties)} className="l-gris" />
        {jours.map((j, i) => (
          <g key={j.jour}>
            {j.entrees > 0 && <circle cx={X(i)} cy={Y(j.entrees)} r="3.5" className="p-vert" />}
            {j.sorties > 0 && <circle cx={X(i)} cy={Y(-j.sorties)} r="3.5" className="p-bleu" />}
            <circle cx={X(i)} cy={Y(j.entrees - j.sorties)} r="3.5" className="p-gris" />
            <rect
              x={X(i) - Math.max(pas, 20) / 2}
              y={HAUT - 10}
              width={Math.max(pas, 20)}
              height={BAS - HAUT + 20}
              fill="transparent"
              onMouseEnter={() => setSurvol(i)}
            />
            {(i % pasLibelle === 0 || i === jours.length - 1) && (
              <text x={X(i)} y={H - 20} textAnchor="middle" className="axe">
                {jourEtMois(dateLocale(j.jour))}
              </text>
            )}
          </g>
        ))}
      </svg>
    </article>
  );
};
