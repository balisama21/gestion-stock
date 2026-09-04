import React, { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /**
   * Nombre de filtres actuellement actifs (hors recherche). Affiché en
   * pastille sur le bouton "Filtres" pour que l'utilisateur sache qu'une
   * liste est filtrée même quand le panneau est fermé.
   */
  activeFilterCount?: number;
  /** Remet tous les filtres à leur valeur par défaut. */
  onReset?: () => void;
  /**
   * Les contrôles de filtre. Ils sont rendus une seule fois dans le JSX
   * appelant mais affichés à deux endroits selon la taille d'écran :
   * en ligne à partir de 768px, dans un panneau coulissant en dessous.
   * Comme ce sont des champs contrôlés par le parent, les deux rendus
   * restent automatiquement synchronisés.
   */
  children?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  activeFilterCount = 0,
  onReset,
  children,
}) => {
  const [open, setOpen] = useState(false);

  // Empêche la page de défiler derrière le panneau ouvert.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const hasFilters = Boolean(children);

  return (
    <>
      <div className="app-toolbar gap-3">
        {/* Recherche — toujours visible, pleine largeur sur mobile */}
        <div className="relative w-full lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="app-field pl-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {hasFilters && (
          <>
            {/* Déclencheur du panneau — mobile uniquement */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="app-btn-secondary w-full lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filtres en ligne — à partir de 768px */}
            <div className="hidden flex-wrap items-center gap-3 lg:flex">{children}</div>
          </>
        )}
      </div>

      {/* Panneau de filtres mobile */}
      {open && hasFilters && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Filtres</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="app-btn-icon h-9 w-9"
                aria-label="Fermer les filtres"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">{children}</div>

            <div className="mt-5 flex gap-2">
              {onReset && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                  className="app-btn-secondary flex-1"
                >
                  Réinitialiser
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="app-btn-primary flex-1"
              >
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface FilterFieldProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Enveloppe un contrôle de filtre. Le libellé est au-dessus du champ
 * dans le panneau mobile, et à côté en affichage desktop.
 */
export const FilterField: React.FC<FilterFieldProps> = ({ label, children }) => (
  <label className="flex w-full flex-col gap-1.5 lg:w-auto lg:flex-row lg:items-center lg:gap-2">
    <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground lg:font-medium">
      {label}
    </span>
    {children}
  </label>
);
