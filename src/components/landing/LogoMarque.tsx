import React from "react";
import type { Marque } from "../../lib/marque";

/**
 * Le logo de la marque, ou à défaut son initiale sur un carré à sa
 * couleur : un logo provisoire qui ne demande aucun fichier.
 */
export const LogoMarque: React.FC<{ marque: Marque; taille: number; className?: string }> = ({
  marque,
  taille,
  className = "",
}) => {
  if (marque.logoUrl) {
    return (
      <img
        src={marque.logoUrl}
        alt=""
        style={{ height: taille }}
        className={`w-auto max-w-[8rem] object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground ${className}`}
      style={{ width: taille, height: taille, fontSize: taille * 0.52 }}
    >
      {marque.nom.trim().charAt(0).toUpperCase()}
    </span>
  );
};
