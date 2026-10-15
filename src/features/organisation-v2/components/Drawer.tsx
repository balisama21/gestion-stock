import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IcFermer } from "./icones";

/**
 * LE PANNEAU LATÉRAL DE LA MAQUETTE
 *
 * Même mécanique que celui du tableau de bord v2 (`dashboard-v2/
 * components/Drawer.tsx`) : sorti à la racine du document par un
 * portail (l'application anime l'entrée de chaque vue par une
 * transformation, qui décalerait un `position: fixed` resté dans
 * l'arbre), Échap ferme, la tabulation tourne à l'intérieur, le focus
 * revient à l'élément qui l'a ouvert.
 *
 * Ici le contenu compose lui-même son en-tête, son corps et son pied
 * (`DrawerTete`, `DrawerCorps`, `DrawerPied`) : chaque fiche et chaque
 * formulaire a son titre et ses boutons, qui dépendent de son état.
 */

const FOCALISABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ID_TITRE_PANNEAU = "org2-panneau-titre";

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, onClose, children }) => {
  const [monte, setMonte] = useState(false);
  const [present, setPresent] = useState(open);
  const [montre, setMontre] = useState(false);
  const panneau = useRef<HTMLElement>(null);
  const origine = useRef<HTMLElement | null>(null);

  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (open) {
      if (!origine.current) origine.current = document.activeElement as HTMLElement | null;
      setPresent(true);
      const t = window.setTimeout(() => setMontre(true), 10);
      return () => window.clearTimeout(t);
    }
    setMontre(false);
    const t = window.setTimeout(() => setPresent(false), 200);
    origine.current?.focus?.();
    origine.current = null;
    return () => window.clearTimeout(t);
  }, [open]);

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

  if (!monte || !present) return null;

  return createPortal(
    <div className="org2-portal">
      <div className={`scrim${montre ? " on" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panneau}
        className={`drawer${montre ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ID_TITRE_PANNEAU}
        tabIndex={-1}
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
};

export const DrawerTete: React.FC<{ titre: string; sous?: string; onClose: () => void }> = ({
  titre,
  sous,
  onClose,
}) => (
  <div className="dh">
    <div>
      <h3 id={ID_TITRE_PANNEAU}>{titre}</h3>
      {sous && <p>{sous}</p>}
    </div>
    <button type="button" className="iconbtn" onClick={onClose} aria-label="Fermer">
      <IcFermer />
    </button>
  </div>
);

export const DrawerCorps: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="db">{children}</div>
);

export const DrawerPied: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="df">{children}</div>
);
