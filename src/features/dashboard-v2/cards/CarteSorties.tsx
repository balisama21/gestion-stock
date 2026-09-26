import React from "react";
import { Card } from "../components/Card";
import { montant, pourcent, montantMasque } from "../lib/format";
import type { ChiffresFlux } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 5. SORTIES — le ticket de caisse
 *
 * Achats et depenses de la periode, presentes comme ce qu'ils sont :
 * une addition. Le papier, les pointilles de conduite et le bord
 * dechire disent « recu » avant qu'on ait lu le titre.
 *
 * C'EST LA SEULE CARTE QUI GARDE UN HABILLAGE A ELLE. La refonte les
 * avait toutes ramenees au blanc ; vu a l'ecran, cette exception a
 * ete conservee a la demande.
 *
 * LA COMPARAISON AVEC LA PERIODE PRECEDENTE, elle, est partie pour de
 * bon : elle s'affichait en tampon incline sous le total, et c'etait
 * la seule information de cette carte qui ne soit pas un montant de
 * la periode en cours.
 */
export const CarteSorties: React.FC<{
  flux: ChiffresFlux;
  periode: Periode;
  achatsVisibles: boolean;
}> = ({ flux, periode, achatsVisibles }) => {
  const principal = flux.depensesParPersonne[0];

  return (
    <Card span={4} id="carte-sorties" className="ticket-card">
      <div className="ticket">
        <div className="shopname">Sorties · {periode.libelle}</div>

        <div className="row">
          <span>Achats</span>
          <span className="lead" />
          <span className="num">{achatsVisibles ? montant(flux.achats) : montantMasque()}</span>
        </div>
        <div className="row">
          <span>Dépenses</span>
          <span className="lead" />
          <span className="num">{montant(flux.depenses)}</span>
        </div>

        {principal && (
          <div className="row">
            <small>dont {principal.nom}</small>
            <span className="lead" />
            <small>{montant(principal.montant)}</small>
          </div>
        )}
        <div className="row">
          <small>Moyenne / jour</small>
          <span className="lead" />
          <small>{montant(flux.sortiesParJour)}</small>
        </div>
        <div className="row">
          <small>Part des ventes</small>
          <span className="lead" />
          <small>{pourcent(flux.partDesVentes)}</small>
        </div>

        <div className="row total">
          <span>TOTAL</span>
          <span className="lead" />
          <span>{achatsVisibles ? montant(flux.sorties) : montant(flux.depenses)}</span>
        </div>
      </div>
    </Card>
  );
};
