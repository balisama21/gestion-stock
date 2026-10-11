import { AlarmClock, Star, UserRound } from "lucide-react";
import React from "react";

/**
 * LES PUCES D'ATTENTION DE L'EN-TÊTE
 *
 * « 2 tâches en retard », « 3 produits à recommander ». Le clic fait
 * défiler jusqu'à la carte concernée et la fait clignoter — un tableau
 * de bord qui signale un problème doit savoir montrer où il est.
 */

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

/** L'icône de chaque ton : l'horloge du retard, l'étoile du stock, la personne du devis. */
const ICONE: Record<ChipProps["ton"], React.ReactNode> = {
  crit: <AlarmClock aria-hidden="true" />,
  warn: <Star aria-hidden="true" />,
  info: <UserRound aria-hidden="true" />,
};

export const Chip: React.FC<ChipProps> = ({ nombre, singulier, pluriel, ton, cible, onAller }) => (
  <button type="button" className={`chip ${ton}`} onClick={() => onAller(cible)}>
    <span className="ci">{ICONE[ton]}</span>
    <span className="t">{nombre > 1 ? pluriel : singulier}</span>
    <span className="n num">{nombre}</span>
  </button>
);
