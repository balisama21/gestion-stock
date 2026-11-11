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
  /**
   * Les filtres rapides : ceux dont on se sert dix fois par jour (l'état
   * du stock, le statut d'une vente). Ils restent TOUJOURS visibles, en
   * pastilles sous la recherche, au lieu d'être rangés avec les autres
   * derrière le bouton « Filtres ». Un geste au lieu de trois.
   */
  rapides?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  activeFilterCount = 0,
  onReset,
  children,
  rapides,
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
      {/* La recherche vit dans sa propre barre, détachée de la liste
          qu'elle filtre : on voit d'un coup d'œil où l'on tape et où
          l'on lit. Sur téléphone, le bouton des filtres se range à
          droite du champ plutôt que d'occuper une rangée entière. */}
      <div className="app-recherche">
        <div className="app-recherche-ligne">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="app-recherche-champ"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`app-recherche-filtres lg:hidden${activeFilterCount > 0 ? " est-actif" : ""}`}
              aria-label={
                activeFilterCount > 0
                  ? `Filtres, ${activeFilterCount} actif${activeFilterCount > 1 ? "s" : ""}`
                  : "Filtres"
              }
            >
              <SlidersHorizontal className="h-5 w-5" />
              <span>Filtres</span>
              {activeFilterCount > 0 && (
                <span className="app-recherche-compte">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>

        {rapides && <div className="app-recherche-rapides">{rapides}</div>}

        {/* Les autres filtres, en ligne — sur PC seulement. */}
        {hasFilters && (
          <div className="hidden flex-wrap items-center gap-3 lg:ml-auto lg:flex">{children}</div>
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

interface PastilleFiltreProps {
  actif: boolean;
  onClick: () => void;
  /** Combien de lignes ce filtre garde : on sait avant de cliquer. */
  compte?: number;
  /** L'icône posée au-dessus du libellé. */
  icone?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Un filtre rapide : une icône, et dessous son libellé avec son compte.
 * À poser dans `rapides`. Plusieurs côte à côte forment un choix ; celui
 * qui est actif voit son libellé se remplir de la couleur principale.
 */
export const PastilleFiltre: React.FC<PastilleFiltreProps> = ({
  actif,
  onClick,
  compte,
  icone,
  children,
}) => (
  <button type="button" className="app-pastille" aria-pressed={actif} onClick={onClick}>
    {icone && (
      <span className="app-pastille-icone" aria-hidden="true">
        {icone}
      </span>
    )}
    <span className="app-pastille-libelle">
      {children}
      {compte !== undefined && <span className="app-pastille-compte">{compte}</span>}
    </span>
  </button>
);
