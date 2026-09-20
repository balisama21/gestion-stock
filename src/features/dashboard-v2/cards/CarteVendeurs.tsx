import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { montant, nombre } from "../lib/format";
import type { Seller } from "../../../types";
import { teinteDe } from "../../../lib/teintes";

/**
 * 7. CLASSEMENT DES VENDEURS
 *
 * LE SOLDE N'EST PAS RECALCULÉ : `soldeNetEnPoche`, tel que
 * `BalsamaApp` le calcule pour toute l'application — encaissé, moins
 * les dépenses, moins ce qui a été remis, moins les avances prises sur
 * la caisse. Le refaire ici, c'est se préparer à deux chiffres pour un
 * seul vendeur.
 *
 * LA COULEUR DE L'AVATAR VIENT DU NOM, pas du hasard : la même personne
 * garde la même couleur d'un chargement à l'autre, et de la liste au
 * détail. Une teinte tirée au sort à chaque rendu se lit comme une
 * information et n'en est pas une.
 *
 * LA BARRE EST RELATIVE AU PREMIER, non à un total : on lit un
 * classement, pas une part de marché.
 */

export const CarteVendeurs: React.FC<{
  vendeurs: Seller[];
  montantsVisibles: boolean;
  onGerer?: () => void;
}> = ({ vendeurs, montantsVisibles, onGerer }) => {
  const classement = [...vendeurs]
    .filter((v) => v.totalVentesMontant > 0 || v.soldeNetEnPoche !== 0)
    .sort((a, b) => b.soldeNetEnPoche - a.soldeNetEnPoche)
    .slice(0, 5);

  const tete = classement[0]?.soldeNetEnPoche ?? 0;

  return (
    <Card span={4} id="carte-vendeurs">
      <CardHeader
        title="Classement vendeurs"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
        }
        action={
          onGerer && (
            <button className="link" type="button" onClick={onGerer}>
              Gérer
            </button>
          )
        }
      />

      {classement.length === 0 ? (
        <EtatVide
          titre="Aucune activité de vente"
          detail="Les soldes apparaîtront dès la première vente enregistrée."
        />
      ) : (
        <div className="board">
          {classement.map((v, i) => {
            const teinte = teinteDe(v.nom);
            const part = tete > 0 ? Math.max(2, (v.soldeNetEnPoche / tete) * 100) : 0;
            return (
              <div className="seller" key={v.id}>
                <div className="av" style={{ background: teinte }}>
                  {v.nom.charAt(0).toUpperCase()}
                  <sup>{i + 1}</sup>
                </div>
                <div className="info">
                  <b>{v.nom}</b>
                  <small>
                    {montantsVisibles
                      ? `Ventes ${nombre(v.totalVentesMontant)} · Dép. ${nombre(v.totalDepenses)}`
                      : "Solde net en poche"}
                  </small>
                  <div className="bar">
                    <i style={{ width: `${part}%`, background: i === 0 ? undefined : teinte }} />
                  </div>
                </div>
                <div className="amt num">
                  {montantsVisibles ? montant(v.soldeNetEnPoche) : "••• Ar"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
