import React from "react";
import { Card, CardHeader } from "../components/Card";
import { Trend } from "../components/Trend";
import { argent, montant, montantEnDeux, nombre, montantMasque } from "../lib/format";
import type { ChiffresResultat } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 11. RÉSULTAT DU MOIS
 *
 * CETTE SOUSTRACTION N'EXISTAIT PAS. La page Bilan calcule la marge, pas
 * le bénéfice ; c'est le seul chiffre de cet écran qui soit vraiment
 * nouveau, et il est posé en équation plutôt qu'en total, pour qu'on
 * voie d'où il vient.
 *
 * LES ACHATS DE STOCK NE SONT PAS RETIRÉS, et la carte le dit. Ils ne
 * deviennent un coût qu'au moment où les produits se vendent, et ce
 * coût est déjà dans la marge — `total_vente − total_achat_ref`. Les
 * soustraire une seconde fois compterait deux fois la même
 * marchandise, et un mois de gros réapprovisionnement paraîtrait
 * catastrophique alors qu'il prépare le suivant.
 */
export const CarteResultat: React.FC<{
  resultat: ChiffresResultat;
  periode: Periode;
  visible: boolean;
  onDetail?: () => void;
}> = ({ resultat, periode, visible, onDetail }) => {
  const { marge, depenses, benefice, beneficePrecedent, achatsNonDeduits } = resultat;
  const sous = (v: number) => (visible ? montant(v) : montantMasque());

  const haut = Math.max(Math.abs(benefice), Math.abs(beneficePrecedent), 1);
  const part = (v: number) => Math.max(2, (Math.abs(v) / haut) * 100);

  const { chiffres, unite } = montantEnDeux(sous(benefice));

  return (
    <Card span={4} id="carte-resultat">
      <CardHeader
        title="Résultat"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 19V5M4 19h16" />
            <path d="M8 15l3-3 3 2 5-6" />
          </svg>
        }
      />

      <div className="eq">
        <div className="r">
          <span>Marge brute</span>
          <span className="lead" />
          <span className="num">{sous(marge)}</span>
        </div>
        <div className="r minus">
          <span>− Dépenses</span>
          <span className="lead" />
          <span className="num">{sous(depenses)}</span>
        </div>
      </div>

      <div className={`res${benefice < 0 ? " negatif" : ""}`}>
        <div>
          <small>
            = {benefice < 0 ? "Perte" : "Bénéfice"} · {periode.libelle}
          </small>
          <b className="num">
            {chiffres}
            {unite && <small>{unite}</small>}
          </b>
        </div>
        <Trend data={{ valeur: benefice, reference: beneficePrecedent }} />
      </div>

      <div className="cmp">
        <span>Période</span>
        <div className="bar">
          <i style={{ width: `${part(benefice)}%`, background: "var(--accent)" }} />
        </div>
        <span className="num">{visible ? argent(benefice) : "•••"}</span>
        <span>Avant</span>
        <div className="bar">
          <i style={{ width: `${part(beneficePrecedent)}%`, background: "var(--muted)" }} />
        </div>
        <span className="num">{visible ? argent(beneficePrecedent) : "•••"}</span>
      </div>

      <p style={{ margin: 0, color: "var(--muted)", fontSize: 12.5 }}>
        Les achats de stock ({sous(achatsNonDeduits)}) ne sont pas retirés&nbsp;: ils deviennent un
        coût quand les produits se vendent.
      </p>

      {onDetail && (
        <button
          className="link"
          type="button"
          onClick={onDetail}
          style={{ alignSelf: "flex-start" }}
        >
          Voir le détail du calcul
        </button>
      )}
    </Card>
  );
};
