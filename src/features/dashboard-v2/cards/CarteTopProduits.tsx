import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { Lead, TeteCarte } from "../components/Tn";
import { montant, pourcent, montantMasque } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { ProduitVendu } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";
import { illCroissance, illFeuillesGauche, illTrophee } from "../assets/images";

/**
 * PRODUITS LES PLUS VENDUS — le classement de la période.
 */
export const CarteTopProduits: React.FC<{
  top: ProduitVendu[];
  totalPeriode: number;
  periode: Periode;
  visible: boolean;
  onProduit?: (p: ProduitVendu) => void;
  onToutes?: () => void;
}> = ({ top, totalPeriode, periode, visible, onProduit, onToutes }) => {
  const tete = top[0]?.montant ?? 0;
  const cumule = top.reduce((a, p) => a + p.montant, 0);
  const autres = Math.max(0, totalPeriode - cumule);

  return (
    <article className="card top-card" id="carte-top">
      <TeteCarte
        lead={<Lead nom="chart" />}
        titre="Produits les plus vendus"
        action={
          <>
            <span className="date-chip">
              {periode.libelle} <Icone nom="calendar" />
            </span>
            {onToutes && (
              <button type="button" className="btn out rond" onClick={onToutes}>
                Voir toutes les ventes
              </button>
            )}
          </>
        }
      />

      {top.length === 0 ? (
        <div className="top-empty">
          <div>
            <img src={illTrophee} alt="" className="trophee" />
            <b>Aucun produit vendu pour le moment</b>
            <span>Ajoutez des produits et commencez à vendre pour voir votre classement ici.</span>
          </div>
          <img className="bars" src={illCroissance} alt="" />
          <img className="vleft" src={illFeuillesGauche} alt="" />
        </div>
      ) : (
        <>
          <ol className="best">
            {top.map((p, i) => (
              <li
                key={p.id}
                className={onProduit ? "clic" : undefined}
                {...(onProduit
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => onProduit(p),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onProduit(p);
                        }
                      },
                    }
                  : {})}
              >
                <span className={`rk num r${i + 1}`}>{i + 1}</span>
                <span className="nm">{p.nom}</span>
                <span className="num am">{visible ? montant(p.montant) : montantMasque()}</span>
                <span className="bar">
                  <i style={{ width: `${tete > 0 ? (p.montant / tete) * 100 : 0}%` }} />
                </span>
                <small>
                  {pourcent(p.part)} des ventes · {quantiteEnMots(p.quantite, p.unite)}
                </small>
              </li>
            ))}
          </ol>
          {autres > 0 && (
            <div className="autres">
              <small>Autres produits</small>
              <b className="num">{visible ? montant(autres) : montantMasque()}</b>
            </div>
          )}
        </>
      )}
    </article>
  );
};
