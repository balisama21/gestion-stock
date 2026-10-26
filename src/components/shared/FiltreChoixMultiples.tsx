import React, { useCallback, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";

interface FiltreChoixMultiplesProps<T extends string> {
  /** Ce que l'on filtre, lu à voix haute et affiché quand tout est coché. */
  label: string;
  options: { valeur: T; libelle: string }[];
  /** Les valeurs cochées. Toutes cochées = aucun filtre. */
  choisies: Set<T>;
  onBasculer: (valeur: T) => void;
  /** Recoche tout d'un geste. */
  onTout: () => void;
}

/**
 * Un filtre à plusieurs choix, replié dans un seul champ.
 *
 * Il remplace une rangée de puces : cinq boutons teintés côte à côte
 * passaient à la ligne sur téléphone et pesaient plus lourd que la
 * liste qu'ils filtrent. Fermé, le champ a la taille d'un `<select>` et
 * dit en clair ce qui est retenu — « Tous les types », « Vente, Achat »,
 * « 3 types ». Ouvert, il montre des cases à cocher.
 */
export function FiltreChoixMultiples<T extends string>({
  label,
  options,
  choisies,
  onBasculer,
  onTout,
}: FiltreChoixMultiplesProps<T>) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const id = useId();
  const fermer = useCallback(() => setOuvert(false), []);
  useClicExterieur(zone, ouvert, fermer);

  const tout = choisies.size === options.length;
  const retenues = options.filter((o) => choisies.has(o.valeur));
  const resume = tout
    ? `${label} : tous`
    : retenues.length <= 2
      ? retenues.map((o) => o.libelle).join(", ")
      : `${retenues.length} ${label.toLowerCase()}`;

  return (
    <div ref={zone} className="relative w-full sm:w-auto">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-controls={id}
        aria-label={`${label} : ${tout ? "tous" : retenues.map((o) => o.libelle).join(", ")}`}
        onClick={() => setOuvert((o) => !o)}
        className={`app-field-sm flex items-center justify-between gap-2 text-left sm:min-w-48 ${
          tout ? "" : "app-field-actif"
        }`}
      >
        <span className="truncate">{resume}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            ouvert ? "rotate-180" : ""
          }`}
        />
      </button>

      {ouvert && (
        <div
          id={id}
          role="group"
          aria-label={label}
          className="app-menu absolute inset-x-0 z-40 mt-1.5"
        >
          {options.map((o) => {
            const coche = choisies.has(o.valeur);
            return (
              <button
                key={o.valeur}
                type="button"
                aria-pressed={coche}
                onClick={() => onBasculer(o.valeur)}
                className="app-menu-item"
              >
                <span className={`app-case ${coche ? "app-case-cochee" : ""}`} aria-hidden="true">
                  {coche && <Check className="h-3 w-3" />}
                </span>
                {o.libelle}
              </button>
            );
          })}
          {!tout && (
            <>
              <div className="my-1 h-px bg-border" />
              <button type="button" onClick={onTout} className="app-menu-item text-primary">
                Tout afficher
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
