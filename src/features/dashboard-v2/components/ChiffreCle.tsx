import React from "react";

/** Le chiffre qui domine une carte (ordinateur seulement ; masqué sur téléphone). */
export const ChiffreCle: React.FC<{
  valeur: React.ReactNode;
  libelle: string;
  detail?: React.ReactNode;
  /** Couleur d'état du chiffre lui-même. */
  ton?: "pos" | "alerte" | "attention";
  /** La précision est une alerte, même si le chiffre ne l'est pas. */
  detailAlerte?: boolean;
}> = ({ valeur, libelle, detail, ton, detailAlerte }) => (
  <div className="cle">
    <b className={`cle-v num${ton ? ` cle-${ton}` : ""}`}>{valeur}</b>
    <span className="cle-l">
      {libelle}
      {detail && <small className={detailAlerte ? "cle-alerte" : undefined}>{detail}</small>}
    </span>
  </div>
);
