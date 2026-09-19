import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import { montant, pourcent } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { ProduitVendu } from "../lib/chiffres";
import type { Periode } from "../hooks/useDashboardPeriod";

/**
 * 17. PRODUITS LES PLUS VENDUS
 *
 * Les cinq premiers par montant, et la barre de chacun rapportée au
 * premier — un classement, pas une part de marché.
 *
 * LA LIGNE « AUTRES » IMPORTE AUTANT QUE LES CINQ. Sans elle, un
 * commerçant dont le premier produit fait 87 % des ventes ne voit pas
 * qu'il tient sur une seule jambe. La somme des cinq plus « autres »
 * doit faire le total de la période, et elle le fait.
 */
export const CarteTopProduits: React.FC<{
  top: ProduitVendu[];
  /** Total des ventes de la période, pour en déduire « Autres ». */
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
    <Card span={4} id="carte-top">
      <CardHeader
        title="Produits les plus vendus"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 20h16M7 16V9M12 16V4M17 16v-5" />
          </svg>
        }
        action={<span style={{ fontSize: 12, color: "var(--muted)" }}>{periode.libelle}</span>}
      />

      {top.length === 0 ? (
        <EtatVide
          titre="Aucune vente sur la période"
          detail="Le classement apparaîtra dès la première vente enregistrée."
        />
      ) : (
        <ol className="top">
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
              <span className="rk num">{i + 1}</span>
              <span className="nm">{p.nom}</span>
              <span className="num am">{visible ? montant(p.montant) : "••• Ar"}</span>
              <span className="bar">
                <i style={{ width: `${tete > 0 ? (p.montant / tete) * 100 : 0}%` }} />
              </span>
              <small>
                {pourcent(p.part)} des ventes · {quantiteEnMots(p.quantite, p.unite)}
              </small>
            </li>
          ))}
        </ol>
      )}

      {(autres > 0 || onToutes) && (
        <div className="stock-foot">
          <div>
            <small>Autres produits</small>
            <b className="num">{visible ? montant(autres) : "••• Ar"}</b>
          </div>
          {onToutes && (
            <button className="link" type="button" onClick={onToutes}>
              Toutes les ventes
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
