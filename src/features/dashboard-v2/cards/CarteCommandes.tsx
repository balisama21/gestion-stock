import React from "react";
import { Card, CardHeader } from "../components/Card";
import { EtatVide } from "../components/States";
import type { ChiffresCommandes } from "../lib/chiffres";

/**
 * 8. SUIVI DES COMMANDES
 *
 * Quatre étapes sur une ligne pointillée : reçue, en préparation, en
 * livraison, à encaisser. Ce n'est pas un entonnoir — une commande peut
 * être livrée et rester à encaisser — mais l'ordre de lecture suit
 * celui du travail, ce qui suffit à s'y retrouver.
 *
 * QUAND TOUT EST À ZÉRO, LA CARTE LE DIT AUTREMENT. Quatre ronds vides
 * ressemblent à un écran cassé ; une phrase verte dit que le travail
 * est fait. C'est la bonne nouvelle, elle mérite d'être lisible.
 */
export const CarteCommandes: React.FC<{
  commandes: ChiffresCommandes;
  onOuvrir?: () => void;
}> = ({ commandes, onOuvrir }) => {
  const etapes: { n: number; libelle: React.ReactNode }[] = [
    { n: commandes.recues, libelle: "Reçues" },
    {
      n: commandes.enPreparation,
      libelle: (
        <>
          En
          <br />
          préparation
        </>
      ),
    },
    {
      n: commandes.enLivraison,
      libelle: (
        <>
          En
          <br />
          livraison
        </>
      ),
    },
    {
      n: commandes.aEncaisser,
      libelle: (
        <>
          À<br />
          encaisser
        </>
      ),
    },
  ];

  return (
    <Card span={4} secondary id="carte-commandes">
      <CardHeader
        title="Suivi des commandes"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4h14v12H1zM15 9h4l3 3v4h-7" />
            <circle cx="5.5" cy="18.5" r="2" />
            <circle cx="18.5" cy="18.5" r="2" />
          </svg>
        }
        action={
          onOuvrir && (
            <button className="link" type="button" onClick={onOuvrir}>
              Tout voir
            </button>
          )
        }
      />

      <div className="track">
        {etapes.map((e, i) => (
          <div className={`stage${e.n > 0 ? " actif" : ""}`} key={i}>
            <div className="bub">{e.n}</div>
            <small>{e.libelle}</small>
          </div>
        ))}
      </div>

      {commandes.total === 0 && (
        <EtatVide
          titre="Aucune commande en cours"
          detail="Tout est livré. Les nouvelles commandes apparaîtront ici, étape par étape."
        />
      )}
    </Card>
  );
};
