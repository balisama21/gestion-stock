import React from "react";
import { IconeDuo, type NomIcone } from "../../../components/shared/IconeDuo";
import { dateLocale, montant, montantMasque } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import type { ChiffresFlux } from "../lib/chiffres";

/**
 * LES QUATRE CHIFFRES DE L'ARGENT, sous la trésorerie : entrées et
 * sorties de la période, solde en caisse, et la dernière opération
 * enregistrée.
 */

const Mini: React.FC<{
  titre: string;
  valeur: React.ReactNode;
  note: React.ReactNode;
  noteVerte?: boolean;
  icone: NomIcone;
  ton: "vert" | "rouge";
  petit?: boolean;
  onClick?: () => void;
}> = ({ titre, valeur, note, noteVerte, icone, ton, petit, onClick }) => {
  const Racine = onClick ? "button" : "article";
  return (
    <Racine
      className="card mini"
      {...(onClick ? { type: "button" as const, onClick, "aria-label": titre } : {})}
    >
      <div className="h">
        <div className={`ib ${ton}`}>
          <IconeDuo nom={icone} />
        </div>
        <div className="mt">
          <h4>{titre}</h4>
          <div className={`v num${petit ? " petit" : ""}`}>{valeur}</div>
          <small className={noteVerte ? "vert" : undefined}>{note}</small>
        </div>
      </div>
      {onClick && <IconeDuo nom="chevright" className="chev" />}
    </Racine>
  );
};

export const CarteArgentMinis: React.FC<{
  flux: ChiffresFlux;
  periode: string;
  solde: number;
  /** La date de la dernière opération connue, et combien aujourd'hui. */
  derniere: { jour: string | null; aujourdhui: number };
  montantVisible: boolean;
  /** Quelles vignettes cette personne a le droit de voir. */
  avec: { entrees: boolean; sorties: boolean; solde: boolean; derniere: boolean };
  onEntrees?: () => void;
  onSorties?: () => void;
  onSolde?: () => void;
  onDerniere?: () => void;
}> = ({
  flux,
  periode,
  solde,
  derniere,
  montantVisible,
  avec,
  onEntrees,
  onSorties,
  onSolde,
  onDerniere,
}) => {
  const aujourdhui = dateDuJour();
  const sous = (v: number) => (montantVisible ? montant(v) : montantMasque());
  const dateDerniere = derniere.jour
    ? dateLocale(derniere.jour).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="g4 gap minis">
      {avec.entrees && (
        <Mini
          titre="Total des entrées"
          valeur={sous(flux.encaisse)}
          note={periode}
          icone="trend"
          ton="vert"
          onClick={onEntrees}
        />
      )}
      {avec.sorties && (
        <Mini
          titre="Total des sorties"
          valeur={montant(flux.sorties)}
          note={periode}
          icone="arrowdown"
          ton="rouge"
          onClick={onSorties}
        />
      )}
      {avec.solde && (
        <Mini
          titre="Solde en caisse"
          valeur={sous(solde)}
          note="Toutes caisses"
          icone="wallet"
          ton="vert"
          onClick={onSolde}
        />
      )}
      {avec.derniere && (
        <Mini
          titre="Dernière opération"
          valeur={dateDerniere}
          petit
          note={
            derniere.aujourdhui > 0
              ? `${derniere.aujourdhui} opération${derniere.aujourdhui > 1 ? "s" : ""} aujourd'hui`
              : derniere.jour === aujourdhui
                ? "Aujourd'hui"
                : "Aucune opération aujourd'hui"
          }
          noteVerte
          icone="calendar"
          ton="vert"
          onClick={onDerniere}
        />
      )}
    </div>
  );
};
