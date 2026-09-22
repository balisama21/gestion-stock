import React from "react";
import type { TypeDocument } from "./documents";

export type CleOnglet = "tous" | TypeDocument;

export interface Onglet {
  cle: CleOnglet;
  label: string;
  compte: number;
}

/**
 * Les onglets par type de pièce.
 *
 * Même convention que la rangée d'univers juste au-dessus : un filet
 * vert sous l'onglet courant, jamais un aplat. Les deux rangées se
 * suivent, et deux traitements différents les feraient lire comme deux
 * mécaniques sans rapport.
 *
 * Un onglet vide reste affiché tant qu'il compte quelque chose ailleurs
 * — c'est le nombre à côté du mot qui dit s'il y a de quoi regarder.
 * Ceux qui n'ont jamais rien ne s'affichent pas : une boutique qui
 * n'établit pas d'avoirs n'a pas à porter l'onglet toute l'année.
 */
export const OngletsType: React.FC<{
  onglets: Onglet[];
  actif: CleOnglet;
  onChoisir: (cle: CleOnglet) => void;
}> = ({ onglets, actif, onChoisir }) => (
  <div
    role="tablist"
    aria-label="Type de document"
    className="mb-3 flex flex-wrap gap-x-1 gap-y-0 border-b border-border"
  >
    {onglets.map((o) => {
      const estActif = o.cle === actif;
      return (
        <button
          key={o.cle}
          type="button"
          role="tab"
          aria-selected={estActif}
          onClick={() => onChoisir(o.cle)}
          className={`-mb-px border-b-2 px-2.5 py-2 text-[13px] transition-colors active:bg-muted ${
            estActif
              ? "border-primary font-medium text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {o.label}
          {o.compte > 0 && (
            <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-60">{o.compte}</span>
          )}
        </button>
      );
    })}
  </div>
);
