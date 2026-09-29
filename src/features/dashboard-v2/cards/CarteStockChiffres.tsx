import React from "react";
import { Icone } from "../../../components/shared/Icone";
import { montant, nombre } from "../lib/format";
import type { ChiffresStock } from "../lib/chiffres";
import { Lead } from "../components/Tn";
import { illRupture } from "../assets/images";

/**
 * LES TROIS CHIFFRES DU STOCK, en tête de la section : sa valeur, ce
 * qu'il faut recommander, ce qui manque déjà.
 */
export const CarteStockChiffres: React.FC<{
  stock: ChiffresStock;
  valeurVisible: boolean;
  avecRuptures: boolean;
  onRafraichir?: () => void;
  onVoirLaListe?: () => void;
  onVoirRuptures?: () => void;
}> = ({ stock, valeurVisible, avecRuptures, onRafraichir, onVoirLaListe, onVoirRuptures }) => {
  const sousLeSeuil = stock.aRecommander.length + stock.enRupture.length;
  const aRecommander = sousLeSeuil + stock.enPrealerte.length;
  const ruptures = stock.enRupture.length;

  return (
    <div className="g3 top3">
      <article className="card">
        <Lead nom="wallet" rond />
        <div className="tt">
          <h4>{valeurVisible ? "Valeur du stock" : "Produits suivis"}</h4>
          <div className="val num">
            {valeurVisible ? montant(stock.valeur) : nombre(stock.etagere.length)}
            {onRafraichir && (
              <button
                type="button"
                onClick={onRafraichir}
                aria-label="Actualiser la valeur du stock"
              >
                <Icone nom="refresh" />
              </button>
            )}
          </div>
          <small>
            {valeurVisible
              ? "Total de la valeur de vos produits en stock"
              : "Produits suivis dans le catalogue"}
          </small>
        </div>
      </article>

      <article className={`card${aRecommander > 0 ? " warn" : ""}`}>
        <Lead nom="cart" rond ton={aRecommander > 0 ? "rouge" : undefined} />
        <div className="tt">
          <h4>Produits à recommander</h4>
          <div className="bignum num">
            {nombre(aRecommander)}
            {sousLeSeuil > 0 && <small>dont {nombre(sousLeSeuil)} sous le seuil</small>}
            {aRecommander === 0 && <small className="ok">tout est au-dessus du seuil</small>}
          </div>
        </div>
        {onVoirLaListe && aRecommander > 0 && (
          <button type="button" className="go" onClick={onVoirLaListe}>
            Voir la liste
          </button>
        )}
      </article>

      {avecRuptures && (
        <article className={`card${ruptures > 0 ? " warn" : ""}`}>
          <Lead nom="alert" rond ton={ruptures > 0 ? "rouge" : undefined} />
          <div className="tt">
            <h4>Ruptures à venir</h4>
            <div className="bignum num">
              {nombre(ruptures)}
              <small className={ruptures === 0 ? "ok" : undefined}>
                produit{ruptures > 1 ? "s" : ""} en rupture
              </small>
            </div>
          </div>
          {ruptures > 0 && <img className="art-rupt" src={illRupture} alt="" />}
          {onVoirRuptures && (
            <button type="button" className="go" onClick={onVoirRuptures}>
              Voir détails
            </button>
          )}
        </article>
      )}
    </div>
  );
};
