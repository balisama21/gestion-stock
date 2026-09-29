import React from "react";
import { IconeDuo } from "../../../components/shared/IconeDuo";
import { Lead, TeteCarte } from "../components/Tn";
import { Tag } from "../components/Tag";
import { montant, nombre } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import { VignetteProduit } from "../../../components/shared/VignetteProduit";
import type { ChiffresStock, LigneStock } from "../lib/chiffres";

/**
 * ÉTAT DU STOCK — l'étagère : chaque produit, sa jauge et son seuil.
 *
 * Deux niveaux d'alerte qui s'excluent : sous le seuil (rouge, « stock
 * faible ») et, avec la préalerte, dans la bande juste au-dessus (orange,
 * « approche du seuil »). Le mot dit l'état ; la couleur le renforce.
 */
export const CarteStock: React.FC<{
  stock: ChiffresStock;
  valeurVisible: boolean;
  /** La photo de chaque produit, par identifiant. */
  vignettes?: Map<string, string>;
  onProduit?: (produit: LigneStock) => void;
  onCommander?: () => void;
  onTelecharger?: () => void;
}> = ({ stock, valeurVisible, vignettes, onProduit, onCommander, onTelecharger }) => {
  const sousLeSeuil = stock.aRecommander.length + stock.enRupture.length;
  const aRecommander = sousLeSeuil + stock.enPrealerte.length;

  return (
    <article className="card stk" id="carte-stock">
      <TeteCarte
        lead={<Lead nom="box" />}
        titre="État du stock"
        action={
          aRecommander > 0 ? (
            <Tag ton={sousLeSeuil > 0 ? "crit" : "warn"}>{aRecommander} à recommander</Tag>
          ) : (
            <Tag ton="ok">Tout est au-dessus du seuil</Tag>
          )
        }
      />

      <div className="shelf">
        {stock.etagere.length === 0 ? (
          <p className="rien">Aucun produit au catalogue.</p>
        ) : (
          stock.etagere.map((p) => {
            const part = p.seuil > 0 ? p.disponible / p.seuil : 1;
            const rempli = p.disponible > 0 ? Math.max(4, Math.min(100, part * 100)) : 2;
            const Ligne = onProduit ? "button" : "div";
            return (
              <Ligne
                key={p.id}
                {...(onProduit ? { type: "button" as const, onClick: () => onProduit(p) } : {})}
                className={`row item${p.sousLeSeuil ? " low" : p.enPrealerte ? " prealerte" : ""}`}
              >
                <span className="th">
                  <VignetteProduit nom={p.nom} chemin={vignettes?.get(p.id) ?? null} taille={40} />
                </span>
                <div className="corps">
                  <div className="nm">
                    <span>{p.nom}</span>
                    {p.sousLeSeuil ? (
                      <em className="bas">
                        <IconeDuo nom="alert" />
                        stock faible
                      </em>
                    ) : p.enPrealerte ? (
                      <em className="approche">
                        <IconeDuo nom="alert" />
                        approche du seuil
                      </em>
                    ) : null}
                  </div>
                  <div className="pr" aria-hidden="true">
                    <i style={{ width: `${rempli}%` }} />
                  </div>
                </div>
                <span className="q num">
                  {nombre(p.disponible)} / {nombre(p.seuil)}
                </span>
                {onProduit ? <IconeDuo nom="chevright" className="chev" /> : <span />}
              </Ligne>
            );
          })
        )}
      </div>

      <div className="foot">
        <span className="ib">
          <IconeDuo nom="box" />
        </span>
        <div>
          {valeurVisible ? (
            <>
              <small>Valeur du stock</small>
              <b className="num">{montant(stock.valeur)}</b>
            </>
          ) : (
            <>
              <small>Produits suivis</small>
              <b className="num">{quantiteEnMots(stock.etagere.length, "produit")}</b>
            </>
          )}
        </div>
        {/* Deux gestes, et le second n'est pas le premier : préparer,
            c'est ouvrir la liste pour la travailler ; télécharger,
            c'est l'envoyer au fournisseur sans rien ouvrir. */}
        {aRecommander > 0 && (
          <div className="stock-actions">
            {onTelecharger && (
              <button className="btn out" type="button" onClick={onTelecharger}>
                <IconeDuo nom="download" />
                Télécharger la liste
              </button>
            )}
            {onCommander && (
              <button className="btn pri" type="button" onClick={onCommander}>
                <IconeDuo nom="cart" />
                Préparer la commande
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
