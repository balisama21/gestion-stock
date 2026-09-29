import React from "react";
import { teinteAvatar } from "../../lib/teintes";

interface AvatarInitialeProps {
  /** Le nom tel qu'il s'affiche : il donne l'initiale et la couleur. */
  nom: string;
  /** Diamètre en pixels. */
  taille?: number;
  className?: string;
}

/**
 * L'avatar d'une personne sans photo : un disque de couleur pleine,
 * l'initiale en blanc au centre. La couleur vient du nom, jamais du
 * hasard : un client la garde d'un écran et d'un jour à l'autre.
 */
export const AvatarInitiale: React.FC<AvatarInitialeProps> = ({
  nom,
  taille = 40,
  className = "",
}) => {
  const source = (nom.trim() || "?").replace(/^[^\p{L}\p{N}]+/u, "");
  return (
    <span
      className={`avatar-initiale${className ? ` ${className}` : ""}`}
      style={{
        width: taille,
        height: taille,
        background: teinteAvatar(nom),
        fontSize: Math.round(taille * 0.42),
      }}
      aria-hidden="true"
      title={nom}
    >
      {(source.charAt(0) || "?").toUpperCase()}
    </span>
  );
};
