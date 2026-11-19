import React from "react";
import {
  BedDouble,
  Check,
  ClipboardList,
  Mic,
  Pill,
  Scissors,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { NATURES, type CleNature } from "../../lib/natures";

const ICONES: Record<CleNature, React.ComponentType<{ className?: string }>> = {
  standard: Store,
  karaoke: Mic,
  pharmacie: Pill,
  restaurant: UtensilsCrossed,
  hotel: BedDouble,
  alimentation: ShoppingBasket,
  services: Scissors,
  inventaire: ClipboardList,
};

/**
 * Le choix de la nature d'une boutique, en cartes.
 *
 * Toutes les natures sont montrées, même celles qui ne sont pas prêtes :
 * celles-là portent « En cours de développement » et ne se choisissent
 * pas encore. Un groupe de boutons radio, pour le clavier et les
 * lecteurs d'écran.
 */
export const ChoixNature: React.FC<{
  valeur: CleNature;
  onChange: (cle: CleNature) => void;
  desactive?: boolean;
}> = ({ valeur, onChange, desactive }) => (
  <div role="radiogroup" aria-label="Nature de la boutique" className="grid gap-2 sm:grid-cols-2">
    {NATURES.map((n) => {
      const Icone = ICONES[n.cle];
      const choisie = n.cle === valeur;
      const bloquee = !n.disponible || desactive;
      return (
        <button
          key={n.cle}
          type="button"
          role="radio"
          aria-checked={choisie}
          aria-disabled={!n.disponible || undefined}
          disabled={bloquee}
          onClick={() => n.disponible && onChange(n.cle)}
          className={`relative flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
            choisie
              ? "border-primary bg-success-soft ring-1 ring-primary"
              : n.disponible
                ? "border-border bg-card hover:border-primary/60"
                : "cursor-not-allowed border-dashed border-border bg-muted/40"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              n.disponible ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icone className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block text-sm font-semibold ${
                n.disponible ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {n.nom}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {n.description}
            </span>
            {!n.disponible && (
              <span className="mt-1.5 inline-block rounded-full border border-warning-border bg-warning-soft px-2 py-0.5 text-[10.5px] font-semibold t-warning">
                En cours de développement
              </span>
            )}
          </span>
          {choisie && (
            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);
