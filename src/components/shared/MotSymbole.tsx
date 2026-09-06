import React from "react";
import { APP_NAME } from "../../lib/appConfig";

interface MotSymboleProps {
  /**
   * Hauteur totale du bloc : un nombre de pixels, ou n'importe quelle
   * longueur CSS — `clamp()` compris, pour un mot-symbole qui suit la
   * largeur de l'écran.
   */
  hauteur: number | string;
  /** Couleur du mot et de son cadre. Par défaut, celle du contexte. */
  couleur?: string;
  className?: string;
}

/**
 * Le mot-symbole de la marque, en texte.
 *
 * Une image aurait été plus simple, mais elle aurait imposé une couleur
 * fixe, un poids de fichier et un rendu flou dès qu'on la grossit. Ici
 * les deux mots sont du texte dans les polices de la marque, chargées
 * réduites aux huit caractères utiles ; le tout prend la couleur de son
 * contexte et reste net à n'importe quelle taille.
 *
 * Le nom n'est écrit qu'une fois pour les lecteurs d'écran, sur
 * l'enveloppe : les deux fragments visibles sont masqués, sans quoi la
 * marque serait annoncée « Tantana suite Tantana Suite ».
 *
 * Toute la mise en place découle de `hauteur` — voir `.mot-symbole` dans
 * la feuille de style.
 */
export const MotSymbole: React.FC<MotSymboleProps> = ({ hauteur, couleur, className = "" }) => (
  <span
    className={`mot-symbole ${className}`}
    style={
      {
        "--ms-h": typeof hauteur === "number" ? `${hauteur}px` : hauteur,
        ...(couleur ? { color: couleur } : null),
      } as React.CSSProperties
    }
    role="img"
    aria-label={APP_NAME}
  >
    <span className="ms-tantana" aria-hidden="true">
      Tantana
    </span>
    <span className="ms-boite" aria-hidden="true">
      <span className="ms-suite">suite</span>
    </span>
  </span>
);
