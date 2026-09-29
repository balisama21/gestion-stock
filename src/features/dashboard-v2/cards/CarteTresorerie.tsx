import React from "react";
import { IconeDuo } from "../../../components/shared/IconeDuo";
import { BoutonRepli } from "../components/BoutonRepli";
import { useRepli } from "../lib/repli";
import { argent, montant, nombre, montantMasque } from "../lib/format";
import type { CapitalSummary } from "../../../types";
import type { ChiffresFlux } from "../lib/chiffres";
import { Lead } from "../components/Tn";
import { illPortefeuille } from "../assets/images";

/**
 * TRÉSORERIE ACTUELLE — l'argent disponible, et d'où il vient.
 *
 * Le solde est celui de toute la boutique, depuis l'ouverture ; la barre
 * et ses deux montants, eux, suivent la période choisie. Le détail
 * reprend les six postes du calcul de `BalsamaApp` (capital initial,
 * apports, ventes encaissées, achats, dépenses, remboursements) : ils
 * retombent exactement sur le total affiché.
 */

const CLE_DETAIL = "tantana.dash.tresorerie-detail";

export const CarteTresorerie: React.FC<{
  capital: CapitalSummary;
  flux: ChiffresFlux;
  periode: string;
  duParLesClients: number;
  montantVisible: boolean;
}> = ({ capital, flux, periode, duParLesClients, montantVisible }) => {
  const solde = capital.tresorerieGlobaleActuelle;
  const entrees = flux.encaisse;
  const sorties = flux.sorties;
  const total = entrees + sorties;
  const partEntrees = total > 0 ? (entrees / total) * 100 : 0;

  const { replie, basculer } = useRepli(CLE_DETAIL, false);

  const sousLeSeuil = capital.seuilAlerteTresorerie > 0 && solde < capital.seuilAlerteTresorerie;

  /* Les six postes, dans l'ordre du calcul. Aucun n'est masqué à zéro :
     une ligne absente casserait l'addition que le lecteur refait de
     tête jusqu'au total. */
  const postes: { cle: string; libelle: string; signe: "+" | "−"; valeur: number }[] = [
    { cle: "initial", libelle: "Capital initial", signe: "+", valeur: capital.capitalInitial },
    { cle: "apports", libelle: "Apports en capital", signe: "+", valeur: capital.apportsTotal },
    {
      cle: "ventes",
      libelle: "Ventes encaissées",
      signe: "+",
      valeur: capital.ventesTotalEncaisse,
    },
    { cle: "achats", libelle: "Achats de stock", signe: "−", valeur: capital.achatsTotal },
    {
      cle: "depenses",
      libelle: "Dépenses vendeurs",
      signe: "−",
      valeur: capital.depensesVendeursTotal,
    },
    {
      cle: "remboursements",
      libelle: "Remboursements clients",
      signe: "−",
      valeur: capital.remboursementsTotal,
    },
  ];

  return (
    <article className="card tres" id="carte-tresorerie">
      <div className="in">
        <Lead nom="wallet" className="grand" />
        <div className="in-t">
          <b className="t">
            Trésorerie actuelle{" "}
            <span title="Toutes caisses confondues, depuis l'ouverture de la boutique">
              <IconeDuo nom="info" className="info" />
            </span>
          </b>
          <div className={`big num${solde < 0 ? " negatif" : ""}`}>
            {montantVisible ? montant(solde) : montantMasque()}
          </div>
          <div className={`st${sousLeSeuil ? " alerte" : ""}`}>
            {sousLeSeuil
              ? `Sous le seuil d'alerte de ${montant(capital.seuilAlerteTresorerie)}`
              : "Toutes caisses, depuis l'ouverture"}
          </div>
          <div
            className="prog"
            aria-label={`Entrées ${nombre(partEntrees)} %, sorties ${nombre(100 - partEntrees)} %`}
          >
            <i style={{ width: `${partEntrees}%` }} />
          </div>
          <div className="row2">
            <span>
              <i />
              Entrées {periode} <b>+{argent(entrees)}</b>
            </span>
            <span>
              <i className="r" />
              Sorties {periode}{" "}
              <b>
                {"−"}
                {argent(sorties)}
              </b>
            </span>
          </div>
        </div>
      </div>

      {/* Le détail n'a de sens que pour qui a le droit de voir le solde :
          le masquer au-dessus et le détailler en dessous reviendrait à le
          donner quand même. */}
      {montantVisible && (
        <div className="origin compo">
          <h4>
            <span className="ic">
              <IconeDuo nom="pie" />
            </span>
            D&apos;où vient ce solde ?
            <BoutonRepli
              replie={replie}
              onBasculer={basculer}
              quoi="le détail du solde"
              className="plier-mini"
            />
          </h4>

          {!replie && (
            <>
              <dl className="compo-liste">
                {postes.map((p) => (
                  <div key={p.cle} className={p.signe === "−" ? "moins" : undefined}>
                    <dt>
                      <i />
                      {p.libelle}
                    </dt>
                    <dd className="num">
                      {p.signe} {montant(p.valeur)}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="compo-total">
                <span>Trésorerie disponible</span>
                <b className="num">{montant(solde)}</b>
              </p>

              {duParLesClients > 0 && (
                <p className="compo-note">
                  <b className="num">{montant(duParLesClients)}</b> sont encore chez vos clients :
                  vendus, pas encore encaissés, donc pas dans ce solde.
                </p>
              )}
            </>
          )}
          <img className="wallet" src={illPortefeuille} alt="" />
        </div>
      )}
    </article>
  );
};
