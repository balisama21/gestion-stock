import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * LE PANNEAU DE DÉTAIL
 *
 * Il ouvre le détail d'une carte sans quitter le tableau de bord :
 * colonne de 460 px à droite sur ordinateur, feuille qui monte du bas
 * sur téléphone. Son pied de page mène ensuite vers l'écran complet.
 *
 * IL SORT À LA RACINE DU DOCUMENT. Un élément en `position: fixed` se
 * positionne par rapport à l'écran — sauf si un ancêtre porte une
 * transformation, auquel cas il se positionne par rapport à cet
 * ancêtre. L'application anime l'entrée de chaque vue par un
 * `translateY` (`.app-vue`) : laissé dans l'arbre, le panneau pourrait
 * s'ouvrir de travers. Le conteneur du portail porte la classe
 * `dash2-portal`, qui lui rend les couleurs que l'arbre lui a retirées.
 *
 * CE QU'IL DOIT AU CLAVIER : Échap ferme, la tabulation tourne en rond
 * à l'intérieur tant qu'il est ouvert, et le focus revient à l'élément
 * qui l'a ouvert. Sans ce retour, la tabulation reprend en haut de la
 * page et on a perdu sa place.
 *
 * LA FERMETURE EST DIFFÉRÉE de 200 ms, le temps que la transition se
 * joue. `visible` commande la présence dans le document, `montre`
 * commande la classe qui anime.
 */

const CROIX = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const FOCALISABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Une ligne grise sous le titre : ce que le panneau montre au juste. */
  subtitle?: string;
  /** Les boutons du pied de page. Absent : pas de pied de page. */
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

  // Le portail a besoin de `document`, que le rendu serveur n'a pas.
  useEffect(() => setMonte(true), []);

  useEffect(() => {
    if (open) {
      origine.current = document.activeElement as HTMLElement | null;
      setPresent(true);
      const t = window.setTimeout(() => setMontre(true), 10);
      return () => window.clearTimeout(t);
    }
    setMontre(false);
    const t = window.setTimeout(() => setPresent(false), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  // Le contenu change d'un panneau à l'autre : on repart du haut.
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

  const fermer = useCallback(() => {
    onClose();
    origine.current?.focus?.();
  }, [onClose]);

  if (!monte || !present) return null;

  return createPortal(
    <div className="dash2-portal">
      <div className={`dash2-scrim${montre ? " on" : ""}`} onClick={fermer} aria-hidden="true" />
      <aside
        ref={panneau}
        className={`dash2-drawer${montre ? " on" : ""}`}
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
          <button type="button" className="close" onClick={fermer} aria-label="Fermer le panneau">
            {CROIX}
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

/** Une ligne du panneau : intitulé, précision grise, valeur à droite. */
export const DrawerLigne: React.FC<{
  titre: string;
  detail?: string;
  valeur?: React.ReactNode;
}> = ({ titre, detail, valeur }) => (
  <div className="li">
    <b>{titre}</b>
    {typeof valeur === "string" || typeof valeur === "number" ? (
      <span className="num">{valeur}</span>
    ) : (
      (valeur ?? <span />)
    )}
    {detail && <small>{detail}</small>}
  </div>
);

export const DrawerTotal: React.FC<{ libelle: string; valeur: string }> = ({ libelle, valeur }) => (
  <div className="total">
    <span>{libelle}</span>
    <span className="num">{valeur}</span>
  </div>
);
