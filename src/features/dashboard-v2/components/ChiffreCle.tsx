import React from "react";

/** Le chiffre qui domine une carte (ordinateur seulement ; masqué sur téléphone). */
export const ChiffreCle: React.FC<{
  valeur: React.ReactNode;
  libelle: string;
  detail?: React.ReactNode;
  ton?: "pos" | "alerte";
}> = ({ valeur, libelle, detail, ton }) => (
  <div className="cle">
    <b className={`cle-v num${ton ? ` cle-${ton}` : ""}`}>{valeur}</b>
    <span className="cle-l">
      {libelle}
      {detail && <small className={ton ? `cle-${ton}` : undefined}>{detail}</small>}
    </span>
  </div>
);
