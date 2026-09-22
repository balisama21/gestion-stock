import React from "react";

/**
 * Le compte qui réclame l'attention, posé au bout d'une entrée de menu.
 *
 * Rouge, parce qu'il énonce un retard : c'est un état, pas une
 * décoration sur un chiffre. Il se tait dès que le compte tombe à zéro,
 * et l'entrée reprend exactement l'aspect des autres.
 */
export const BadgeNav: React.FC<{ compte: number; libelle: string }> = ({ compte, libelle }) => (
  <span
    aria-label={`${compte} ${libelle}`}
    className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 px-1.5 text-[11px] font-medium leading-none text-red-600 dark:text-red-400"
  >
    {compte > 99 ? "99+" : compte}
  </span>
);
