import React from "react";
import { Card, CardHeader } from "../components/Card";
import { Tag } from "../components/Tag";
import { EtatVide } from "../components/States";
import { nombre } from "../lib/format";
import { quantiteEnMots } from "../../../utils/formulas";
import type { ChiffresStock, LigneStock } from "../lib/chiffres";

/**
 * 15. RUPTURES À VENIR
 *
 * LA COUVERTURE EN JOURS EST NOUVELLE : stock disponible divisé par ce
 * qui se vend en moyenne par jour sur les trente derniers jours. C'est
 * ce qui transforme « il reste deux unités » en « il reste un jour »,
 * et deux unités d'un produit qui ne bouge pas n'ont pas la même
 * urgence que deux unités d'un produit qui part tous les jours.
 *
 * SANS VENTE, PAS DE COUVERTURE. Diviser par zéro donnerait l'infini, et
 * « ∞ jours » sur un produit qui ne se vend plus n'est pas une
 * information : c'est l'absence d'information. La carte affiche alors le
 * seuil, et rien d'autre.
 */

const jours = (n: number) =>
  n < 1 ? "moins d'un jour" : `≈ ${Math.round(n)} jour${n >= 2 ? "s" : ""}`;

const ton = (n: number | null): "crit" | "warn" | "ok" =>
  n === null ? "warn" : n < 3 ? "crit" : n < 10 ? "warn" : "ok";

export const CarteRuptures: React.FC<{
  stock: ChiffresStock;
  onProduit?: (p: LigneStock) => void;
}> = ({ stock, onProduit }) => {
  const bientot = [...stock.aRecommander]
    .sort((a, b) => (a.couverture ?? 9999) - (b.couverture ?? 9999))
    .slice(0, 4);

  const ligne = (p: LigneStock, rupture: boolean) => {
    const Ligne = onProduit ? "button" : "div";
    const couverture = p.couverture;
    const part = rupture ? 4 : couverture === null ? 30 : Math.min(100, (couverture / 30) * 100);
    const couleur = rupture
      ? "var(--crit)"
      : ton(couverture) === "crit"
        ? "var(--crit)"
        : "var(--warn)";
    return (
      <Ligne
        key={p.id}
        {...(onProduit ? { type: "button" as const, onClick: () => onProduit(p) } : {})}
        className="alert"
      >
        <b>{p.nom}</b>
        {rupture ? (
          <Tag ton="crit">en rupture</Tag>
        ) : (
          <Tag ton={ton(couverture)}>
            {couverture === null ? `seuil ${p.seuil}` : jours(couverture)}
          </Tag>
        )}
        <div className="cover" aria-hidden="true">
          <i style={{ width: `${Math.max(4, part)}%`, background: couleur }} />
        </div>
        <small>
          {quantiteEnMots(p.disponible, p.unite)} en stock · seuil {nombre(p.seuil)}
          {couverture !== null && !rupture
            ? ` · se vend ≈ ${(p.disponible / Math.max(couverture, 0.1)).toFixed(1).replace(".", ",")} / jour`
            : ""}
        </small>
      </Ligne>
    );
  };

  return (
    <Card span={4} id="carte-ruptures">
      <CardHeader
        title="Ruptures à venir"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 3 2.5 20h19L12 3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
        }
        action={
          bientot.length > 0 ? (
            <Tag ton="warn">{bientot.length} bientôt</Tag>
          ) : (
            <Tag ton="ok">rien à signaler</Tag>
          )
        }
      />

      {stock.enRupture.length === 0 ? (
        <EtatVide
          titre="Aucun produit en rupture"
          detail="Tous les produits restent disponibles à la vente."
        />
      ) : (
        <div className="alist">{stock.enRupture.slice(0, 3).map((p) => ligne(p, true))}</div>
      )}

      {bientot.length > 0 && (
        <>
          <div className="sous-titre">Bientôt en rupture</div>
          <div className="alist">{bientot.map((p) => ligne(p, false))}</div>
        </>
      )}
    </Card>
  );
};
