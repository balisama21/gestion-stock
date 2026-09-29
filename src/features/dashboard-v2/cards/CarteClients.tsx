import React from "react";
import { AvatarPersonne } from "../../../components/shared/AvatarPersonne";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { montant, nombre, montantMasque } from "../lib/format";
import type { ChiffresClients } from "../lib/chiffres";
import { illClients } from "../assets/images";

/**
 * CLIENTS — trois compteurs, et ceux qui doivent encore de l'argent.
 */
export const CarteClients: React.FC<{
  clients: ChiffresClients;
  visible: boolean;
  onRelancer?: (client: ChiffresClients["aRelancer"][number]) => void;
  /** Le panneau de tous les clients à relancer. */
  onTousARelancer?: () => void;
  onTous?: () => void;
}> = ({ clients, visible, onRelancer, onTousARelancer, onTous }) => {
  const aRelancer = clients.aRelancer.slice(0, 3);

  const compteur = (
    libelle: string,
    valeur: number,
    icone: NomIcone,
    ton: "orange" | "bleu" | "vert",
    onClick?: () => void,
  ) => (
    <button type="button" className={`it ${ton}`} onClick={onClick} disabled={!onClick}>
      <span className="b">
        <Icone nom={icone} />
      </span>
      <div>
        <small>{libelle}</small>
        <b className="v num">{nombre(valeur)}</b>
      </div>
      {onClick && <Icone nom="chevright" className="chev" />}
    </button>
  );

  return (
    <article className="card" id="carte-clients">
      <TeteCarte
        lead={<Lead nom="users" />}
        titre="Clients"
        action={<Lien onClick={onTous}>Tout voir</Lien>}
      />

      <div className="cli">
        <div className="list">
          {compteur(
            "À relancer",
            clients.aRelancer.length,
            "clock",
            "orange",
            clients.aRelancer.length > 0 ? onTousARelancer : undefined,
          )}
          {compteur("Nouveaux", clients.nouveaux, "userplus", "bleu", onTous)}
          {compteur("Actifs", clients.actifs, "usercheck", "vert", onTous)}
        </div>

        {aRelancer.length === 0 ? (
          <Vide
            image={illClients}
            largeur={260}
            titre="Aucun client à relancer"
            detail="Toutes les ventes et clients sont à jour."
          />
        ) : (
          <div className="people">
            <div className="sous-titre">À relancer</div>
            {aRelancer.map((c) => (
              <div className="person" key={c.id ?? c.nom}>
                <AvatarPersonne nom={c.nom} taille={38} className="ava" />
                <div className="info">
                  <b>{c.nom}</b>
                  <small>
                    Doit {visible ? montant(c.du) : montantMasque()} · depuis{" "}
                    {c.depuis <= 1 ? "1 jour" : `${nombre(c.depuis)} jours`}
                  </small>
                </div>
                {onRelancer && (
                  <button className="btn soft petit" type="button" onClick={() => onRelancer(c)}>
                    Relancer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};
