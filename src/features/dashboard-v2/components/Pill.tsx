import React, { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * LES BOUTONS EN GÉLULE DE L'EN-TÊTE, ET LEUR MENU
 *
 * Trois formes : un bouton simple, un bouton à deux états (le mode
 * focus), et un bouton qui ouvre un menu (la période, la vue).
 *
 * CE QUE LE MENU DOIT SAVOIR FAIRE, et que la maquette fait déjà :
 * se fermer sur Échap et rendre le focus au bouton, se fermer sur un
 * clic à côté, et donner le focus à l'option cochée à l'ouverture.
 * Sans le retour de focus, la tabulation repart du haut de la page à
 * chaque fermeture.
 */

const CHEVRON = (
  <svg
    className="chev"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const Pill: React.FC<{
  onClick?: () => void;
  pressed?: boolean;
  square?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, pressed, square, title, ariaLabel, className = "", children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={ariaLabel}
    {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
    className={`pill${square ? " square" : ""}${className ? ` ${className}` : ""}`}
  >
    {children}
  </button>
);

export interface MenuPillProps {
  /** Icône à gauche, dans le bouton. */
  icon?: React.ReactNode;
  /** Libellé gris, masqué sur petit écran. */
  label?: string;
  /** Valeur en gras, dans le bouton. */
  value: string;
  ariaLabel?: string;
  /** Le menu s'aligne à gauche du bouton plutôt qu'à droite. */
  alignLeft?: boolean;
  /** Reçoit une fonction pour refermer le menu depuis une option. */
  children: (fermer: () => void) => React.ReactNode;
  className?: string;
}

export const MenuPill: React.FC<MenuPillProps> = ({
  icon,
  label,
  value,
  ariaLabel,
  alignLeft = false,
  children,
  className = "",
}) => {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  const fermer = useCallback(() => {
    setOuvert(false);
    bouton.current?.focus();
  }, []);

  useEffect(() => {
    if (!ouvert) return;

    // Le focus part sur l'option déjà cochée : c'est de là que
    // l'utilisateur veut se déplacer, pas du premier choix de la liste.
    const cochee = menu.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (cochee ?? menu.current?.querySelector<HTMLElement>(".opt"))?.focus();

    const auClic = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fermer();
      }
    };
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert, fermer]);

  return (
    <div className={`menu-holder ${className}`} ref={boite}>
      <button
        ref={bouton}
        type="button"
        className="pill"
        aria-haspopup="true"
        aria-expanded={ouvert}
        aria-controls={idMenu}
        aria-label={ariaLabel}
        onClick={() => setOuvert((o) => !o)}
      >
        {icon}
        {label && <span className="pill-label">{label}</span>}
        <b>{value}</b>
        {CHEVRON}
      </button>
      {ouvert && (
        <div className={`menu${alignLeft ? " left" : ""}`} id={idMenu} role="menu" ref={menu}>
          {children(fermer)}
        </div>
      )}
    </div>
  );
};

export const MenuOption: React.FC<{
  checked: boolean;
  onClick: () => void;
  /** Mention grise à droite, souvent une date. */
  hint?: string;
  children: React.ReactNode;
}> = ({ checked, onClick, hint, children }) => (
  <button
    type="button"
    className="opt"
    role="menuitemradio"
    aria-checked={checked}
    onClick={onClick}
  >
    {children}
    {hint && <small>{hint}</small>}
  </button>
);
