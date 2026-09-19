import React from "react";

/**
 * LES PUCES D'ATTENTION DE L'EN-TÊTE
 *
 * « 2 tâches en retard », « 3 produits à recommander ». Le clic fait
 * défiler jusqu'à la carte concernée et la fait clignoter — un tableau
 * de bord qui signale un problème doit savoir montrer où il est.
 *
 * `ok` est la puce de la bonne nouvelle : elle ne se clique pas, parce
 * qu'elle ne mène nulle part.
 */

const FLECHE = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export interface ChipProps {
  /** Combien d'éléments la puce annonce. */
  nombre: number;
  /** Au singulier : « tâche en retard ». */
  singulier: string;
  /** Au pluriel : « tâches en retard ». */
  pluriel: string;
  ton: "crit" | "warn" | "info";
  /** Identifiant de la carte vers laquelle défiler. */
  cible: string;
  onAller: (cible: string) => void;
}

export const Chip: React.FC<ChipProps> = ({ nombre, singulier, pluriel, ton, cible, onAller }) => (
  <button type="button" className={`chip ${ton}`} onClick={() => onAller(cible)}>
    <span className="n num">{nombre}</span>
    {nombre > 1 ? pluriel : singulier}
    {FLECHE}
  </button>
);

export const ChipRienDUrgent: React.FC = () => (
  <span className="chip ok">Rien d&apos;urgent, tout est à jour</span>
);
