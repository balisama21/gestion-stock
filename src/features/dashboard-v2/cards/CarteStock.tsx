import React from "react";
import { Card, CardHeader } from "../components/Card";
import { Tag } from "../components/Tag";
import { montant, nombre } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { ChiffresStock, LigneStock } from "../lib/chiffres";

/**
 * 4. ÉTAGÈRE DE STOCK
 *
 * Dix casiers par produit, remplis à proportion du stock disponible sur
 * son seuil d'alerte. Une jauge et non un chiffre : « 2 / 20 » demande
 * une division mentale, dix casiers dont un seul est plein se voit sans
 * y penser.
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
            // Dix casiers : la part du disponible sur le seuil, arrondie
            // au casier supérieur pour qu'un stock non nul en remplisse
            // toujours au moins un.
            const part = p.seuil > 0 ? p.disponible / p.seuil : 1;
            const pleins = Math.max(p.disponible > 0 ? 1 : 0, Math.min(10, Math.round(part * 10)));
            const Ligne = onProduit ? "button" : "div";
            return (
              <Ligne
                key={p.id}
                {...(onProduit ? { type: "button" as const, onClick: () => onProduit(p) } : {})}
                className={`item${p.sousLeSeuil ? " low" : ""}`}
              >
                <div className="nm">
                  <span>{p.nom}</span>
                </div>
                <span className="qty num">
                  {nombre(p.disponible)} / {nombre(p.seuil)}
                </span>
                <div className="bins" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={i < pleins ? "f" : ""} />
                  ))}
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
