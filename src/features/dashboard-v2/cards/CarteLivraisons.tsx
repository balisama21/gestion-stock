import React from "react";
import { IconeDuo } from "../../../components/shared/IconeDuo";
import { Lead, Lien, TeteCarte } from "../components/Tn";
import { dateLocale, montant, montantMasque } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { illCamion } from "../assets/images";

/**
 * LIVRAISONS — la tournée du jour, puis les trois suivantes.
 */

export interface LivraisonAffichee {
  id: string;
  destinataire: string;
  adresse?: string | null;
  statut: string;
  date_prevue?: string | null;
  montant_a_encaisser?: number;
}

const ETATS: Record<string, string> = {
  a_preparer: "À préparer",
  en_cours: "En cours",
  livree: "Livrée",
  echouee: "Échouée",
  annulee: "Annulée",
};

export const CarteLivraisons: React.FC<{
  livraisons: LivraisonAffichee[];
  visible: boolean;
  onOuvrir?: () => void;
}> = ({ livraisons, visible, onOuvrir }) => {
  const aujourdhui = dateDuJour();

  const ouvertes = livraisons.filter((l) => l.statut !== "annulee" && l.statut !== "livree");
  const duJour = ouvertes.filter((l) => l.date_prevue === aujourdhui);
  const aVenir = ouvertes
    .filter((l) => l.date_prevue && l.date_prevue > aujourdhui)
    .sort((a, b) => (a.date_prevue ?? "").localeCompare(b.date_prevue ?? ""))
    .slice(0, 3);

  const aEncaisserDuJour = duJour.reduce((a, l) => a + (l.montant_a_encaisser ?? 0), 0);

  const arret = (l: LivraisonAffichee) => (
    <div className="stop" key={l.id}>
      <div className="dash">
        <b>{l.date_prevue ? Number(l.date_prevue.slice(8)) : "—"}</b>
        <small>
          {l.date_prevue
            ? dateLocale(l.date_prevue).toLocaleDateString("fr-FR", { month: "short" })
            : ""}
        </small>
      </div>
      <div className="txt">
        <b>{l.destinataire}</b>
        <span>
          {ETATS[l.statut] ?? l.statut}
          {l.adresse ? ` · ${l.adresse}` : ""}
        </span>
      </div>
      {(l.montant_a_encaisser ?? 0) > 0 && (
        <span className="num amt">
          {visible ? montant(l.montant_a_encaisser ?? 0) : montantMasque()}
        </span>
      )}
    </div>
  );

  return (
    <article className="card" id="carte-livraisons">
      <TeteCarte
        lead={<Lead nom="truck" />}
        titre="Livraisons"
        className="h20"
        action={<Lien onClick={onOuvrir}>Tout voir</Lien>}
      />

      <div className="deliv">
        <div className="c">
          <IconeDuo nom={duJour.length === 0 ? "check" : "truck"} />
        </div>
        <div>
          {duJour.length === 0 ? (
            <>
              <b>Aucune livraison aujourd&apos;hui</b>
              <span>Aucune commande client à livrer dans la journée.</span>
            </>
          ) : (
            <>
              <b>
                {duJour.length} livraison{duJour.length > 1 ? "s" : ""} aujourd&apos;hui
              </b>
              <span>
                {aEncaisserDuJour > 0
                  ? `${visible ? montant(aEncaisserDuJour) : montantMasque()} à encaisser`
                  : "Rien à encaisser à la livraison."}
              </span>
            </>
          )}
        </div>
        {duJour.length === 0 && aVenir.length === 0 && (
          <img className="art-camion" src={illCamion} alt="" />
        )}
      </div>

      {duJour.length > 0 && <div className="route">{duJour.map(arret)}</div>}

      {aVenir.length > 0 && (
        <>
          <div className="sous-titre">À venir</div>
          <div className="route">{aVenir.map(arret)}</div>
        </>
      )}
    </article>
  );
};
