import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { Lead, TeteCarte } from "../components/Tn";
import { Trend } from "../components/Trend";
import { montant, montantMasque } from "../lib/format";
import type { ChiffresResultat } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * RÉSULTAT — marge brute moins dépenses, sur la période.
 *
 * Les achats de stock ne sont pas retirés : ils deviennent un coût quand
 * les produits se vendent, à travers la marge.
 */
export const CarteResultat: React.FC<{
  resultat: ChiffresResultat;
  periode: Periode;
  visible: boolean;
  onDetail?: () => void;
  onHistorique?: () => void;
}> = ({ resultat, periode, visible, onDetail, onHistorique }) => {
  const { marge, depenses, benefice, beneficePrecedent, achatsNonDeduits } = resultat;
  const sous = (v: number) => (visible ? montant(v) : montantMasque());

  return (
    <article className="card result" id="carte-resultat">
      <TeteCarte
        lead={<Lead nom="chart" />}
        titre="Résultat"
        action={
          <>
            <span className="date-chip">
              <Icone nom="calendar" />
              {periode.libelle}
            </span>
            {onHistorique && (
              <button type="button" className="btn soft rond" onClick={onHistorique}>
                Voir tout l&apos;historique
              </button>
            )}
          </>
        }
      />

      <div className={`rr${benefice < 0 ? " negatif" : ""}`}>
        <div className="l">
          <div className="big" aria-hidden="true">
            {benefice === 0 ? "Ø" : <Icone nom={benefice > 0 ? "trend" : "arrowdown"} />}
          </div>
          <div>
            <small>
              {benefice < 0 ? "Perte" : "Bénéfice"} · {periode.libelle}
            </small>
            <b className="v num">{sous(benefice)}</b>
            {visible && <Trend data={{ valeur: benefice, reference: beneficePrecedent }} />}
          </div>
        </div>
        <dl>
          <div>
            <dt>Marge brute</dt>
            <dd className="num">{sous(marge)}</dd>
          </div>
          <div>
            <dt>Dépenses</dt>
            <dd className="num">{sous(depenses)}</dd>
          </div>
        </dl>
      </div>

      <div className="note">
        <span className="i">
          <Icone nom="info" />
        </span>
        <div>
          Les achats de stock ({sous(achatsNonDeduits)}) ne sont pas retirés&nbsp;: ils deviennent
          un coût quand les produits se vendent.
          {onDetail && (
            <button type="button" className="note-lien" onClick={onDetail}>
              Voir le détail du calcul
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
