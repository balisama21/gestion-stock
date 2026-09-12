import React, { useCallback, useEffect, useRef, useState } from "react";
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
   * Empêche la fermeture par Échap, par clic extérieur et par
   * glissement — à utiliser pendant une opération irréversible en cours.
   */
  dismissible?: boolean;
  /** Teinte de l'en-tête pour les confirmations destructrices. */
  tone?: "default" | "danger";
  children: React.ReactNode;
  bodyClassName?: string;
}

/**
 * Pile des modales ouvertes. Une fiche peut en ouvrir une seconde — le
 * panneau de détails d'une ligne, par exemple. Sans cette pile, les deux
 * écoutent Échap sur le document et une seule frappe referme tout
 * l'empilement d'un coup. Seule la modale au sommet réagit.
 */
const openStack: symbol[] = [];

const SIZES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
};

/** Durée de l'animation de fermeture, en accord avec styles.css. */
const DUREE_SORTIE = 200;
/** Distance de glissement au-delà de laquelle on considère la fermeture voulue. */
const COURSE_FERMETURE = 110;
/** Vitesse (px/ms) qui ferme même sur un geste court et vif. */
const VITESSE_FERMETURE = 0.5;

type Etat = "entre" | "pose" | "sort";

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
 * — hauteur plafonnée avec en-tête et pied fixes, seul le corps défile,
 *   si bien que le bouton d'action reste visible même sur un formulaire
 *   long ;
 * — Échap, clic extérieur et glissement vers le bas ferment, sauf si
 *   `dismissible` est faux ;
 * — le défilement de la page derrière est bloqué pendant l'ouverture ;
 * — les classes `app-modal-overlay` / `app-modal-panel` sont les points
 *   d'accroche de la feuille d'impression (voir styles.css), qui les
 *   neutralise pour que les reçus s'impriment sur plusieurs pages.
 *
 * ── Sur le mouvement ──
 *
 * Sur téléphone, la modale est une feuille qui monte du bas et qu'on
 * renvoie d'un geste ; sur grand écran, une boîte qui se pose au centre.
 * L'ouverture et la fermeture sont deux animations distinctes, la
 * seconde plus courte : au moment de fermer, la décision est déjà prise.
 *
 * La fermeture pose une difficulté qui mérite d'être dite. Une modale ne
 * peut jouer son animation de sortie que si elle est encore montée
 * pendant qu'elle la joue. Deux cas se présentent :
 *
 * — l'utilisateur ferme lui-même (croix, fond, Échap, glissement) : la
 *   modale joue sa sortie PUIS prévient le parent. Elle maîtrise donc
 *   entièrement le moment. C'est la quasi-totalité des fermetures ;
 * — le parent referme de lui-même, après un enregistrement réussi. Si
 *   la modale est montée en permanence (`<Modal open={x}>`), le passage
 *   de `open` à faux est détecté ici et la sortie se joue également. Si
 *   le parent la monte sous condition (`{x && <Modal open …>}`), il la
 *   démonte avant qu'aucune animation n'ait pu commencer : la
 *   disparition reste immédiate. Rien ne peut être fait depuis ce
 *   composant — c'est au point d'appel de garder la modale montée.
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
  const idRef = useRef<symbol>(Symbol("modal"));

  const [rendu, setRendu] = useState(open);
  const [etat, setEtat] = useState<Etat>("entre");
  /** Décalage vertical pendant le glissement, en pixels. */
  const [glisse, setGlisse] = useState(0);
  const [retour, setRetour] = useState(false);

  const geste = useRef<{ depart: number; instant: number } | null>(null);
  /** Une sortie déjà lancée ne se relance pas : `onClose` doit partir une fois. */
  const sortEnCours = useRef(false);

  /** Joue la sortie, puis prévient le parent. */
  const fermer = useCallback(() => {
    if (!dismissible || sortEnCours.current) return;
    sortEnCours.current = true;
    setEtat("sort");
    window.setTimeout(() => {
      setRendu(false);
      onClose();
    }, DUREE_SORTIE);
  }, [dismissible, onClose]);

  // Ouverture : on remonte et on rejoue l'entrée.
  useEffect(() => {
    if (!open) return;
    sortEnCours.current = false;
    setRendu(true);
    setEtat("entre");
    setGlisse(0);
    setRetour(false);
    const t = window.setTimeout(() => setEtat("pose"), 320);
    return () => window.clearTimeout(t);
  }, [open]);

  // Fermeture décidée par le parent, sur une modale restée montée.
  useEffect(() => {
    if (open || !rendu || sortEnCours.current) return;
    sortEnCours.current = true;
    setEtat("sort");
    const t = window.setTimeout(() => setRendu(false), DUREE_SORTIE);
    return () => window.clearTimeout(t);
  }, [open, rendu]);

  // Inscription dans la pile des modales ouvertes.
  useEffect(() => {
    if (!rendu) return;
    const id = idRef.current;
    openStack.push(id);
    return () => {
      const i = openStack.indexOf(id);
      if (i !== -1) openStack.splice(i, 1);
    };
  }, [rendu]);

  // Échap ferme la modale, à condition qu'elle soit celle du dessus.
  useEffect(() => {
    if (!rendu || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openStack[openStack.length - 1] !== idRef.current) return;
      fermer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rendu, dismissible, fermer]);

  // Bloque le défilement de la page derrière la modale.
  useEffect(() => {
    if (!rendu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendu]);

  // Place le focus dans la modale à l'ouverture, pour le clavier et les
  // lecteurs d'écran.
  useEffect(() => {
    if (!rendu) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [rendu]);

  if (!rendu) return null;
  if (typeof document === "undefined") return null;

  const hasHeader = Boolean(title || icon || headerAside);

  // ── Le glissement vers le bas ──
  //
  // Il part de la poignée et de l'en-tête — la bande du haut, celle
  // qu'on attrape naturellement. On pourrait le laisser partir de
  // n'importe où quand le corps est en haut de son défilement : ce
  // serait plus généreux et nettement plus fragile, car le navigateur a
  // déjà commencé à interpréter le geste comme un défilement au moment
  // où on décide de le lui reprendre.
  //
  // Un geste qui commence sur un bouton n'est pas un glissement : la
  // croix et les bascules de l'en-tête gardent leur rôle. Et la croix
  // reste là, toujours, pour qui ne glisse pas — un geste caché ne doit
  // jamais être le seul chemin.
  const debutGeste = (e: React.TouchEvent) => {
    if (!dismissible || sortEnCours.current) return;
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    geste.current = { depart: e.touches[0].clientY, instant: performance.now() };
    setRetour(false);
  };

  const suivreGeste = (e: React.TouchEvent) => {
    if (!geste.current) return;
    const dy = e.touches[0].clientY - geste.current.depart;
    // Tirer vers le haut ne doit pas décoller la feuille de son bord.
    setGlisse(dy > 0 ? dy : 0);
  };

  const finGeste = () => {
    if (!geste.current) return;
    const duree = Math.max(performance.now() - geste.current.instant, 1);
    const vitesse = glisse / duree;
    geste.current = null;
    // Deux façons de fermer : aller assez loin, ou aller vite. Sans le
    // second critère, un geste franc et court — celui qu'on fait quand
    // on est pressé — ramènerait la feuille en place.
    if (glisse > COURSE_FERMETURE || (glisse > 24 && vitesse > VITESSE_FERMETURE)) {
      fermer();
      return;
    }
    if (glisse > 0) {
      setRetour(true);
      setGlisse(0);
    }
  };

  const poignee = (
    <div
      className="app-modal-poignee flex shrink-0 justify-center py-3 sm:hidden"
      onTouchStart={debutGeste}
      onTouchMove={suivreGeste}
      onTouchEnd={finGeste}
      onTouchCancel={finGeste}
      aria-hidden="true"
    >
      <span className="h-1 w-10 rounded-full bg-border" />
    </div>
  );

  return createPortal(
    <div
      data-etat={etat}
      className="app-modal-overlay fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // onMouseDown et non onClick : un glisser-déposer commencé dans
        // la modale et relâché sur le fond ne doit pas la fermer.
        if (dismissible && e.target === e.currentTarget) fermer();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-etat={etat}
        data-retour={retour || undefined}
        style={{
          transform: glisse ? `translateY(${glisse}px)` : undefined,
          boxShadow: "var(--elev-3)",
        }}
        className={`app-modal-panel app-card flex w-full flex-col rounded-b-none rounded-t-2xl outline-none sm:my-auto sm:rounded-lg ${
          SIZES[size]
        } ${tone === "danger" ? "border-danger-border" : ""}`}
      >
        {poignee}

        {hasHeader && (
          <header
            className="app-modal-header app-modal-poignee shrink-0 border-b border-border p-4 sm:p-5"
            onTouchStart={debutGeste}
            onTouchMove={suivreGeste}
            onTouchEnd={finGeste}
            onTouchCancel={finGeste}
          >
            {/* La croix reste en haut à droite, sur la ligne du titre.
                Elle occupait une ligne entière à elle seule sur
                téléphone, parce qu'elle partageait un bloc avec
                `headerAside` que l'en-tête empilait sous le titre. */}
            <div className="flex items-start gap-3">
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
              <div className="min-w-0 flex-1">
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
              <button
                type="button"
                onClick={fermer}
                className="app-btn-icon -mr-1 -mt-1 h-9 w-9 shrink-0"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {headerAside && (
              <div className="mt-3 flex flex-wrap items-center gap-2">{headerAside}</div>
            )}
          </header>
        )}

        <div
          className={`app-modal-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          // Le pied ne défile pas : sur un formulaire long, le bouton
          // d'enregistrement reste sous le pouce. La marge basse laisse
          // passer la barre gestuelle des téléphones sans encoche
          // logicielle.
          <footer
            className="app-modal-footer flex shrink-0 flex-col-reverse gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:p-5 sm:pb-5"
            style={{ boxShadow: "var(--elev-2)" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
};
