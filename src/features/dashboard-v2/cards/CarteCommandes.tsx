import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { Lead, Lien, TeteCarte } from "../components/Tn";
import type { ChiffresCommandes } from "../lib/chiffres";
import { illCarton } from "../assets/images";

/**
 * SUIVI DES COMMANDES — où en sont les commandes clients, étape par étape.
 *
 * Une étape qui porte des commandes affiche leur nombre ; une étape vide,
 * le signe ∅. Quand rien n'est en cours, la première étape est cochée :
 * tout ce qui a été reçu est parti.
 */
export const CarteCommandes: React.FC<{
  commandes: ChiffresCommandes;
  onOuvrir?: () => void;
}> = ({ commandes, onOuvrir }) => {
  const etapes: { n: number; libelle: React.ReactNode }[] = [
    { n: commandes.recues, libelle: "Reçues" },
    {
      n: commandes.enPreparation,
      libelle: (
        <>
          En
          <br />
          préparation
        </>
      ),
    },
    {
      n: commandes.enLivraison,
      libelle: (
        <>
          En
          <br />
          livraison
        </>
      ),
    },
    {
      n: commandes.aEncaisser,
      libelle: (
        <>
          À<br />
          encaisser
        </>
      ),
    },
  ];
  const rien = commandes.total === 0;

  return (
    <article className="card" id="carte-commandes">
      <TeteCarte
        lead={<Lead nom="truck" />}
        titre="Suivi des commandes"
        className="h20"
        action={<Lien onClick={onOuvrir}>Tout voir</Lien>}
      />

      <div className="steps">
        {etapes.map((e, i) => {
          const fait = rien ? i === 0 : e.n > 0;
          return (
            <div className={`step${fait ? " done" : ""}`} key={i}>
              <i>{rien && i === 0 ? <Icone nom="check" /> : e.n > 0 ? e.n : "∅"}</i>
              {e.libelle}
            </div>
          );
        })}
      </div>

      <div className="okbar">
        {rien && <img className="art-carton" src={illCarton} alt="" />}
        <div className="c">
          <Icone nom={rien ? "check" : "bag"} />
        </div>
        <div>
          {rien ? (
            <>
              <b>Aucune commande en cours</b>
              <span>
                Tout est livré. Les nouvelles commandes apparaîtront ici, étape par étape.
              </span>
            </>
          ) : (
            <>
              <b>
                {commandes.total} commande{commandes.total > 1 ? "s" : ""} en cours
              </b>
              <span>
                {commandes.aEncaisser > 0
                  ? `dont ${commandes.aEncaisser} à encaisser`
                  : "Suivez chaque commande jusqu'à son encaissement."}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
