import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IcFermer } from "./icones";

/**
 * LE PANNEAU LATÉRAL DE LA MAQUETTE
 *
 * Même comportement que celui du tableau de bord v2 (`dashboard-v2/
 * components/Drawer.tsx`), dont il reprend la mécanique : sorti à la
 * racine du document par un portail (l'application anime l'entrée de
 * chaque vue par une transformation, qui décalerait un `position:
 * fixed` resté dans l'arbre), Échap ferme, la tabulation tourne à
 * l'intérieur, le focus revient à l'élément qui l'a ouvert. Le style
 * est celui de cette maquette (`.org2-portal .drawer`).
 */

const FOCALISABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}) => {
  const [monte, setMonte] = useState(false);
  const [present, setPresent] = useState(open);
  const [montre, setMontre] = useState(false);
  const panneau = useRef<HTMLElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const origine = useRef<HTMLElement | null>(null);
  const idTitre = useId();

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (open) {
      if (!present) origine.current = document.activeElement as HTMLElement | null;
      setPresent(true);
      const t = window.setTimeout(() => setMontre(true), 10);
      return () => window.clearTimeout(t);
    }
    setMontre(false);
    const t = window.setTimeout(() => setPresent(false), 200);
    origine.current?.focus?.();
    return () => window.clearTimeout(t);
    // `present` est lu sans être suivi : seul le passage ouvert/fermé compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (montre && corps.current) corps.current.scrollTop = 0;
  }, [montre, title]);

  useEffect(() => {
    if (!present) return;
    panneau.current?.focus({ preventScroll: true });
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panneau.current) return;
      const cibles = Array.from(panneau.current.querySelectorAll<HTMLElement>(FOCALISABLES));
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [present, onClose]);

  const fermer = useCallback(() => onClose(), [onClose]);

  if (!monte || !present) return null;

  return createPortal(
    <div className="org2-portal">
      <div className={`scrim${montre ? " on" : ""}`} onClick={fermer} aria-hidden="true" />
      <aside
        ref={panneau}
        className={`drawer${montre ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
      >
        <div className="dh">
          <div>
            <h3 id={idTitre}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="iconbtn" onClick={fermer} aria-label="Fermer">
            <IcFermer />
          </button>
        </div>
        <div className="db" ref={corps}>
          {children}
        </div>
        {footer && <div className="df">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
};
