import React from "react";
import { Card } from "../components/Card";
import { montant, pourcent } from "../lib/format";
import { analyserTendance } from "../lib/tendance";
import type { ChiffresFlux } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 5. SORTIES — le ticket de caisse
 *
 * Achats et dépenses de la période, présentés comme ce qu'ils sont :
 * une addition. Le papier, les pointillés de conduite et le bord
 * déchiré ne sont pas de la décoration — ils disent au premier regard
 * qu'on additionne, là où une carte de plus se serait lue comme un
 * indicateur parmi d'autres.
 *
 * LE TAMPON NE SE COLORE PAS EN ROUGE. Acheter plus n'est ni bon ni
 * mauvais : c'est du stock qui change de forme. La règle vient de
 * l'application (`StatBar`), et elle vaut ici : une couleur qui se
 * trompe une fois sur deux ne s'écoute plus.
 */
export const CarteSorties: React.FC<{
  flux: ChiffresFlux;
  periode: Periode;
  achatsVisibles: boolean;
}> = ({ flux, periode, achatsVisibles }) => {
  const forme = analyserTendance({ valeur: flux.achats, reference: flux.achatsPrecedent });
  const tampon =
    forme.genre === "fois"
      ? `ACHATS ×${forme.facteur} VS PÉRIODE PRÉCÉDENTE`
      : forme.genre === "pourcent"
        ? `ACHATS ${forme.valeur > 0 ? "+" : "−"}${Math.abs(forme.valeur)} % VS PÉRIODE PRÉCÉDENTE`
        : forme.genre === "nouveau"
          ? "PREMIERS ACHATS DE LA PÉRIODE"
          : null;

  const principal = flux.depensesParPersonne[0];

  return (
    <Card span={4} id="carte-sorties" className="ticket-card">
      <div className="ticket">
        <div className="shopname">Sorties · {periode.libelle}</div>

        <div className="row">
          <span>Achats</span>
          <span className="lead" />
          <span className="num">{achatsVisibles ? montant(flux.achats) : "••• Ar"}</span>
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

        {tampon && <div className="stamp">{tampon}</div>}
      </div>
    </Card>
  );
};
