import React from "react";
import { Card } from "../components/Card";
import { montant, nombre } from "../lib/format";
import type { CapitalSummary } from "../../../types";
import type { ChiffresFlux } from "../lib/chiffres";

/**
 * 1. TRÉSORERIE — le portefeuille
 *
 * LE CHIFFRE N'EST PAS RECALCULÉ. Il vient de `computedCapital`
 * (`BalsamaApp.tsx`), celui-là même qu'affiche la barre latérale. Deux
 * calculs pour un seul solde finiraient par diverger d'un arrondi, et
 * personne ne saurait lequel croire.
 *
 * LA BARRE ENTRÉES / SORTIES est une PART, pas une échelle. Elle dit
 * quelle proportion du mouvement du mois est entrée et quelle
 * proportion est sortie ; elle ne dit rien du solde, qui est écrit
 * au-dessus en toutes lettres.
 */
export const CarteTresorerie: React.FC<{
  capital: CapitalSummary;
  flux: ChiffresFlux;
  /** Le libellé de la période, pour dater les flux de la barre. */
  periode: string;
  /** « ••• Ar » quand la personne n'a pas le droit de voir le solde. */
  montantVisible: boolean;
}> = ({ capital, flux, periode, montantVisible }) => {
  const solde = capital.tresorerieGlobaleActuelle;
  const entrees = flux.encaisse;
  const sorties = flux.sorties;
  const total = entrees + sorties;
  const partEntrees = total > 0 ? (entrees / total) * 100 : 0;

  const texte = montantVisible ? montant(solde) : "••• Ar";
  const coupe = texte.lastIndexOf("\u00a0");
  const chiffre = coupe > 0 ? texte.slice(0, coupe) : texte;
  const unite = coupe > 0 ? texte.slice(coupe + 1) : "";

  const sousLeSeuil = capital.seuilAlerteTresorerie > 0 && solde < capital.seuilAlerteTresorerie;

  return (
    <Card span={5} id="carte-tresorerie" className="wallet">
      <div className="ch">
        <h2>Trésorerie · argent disponible</h2>
        <div className="puce" aria-hidden="true" />
      </div>

      <div>
        <div className="big num">
          {chiffre}
          {unite && <small>{unite}</small>}
        </div>
        <div className={`sub${sousLeSeuil ? " alerte" : ""}`}>
          {sousLeSeuil
            ? `Sous le seuil d'alerte de ${montant(capital.seuilAlerteTresorerie)}`
            : "Solde de toutes les caisses"}
        </div>
      </div>

      <div className="flow">
        <div
          className="flowbar"
          aria-label={`Entrées ${nombre(partEntrees)} %, sorties ${nombre(100 - partEntrees)} %`}
        >
          <i style={{ width: `${partEntrees}%`, background: "#7BE0B5" }} />
          <i style={{ width: `${100 - partEntrees}%`, background: "#F4B69A" }} />
        </div>
        <div className="flowleg">
          <span>
            <i className="dot" style={{ background: "#7BE0B5" }} />
            Entrées {periode} <b>+{nombre(entrees)}</b>
          </span>
          <span>
            <i className="dot" style={{ background: "#F4B69A" }} />
            Sorties{" "}
            <b>
              {"−"}
              {nombre(sorties)}
            </b>
          </span>
        </div>
      </div>
    </Card>
  );
};
