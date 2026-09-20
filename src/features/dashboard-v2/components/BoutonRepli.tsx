import React from "react";

/**
 * LE CHEVRON QUI REPLIE UNE CARTE
 *
 * Il montre toujours ce que le clic va faire : vers le bas quand le
 * contenu est là et qu'on peut le ranger, retourné vers le haut quand
 * il est rangé et qu'on peut le ramener.
 *
 * Il n'a ni fond ni bordure. C'est la règle de tous les boutons à
 * symbole de cet écran — la croix du panneau, la flèche de l'agenda,
 * le bouton d'actualisation : un pictogramme se suffit, et une rangée
 * de petites boîtes grises au-dessus d'une carte fait du bruit pour
 * rien. Le survol renforce la couleur, il ne dessine pas un cadre.
 */
const CHEVRON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const BoutonRepli: React.FC<{
  replie: boolean;
  onBasculer: () => void;
  /** Ce qu'on replie, pour l'annoncer : « le calendrier », « le journal ». */
  quoi: string;
  /** `nav-btn` sur l'en-tête vert du calendrier, `icon-btn` ailleurs. */
  className?: string;
}> = ({ replie, onBasculer, quoi, className = "icon-btn" }) => {
  const action = `${replie ? "Déplier" : "Replier"} ${quoi}`;
  return (
    <button
      className={`${className} plier${replie ? " replie" : ""}`}
      type="button"
      onClick={onBasculer}
      aria-expanded={!replie}
      aria-label={action}
      title={action}
    >
      {CHEVRON}
    </button>
  );
};
