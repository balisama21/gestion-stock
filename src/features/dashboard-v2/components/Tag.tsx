import React from "react";

/**
 * L'ÉTIQUETTE DE STATUT
 *
 * Le seul endroit du tableau de bord où la couleur porte un sens
 * imposé : rouge un problème, orange une attention, vert un état sain,
 * bleu une information. `neutre` existe pour les étiquettes qui ne
 * disent qu'une date ou un nombre — une couleur de plus affaiblirait
 * celles qui parlent vraiment.
 */

export type Ton = "crit" | "warn" | "ok" | "info" | "neutre";

export const Tag: React.FC<{ ton?: Ton; children: React.ReactNode; className?: string }> = ({
  ton = "neutre",
  children,
  className = "",
}) => <span className={`tag ${ton}${className ? ` ${className}` : ""}`}>{children}</span>;
