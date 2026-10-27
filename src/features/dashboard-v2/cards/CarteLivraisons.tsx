import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { Lead, Lien, TeteCarte } from "../components/Tn";
import { Tag } from "../components/Tag";
import { dateLocale, montant, montantMasque } from "../lib/format";
import { dateDuJour } from "../../../lib/dates";
import { estEnCours } from "../../../lib/livraisons";
import { IllLivraisons } from "../operations/Illustrations";

/**
 * LIVRAISONS — la tournée du jour, puis les suivantes.
 *
 * Seules les courses ouvertes comptent (la règle de la page Livraisons :
 * une course échouée est close). Chaque ligne ouvre la fiche de la
 * livraison quand l'application sait le faire.
 *
 * Le plan dessiné à droite pose un repère par course à venir, et le
 * camion roule quand l'une d'elles est en route.
 */

export interface LivraisonAffichee {
  id: string;
  destinataire: string;
  adresse?: string | null;
  statut: string;
  date_prevue?: string | null;
  montant_a_encaisser?: number;
  /** « L012 » : le numéro de la course. */
  numero?: string | null;
  /** La commande livrée, s'il y en a une. */
  order_id?: string | null;
}

/** Combien de courses la liste montre. */
const LIGNES = 3;

export const CarteLivraisons: React.FC<{
  livraisons: LivraisonAffichee[];
  visible: boolean;
  /** Les numéros des commandes, pour dire « Commande C021 ». */
  numerosCommandes?: Map<string, string>;
  onOuvrir?: () => void;
  /** Ouvrir la fiche d'une livraison. */
  onLivraison?: (id: string) => void;
}> = ({ livraisons, visible, numerosCommandes, onOuvrir, onLivraison }) => {
  const aujourdhui = dateDuJour();

  // La règle de la page Livraisons : une course échouée est close.
  const ouvertes = livraisons.filter(estEnCours);
  const duJour = ouvertes.filter((l) => l.date_prevue === aujourdhui);
  const aVenirToutes = ouvertes
    .filter((l) => l.date_prevue && l.date_prevue > aujourdhui)
    .sort((a, b) => (a.date_prevue ?? "").localeCompare(b.date_prevue ?? ""));
  // En retard : prévue avant aujourd'hui et toujours ouverte.
  const enRetard = ouvertes.filter((l) => l.date_prevue && l.date_prevue < aujourdhui);
  const liste = [...enRetard, ...duJour, ...aVenirToutes].slice(0, LIGNES);
  const enRoute = ouvertes.some((l) => l.statut === "en_cours");

  const aEncaisserDuJour = duJour.reduce((a, l) => a + (l.montant_a_encaisser ?? 0), 0);

  const nomDe = (l: LivraisonAffichee) => {
    const commande = l.order_id ? numerosCommandes?.get(l.order_id) : undefined;
    if (commande) return `Commande ${commande}`;
    if (l.numero) return `Livraison ${l.numero}`;
    return l.destinataire;
  };

  const etat = (l: LivraisonAffichee) => {
    if (l.statut === "en_cours") return <Tag ton="info">En route</Tag>;
    if (l.date_prevue && l.date_prevue < aujourdhui) return <Tag ton="crit">En retard</Tag>;
    return <Tag ton="ok">Prévue</Tag>;
  };

  const ligne = (l: LivraisonAffichee) => {
    const nom = nomDe(l);
    const contenu = (
      <>
        <span className={`op-puce${l.statut === "en_cours" ? " on" : ""}`} />
        <span className="op-txt">
          <b>{nom}</b>
          <small>
            {l.date_prevue
              ? l.date_prevue === aujourdhui
                ? "Aujourd'hui"
                : dateLocale(l.date_prevue).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
              : "Sans date"}
            {nom !== l.destinataire ? ` · ${l.destinataire}` : l.adresse ? ` · ${l.adresse}` : ""}
            {(l.montant_a_encaisser ?? 0) > 0 &&
              ` · ${visible ? montant(l.montant_a_encaisser ?? 0) : montantMasque()} à encaisser`}
          </small>
        </span>
        {etat(l)}
      </>
    );
    return onLivraison ? (
      <button
        type="button"
        className="op-ligne op-course"
        key={l.id}
        onClick={() => onLivraison(l.id)}
      >
        {contenu}
      </button>
    ) : (
      <div className="op-ligne op-course" key={l.id}>
        {contenu}
      </div>
    );
  };

  return (
    <article className="card op-carte" id="carte-livraisons">
      <TeteCarte
        lead={<Lead nom="truck" />}
        titre="Livraisons"
        className="h20"
        action={<Lien onClick={onOuvrir}>Tout voir</Lien>}
      />

      <div className="op-corps">
        <div className="op-contenu">
          <div className="op-message">
            <span className="c">
              <Icone nom={duJour.length === 0 ? "check" : "truck"} />
            </span>
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
          </div>

          {liste.length > 0 ? (
            <>
              <div className="op-label">Prochaines livraisons</div>
              <div className="op-liste serree">{liste.map(ligne)}</div>
            </>
          ) : (
            <p className="op-note">Aucune livraison planifiée pour les jours à venir.</p>
          )}
        </div>
        <div className="op-ill">
          <IllLivraisons
            duJour={duJour.length}
            aVenir={aVenirToutes.length + enRetard.length}
            enRoute={enRoute}
          />
        </div>
      </div>
    </article>
  );
};
