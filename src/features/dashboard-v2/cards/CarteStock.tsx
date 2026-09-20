import React from "react";
import { Card, CardHeader } from "../components/Card";
import { Tag } from "../components/Tag";
import { montant, nombre } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { ChiffresStock, LigneStock } from "../lib/chiffres";

/**
 * 4. ÉTAGÈRE DE STOCK
 *
 * Une jauge par produit, remplie à proportion du stock disponible sur
 * son seuil d'alerte. Une jauge et non un chiffre : « 2 / 20 » demande
 * une division mentale, un trait au quart plein se voit sans y penser.
 *
 * UN TRAIT CONTINU, ET NON DIX CASIERS. Elle était découpée en dix
 * blocs : cinq produits faisaient cinquante petits rectangles alignés,
 * et cette répétition fatigue l'œil. Le découpage prétendait aider à
 * compter, mais on ne compte pas des casiers — le chiffre exact est
 * déjà écrit juste au-dessus. Un trait fin dit la même proportion sans
 * ce bruit.
 *
 * ROUGE SOUS LE SEUIL, et seulement là. C'est la règle de la page
 * Produits, reprise telle quelle (`stockActuel <= seuilAlerte`) : deux
 * écrans qui ne s'accorderaient pas sur ce qui est bas feraient douter
 * des deux.
 *
 * LES CINQ PLUS PROCHES DU SEUIL, pas les cinq premiers du catalogue.
 * Une étagère sert à voir ce qui va manquer.
 */
export const CarteStock: React.FC<{
  stock: ChiffresStock;
  valeurVisible: boolean;
  onProduit?: (produit: LigneStock) => void;
  onCommander?: () => void;
}> = ({ stock, valeurVisible, onProduit, onCommander }) => {
  const aRecommander = stock.aRecommander.length + stock.enRupture.length;

  return (
    <Card span={4} id="carte-stock">
      <CardHeader
        title="Étagère de stock"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 8l-9-5-9 5 9 5 9-5z" />
            <path d="M3 8v8l9 5 9-5V8" />
          </svg>
        }
        action={
          aRecommander > 0 ? (
            <Tag ton="crit">{aRecommander} à recommander</Tag>
          ) : (
            <Tag ton="ok">Tout est au-dessus du seuil</Tag>
          )
        }
      />

      <div className="shelf">
        {stock.etagere.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Aucun produit au catalogue.
          </p>
        ) : (
          stock.etagere.map((p) => {
            // La part du disponible sur le seuil, bornée à 100 %. Un
            // stock non nul garde un trait visible : une jauge vide et
            // une jauge presque vide ne disent pas la même chose.
            const part = p.seuil > 0 ? p.disponible / p.seuil : 1;
            const rempli = p.disponible > 0 ? Math.max(4, Math.min(100, part * 100)) : 0;
            const Ligne = onProduit ? "button" : "div";
            return (
              <Ligne
                key={p.id}
                {...(onProduit ? { type: "button" as const, onClick: () => onProduit(p) } : {})}
                className={`item${p.sousLeSeuil ? " low" : ""}`}
              >
                <div className="nm">
                  <span>{p.nom}</span>
                  {/* Le rail rouge ne suffit pas : un statut doit se lire
                      sans distinguer les couleurs. La fleche et le mot le
                      disent, la couleur ne fait que le renforcer. */}
                  {p.sousLeSeuil && (
                    <small className="bas">
                      <span aria-hidden="true">↓</span> stock faible
                    </small>
                  )}
                </div>
                <span className="qty num">
                  {nombre(p.disponible)} / {nombre(p.seuil)}
                </span>
                <div className="jauge" aria-hidden="true">
                  <i style={{ width: `${rempli}%` }} />
                </div>
              </Ligne>
            );
          })
        )}
      </div>

      <div className="stock-foot">
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
        {onCommander && aRecommander > 0 && (
          <button className="btn" type="button" onClick={onCommander}>
            Préparer la commande
          </button>
        )}
      </div>
    </Card>
  );
};
