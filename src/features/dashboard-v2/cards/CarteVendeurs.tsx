import React from "react";
import { AvatarPersonne } from "../../../components/shared/AvatarPersonne";
import { Lead, Lien, TeteCarte, Vide } from "../components/Tn";
import { montant, montantMasque } from "../lib/format";
import type { Seller } from "../../../types";
import { illTrophee } from "../assets/images";
import { collaborateurs } from "../../../lib/vendeurs";

/**
 * CLASSEMENT VENDEURS — le solde net que chacun a en poche.
 *
 * La barre donne la part de chacun dans le total des soldes positifs.
 *
 * Le responsable n'y figure pas : ce qu'il encaisse est déjà dans sa
 * caisse. Sans équipe, la carte ne classe personne — elle invite à en
 * former une.
 */

export const CarteVendeurs: React.FC<{
  vendeurs: Seller[];
  montantsVisibles: boolean;
  onGerer?: () => void;
}> = ({ vendeurs, montantsVisibles, onGerer }) => {
  const equipe = collaborateurs(vendeurs);
  const classement = [...equipe]
    .filter((v) => v.totalVentesMontant > 0 || v.soldeNetEnPoche !== 0)
    .sort((a, b) => b.soldeNetEnPoche - a.soldeNetEnPoche)
    .slice(0, 5);

  const total = classement.reduce((a, v) => a + Math.max(0, v.soldeNetEnPoche), 0);

  return (
    <article className="card rank" id="carte-vendeurs">
      <TeteCarte
        lead={<Lead nom="trophy" />}
        titre="Classement vendeurs"
        action={<Lien onClick={onGerer}>{equipe.length === 0 ? "Inviter" : "Gérer"}</Lien>}
      />

      {equipe.length === 0 ? (
        <Vide
          image={illTrophee}
          largeur={184}
          titre="Pas encore d'équipe"
          detail="Vous vendez seul : votre argent est déjà en caisse. Invitez un vendeur pour suivre ici ce qu'il encaisse et ce qu'il doit vous remettre."
          action={
            onGerer && (
              <button type="button" className="link" onClick={onGerer}>
                Inviter un vendeur
              </button>
            )
          }
        />
      ) : classement.length === 0 ? (
        <Vide
          image={illTrophee}
          largeur={184}
          titre="Aucune activité de vente"
          detail="Les soldes apparaîtront dès la première vente enregistrée."
        />
      ) : (
        classement.map((v, i) => {
          const part = total > 0 ? Math.round((Math.max(0, v.soldeNetEnPoche) / total) * 100) : 0;
          return (
            <div className={`rw${i === 0 ? " first" : ""}`} key={v.id}>
              <AvatarPersonne nom={v.nom} taille={50} className="ava" />
              <div className="nm">
                <b>{v.nom}</b>
                <small>
                  {montantsVisibles
                    ? `Ventes ${montant(v.totalVentesMontant)} · Dép. ${montant(v.totalDepenses)}`
                    : "Solde net en poche"}
                </small>
              </div>
              <div className="am num">
                {montantsVisibles ? montant(v.soldeNetEnPoche) : montantMasque()}
              </div>
              <div className="pc">
                <div className="bar">
                  <i style={{ width: `${Math.max(part, v.soldeNetEnPoche > 0 ? 2 : 0)}%` }} />
                </div>
                <span>{part}%</span>
              </div>
            </div>
          );
        })
      )}
    </article>
  );
};
