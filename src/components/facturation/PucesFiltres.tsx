import React from "react";
import { X } from "lucide-react";

export interface Puce {
  cle: string;
  libelle: string;
  onRetirer: () => void;
}

/**
 * Les filtres posés, qu'on retire d'un clic.
 *
 * Une liste filtrée sans rien qui le dise est le moyen le plus sûr de
 * faire croire qu'une facture a disparu. Chaque puce nomme le filtre et
 * porte sa croix — sans fond ni bordure, comme tous les boutons à
 * symbole de l'application.
 */
export const PucesFiltres: React.FC<{ puces: Puce[]; onToutEffacer: () => void }> = ({
  puces,
  onToutEffacer,
}) => {
  if (puces.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {puces.map((p) => (
        <span
          key={p.cle}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 py-1 pl-2.5 pr-1 text-[12px] text-foreground"
        >
          {p.libelle}
          <button
            type="button"
            onClick={p.onRetirer}
            aria-label={`Retirer le filtre ${p.libelle}`}
            className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {puces.length > 1 && (
        <button
          type="button"
          onClick={onToutEffacer}
          className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Tout effacer
        </button>
      )}
    </div>
  );
};
