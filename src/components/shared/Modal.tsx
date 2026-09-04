import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  size?: ModalSize;
  /** Barre d'actions collée en bas, hors de la zone défilante. */
  footer?: React.ReactNode;
  /** Contenu additionnel dans l'en-tête (bascule de format, filtres…). */
  headerAside?: React.ReactNode;
  /**
   * Empêche la fermeture par Échap et par clic extérieur — à utiliser
   * pendant une opération irréversible en cours.
   */
  dismissible?: boolean;
  /** Teinte de l'en-tête pour les confirmations destructrices. */
  tone?: "default" | "danger";
  children: React.ReactNode;
  bodyClassName?: string;
}

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

/**
 * Modale commune à toute l'application.
 *
 * Elle remplace une vingtaine de modales écrites à la main qui
 * divergeaient sur à peu près tout : opacité du fond, flou, présence ou
 * non d'un défilement interne, fermeture au clavier. Plusieurs n'avaient
 * ni hauteur maximale ni `overflow`, si bien qu'un contenu long était
 * simplement coupé en bas de l'écran, sans moyen de le faire défiler.
 *
 * Points structurants :
 * — rendue dans un portail sur <body>, pour ne dépendre d'aucun contexte
 *   d'empilement ni d'un parent qui rognerait le contenu ;
 * — hauteur plafonnée avec en-tête et pied fixes, seul le corps défile ;
 * — Échap et clic extérieur ferment, sauf si `dismissible` est faux ;
 * — le défilement de la page derrière est bloqué pendant l'ouverture ;
 * — les classes `app-modal-overlay` / `app-modal-panel` sont les points
 *   d'accroche de la feuille d'impression (voir styles.css), qui les
 *   neutralise pour que les reçus s'impriment sur plusieurs pages.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  size = "lg",
  footer,
  headerAside,
  dismissible = true,
  tone = "default",
  children,
  bodyClassName = "",
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Échap ferme la modale.
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  // Bloque le défilement de la page derrière la modale.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Place le focus dans la modale à l'ouverture, pour le clavier et les
  // lecteurs d'écran.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const hasHeader = Boolean(title || icon || headerAside);

  return createPortal(
    <div
      className="app-modal-overlay fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        // onMouseDown et non onClick : un glisser-déposer commencé dans
        // la modale et relâché sur le fond ne doit pas la fermer.
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`app-modal-panel app-card my-auto flex w-full flex-col outline-none ${SIZES[size]} ${
          tone === "danger" ? "border-danger-border" : ""
        }`}
        style={{ maxHeight: "calc(100vh - 2rem)", boxShadow: "var(--elev-3)" }}
      >
        {hasHeader && (
          <header className="app-modal-header flex shrink-0 flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              {icon && (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    tone === "danger"
                      ? "border-danger-border bg-danger-soft t-danger"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                {title && (
                  <h3
                    className={`truncate text-base font-bold tracking-tight ${
                      tone === "danger" ? "t-danger" : "text-foreground"
                    }`}
                  >
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
              {headerAside}
              <button
                type="button"
                onClick={onClose}
                className="app-btn-icon h-9 w-9 shrink-0"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <div className={`app-modal-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <footer className="app-modal-footer flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
