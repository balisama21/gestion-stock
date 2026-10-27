import React from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { Lead, Lien, TeteCarte } from "../components/Tn";
import type { ChiffresCommandes } from "../lib/chiffres";
import { IllCommandes } from "../operations/Illustrations";

/**
 * SUIVI DES COMMANDES — où en sont les commandes clients, étape par étape.
 *
 * Les quatre étapes sont celles de l'application : reçue (en attente),
 * en préparation (en cours), en livraison (course en cours), à encaisser
 * (reste à payer). Une étape qui porte des commandes s'allume et affiche
 * leur nombre ; un clic mène aux commandes concernées. Rien n'est coché
 * pour faire joli : une étape vide reste grise.
 *
 * L'atelier dessiné à droite pose sur sa table autant de cartons qu'il y
 * a de commandes reçues ou en préparation.
 */

export type EtapeCommande = "recues" | "enPreparation" | "enLivraison" | "aEncaisser";

const ETAPES: { cle: EtapeCommande; libelle: React.ReactNode; icone: NomIcone; nom: string }[] = [
  { cle: "recues", libelle: "Reçues", icone: "check", nom: "Reçues" },
  {
    cle: "enPreparation",
    libelle: (
      <>
        En
        <br />
        préparation
      </>
    ),
    icone: "box",
    nom: "En préparation",
  },
  {
    cle: "enLivraison",
    libelle: (
      <>
        En
        <br />
        livraison
      </>
    ),
    icone: "truck",
    nom: "En livraison",
  },
  {
    cle: "aEncaisser",
    libelle: (
      <>
        À<br />
        encaisser
      </>
    ),
    icone: "card",
    nom: "À encaisser",
  },
];

const s = (n: number) => (n > 1 ? "s" : "");

export const CarteCommandes: React.FC<{
  commandes: ChiffresCommandes;
  onOuvrir?: () => void;
  /** Ouvrir les commandes d'une étape : la page, déjà filtrée. */
  onEtape?: (etape: EtapeCommande) => void;
}> = ({ commandes, onOuvrir, onEtape }) => {
  const rien = commandes.total === 0;
  const aPreparer = commandes.recues + commandes.enPreparation;

  // Le message dit l'étape la plus pressante, avec ses vrais nombres.
  let titre: string;
  let detail: string;
  let icone: NomIcone = "bag";
  if (rien) {
    titre = "Aucune commande en cours";
    detail = "Tout est livré. Les nouvelles commandes apparaîtront ici, étape par étape.";
    icone = "check";
  } else if (commandes.enPreparation > 0) {
    titre = `${commandes.enPreparation} commande${s(commandes.enPreparation)} en cours de préparation`;
    detail =
      commandes.recues > 0
        ? `et ${commandes.recues} reçue${s(commandes.recues)} à préparer.`
        : "Les produits sont préparés pour l'expédition.";
    icone = "box";
  } else if (commandes.recues > 0) {
    titre = `${commandes.recues} commande${s(commandes.recues)} reçue${s(commandes.recues)} à préparer`;
    detail = "Passez-les en préparation depuis la page Commandes.";
  } else if (commandes.enLivraison > 0) {
    titre = `${commandes.enLivraison} livraison${s(commandes.enLivraison)} en route`;
    detail = "Suivez chaque course depuis la page Livraisons.";
    icone = "truck";
  } else {
    titre = `${commandes.aEncaisser} commande${s(commandes.aEncaisser)} à encaisser`;
    detail = "Suivez chaque commande jusqu'à son encaissement.";
    icone = "card";
  }
  if (!rien && commandes.aEncaisser > 0 && icone !== "card") {
    detail = `${detail} Dont ${commandes.aEncaisser} à encaisser.`;
  }

  return (
    <article className="card op-carte" id="carte-commandes">
      <TeteCarte
        lead={<Lead nom="bag" />}
        titre="Suivi des commandes"
        className="h20"
        action={<Lien onClick={onOuvrir}>Tout voir</Lien>}
      />

      <div className="op-corps">
        <div className="op-contenu">
          <div className="op-etapes">
            {ETAPES.map((e) => {
              const n = commandes[e.cle];
              const contenu = (
                <>
                  <i>
                    <Icone nom={e.icone} />
                    {n > 0 && <span className="op-badge num">{n}</span>}
                  </i>
                  <small>{e.libelle}</small>
                </>
              );
              const classe = `op-etape${n > 0 ? " on" : ""}`;
              return onEtape ? (
                <button
                  type="button"
                  key={e.cle}
                  className={classe}
                  onClick={() => onEtape(e.cle)}
                  aria-label={`${e.nom} : ${n} commande${s(n)}`}
                >
                  {contenu}
                </button>
              ) : (
                <div key={e.cle} className={classe}>
                  {contenu}
                </div>
              );
            })}
          </div>

          <div className="op-message">
            <span className="c">
              <Icone nom={icone} />
            </span>
            <div>
              <b>{titre}</b>
              <span>{detail}</span>
            </div>
            {onOuvrir && !rien && (
              <button type="button" className="btn soft petit" onClick={onOuvrir}>
                Voir les commandes
                <Icone nom="chevright" />
              </button>
            )}
          </div>
        </div>
        <div className="op-ill">
          <IllCommandes aPreparer={aPreparer} enPreparation={commandes.enPreparation} />
        </div>
      </div>
    </article>
  );
};
