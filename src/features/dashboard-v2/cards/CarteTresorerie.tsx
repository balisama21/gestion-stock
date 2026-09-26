import React from "react";
import { Card } from "../components/Card";
import { BoutonRepli } from "../components/BoutonRepli";
import { useRepli } from "../lib/repli";
import { argent, montant, montantEnDeux, nombre, montantMasque } from "../lib/format";
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
 * quelle proportion du mouvement de la période est entrée et quelle
 * proportion est sortie ; elle ne dit rien du solde, qui est écrit
 * au-dessus en toutes lettres.
 *
 * ── LE DÉTAIL DU SOLDE, ajouté parce que le solde seul ne s'explique pas ──
 *
 * Le gros chiffre sort d'une addition de six postes dont aucun
 * n'apparaissait à l'écran. On les pose donc dans l'ORDRE EXACT du
 * calcul, avec les libellés de l'écran Capital : deux endroits qui
 * expliquent le même chiffre doivent le dire avec les mêmes mots.
 *
 * IL ARRIVE OUVERT, contrairement au calendrier et au journal. Ceux-là
 * sont des contenus qu'on déplie à l'occasion ; celui-ci est la réponse
 * à la question que pose la carte. Le replier reste un clic, et le
 * choix se retient.
 *
 * DEUX HORIZONS COHABITENT sur cette carte, et c'était le second piège :
 * le solde court depuis l'ouverture de la boutique, la barre ne couvre
 * que la période choisie. Chacun le dit maintenant sous son chiffre.
 */

/** Se souvient que le détail a été replié. Ouvert par défaut. */
const CLE_DETAIL = "tantana.dash.tresorerie-detail";

export const CarteTresorerie: React.FC<{
  capital: CapitalSummary;
  flux: ChiffresFlux;
  /** Le libellé de la période, pour dater les flux de la barre. */
  periode: string;
  /**
   * Ce que les clients doivent encore, crédits récents et retards
   * confondus. Ce n'est PAS un poste du solde — cet argent n'est
   * justement pas en caisse — mais c'est la question qu'on se pose en
   * voyant une trésorerie plus basse que ses ventes.
   */
  duParLesClients: number;
  /** « ••• Ar » quand la personne n'a pas le droit de voir le solde. */
  montantVisible: boolean;
}> = ({ capital, flux, periode, duParLesClients, montantVisible }) => {
  const solde = capital.tresorerieGlobaleActuelle;
  const entrees = flux.encaisse;
  const sorties = flux.sorties;
  const total = entrees + sorties;
  const partEntrees = total > 0 ? (entrees / total) * 100 : 0;

  const { replie, basculer } = useRepli(CLE_DETAIL, false);

  const { chiffres, unite } = montantEnDeux(montantVisible ? solde : montantMasque());

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
    <Card span={5} id="carte-tresorerie" className="wallet">
      <div className="ch">
        <h2>Trésorerie · argent disponible</h2>
        <div className="puce" aria-hidden="true" />
      </div>

      <div>
        <div className="big num">
          {chiffres}
          {unite && <small>{unite}</small>}
        </div>
        <div className={`sub${sousLeSeuil ? " alerte" : ""}`}>
          {sousLeSeuil
            ? `Sous le seuil d'alerte de ${montant(capital.seuilAlerteTresorerie)}`
            : "Toutes caisses, depuis l'ouverture"}
        </div>
      </div>

      {/* Le détail n'a de sens que pour qui a le droit de voir le solde :
          le masquer au-dessus et le détailler en dessous reviendrait à le
          donner quand même. */}
      {montantVisible && (
        <div className="compo">
          <div className="compo-tete">
            <h3>D&apos;où vient ce solde ?</h3>
            <BoutonRepli replie={replie} onBasculer={basculer} quoi="le détail du solde" />
          </div>

          {!replie && (
            <>
              <dl className="compo-liste">
                {postes.map((p) => (
                  <div key={p.cle}>
                    <dt>{p.libelle}</dt>
                    <dd className="num">
                      {p.signe} {montant(p.valeur)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="compo-total">
                <span>Trésorerie disponible</span>
                <b className="num">{montant(solde)}</b>
              </div>

              {duParLesClients > 0 && (
                <p className="compo-note">
                  <b className="num">{montant(duParLesClients)}</b> sont encore chez vos clients :
                  vendus, pas encore encaissés, donc pas dans ce solde.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flow">
        <div
          className="flowbar"
          aria-label={`Entrées ${nombre(partEntrees)} %, sorties ${nombre(100 - partEntrees)} %`}
        >
          <i style={{ width: `${partEntrees}%`, background: "var(--flux-entrees)" }} />
          <i style={{ width: `${100 - partEntrees}%`, background: "var(--flux-sorties)" }} />
        </div>
        <div className="flowleg">
          <span>
            <i className="dot" style={{ background: "var(--flux-entrees)" }} />
            Entrées {periode} <b>+{argent(entrees)}</b>
          </span>
          <span>
            <i className="dot" style={{ background: "var(--flux-sorties)" }} />
            Sorties {periode}{" "}
            <b>
              {"−"}
              {argent(sorties)}
            </b>
          </span>
        </div>
      </div>
    </Card>
  );
};
