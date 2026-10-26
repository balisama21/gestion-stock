import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useClicExterieur } from "../../hooks/useClicExterieur";

/**
 * LE PIED D'UNE FICHE, RANGÉ D'OFFICE
 *
 * Une fiche de devis alignait jusqu'à sept boutons — imprimer,
 * transformer en vente, modifier, marquer envoyé, accepté, refusé,
 * supprimer — sur trois rangées. Rien ne disait lequel comptait, et
 * « Supprimer » restait à portée de doigt de « Modifier ».
 *
 * Ce composant lit les boutons que l'écran lui passe, sans que l'écran
 * ait à changer d'écriture, et les range comme le font les grandes
 * plateformes :
 *
 * - l'action principale (`app-btn-primary`) tout à droite ;
 * - jusqu'à deux actions courantes à côté d'elle, autant que la largeur
 *   du pied en laisse tenir — mesurée, pas devinée ;
 * - le reste dans un menu « Plus », à gauche, où ce qui détruit
 *   (`app-btn-danger`) vient en dernier, séparé d'un filet.
 *
 * Jusqu'à trois actions, rien ne change : elles tiennent sur une ligne
 * et un menu ne ferait que cacher ce qu'on voit déjà. Et si le pied
 * contient autre chose que des boutons — un champ, un composant —, il
 * est rendu tel quel : on ne range que ce qu'on sait lire.
 */

/** Au-delà de ce nombre d'actions, le pied se range. */
const SEUIL = 4;

type Bouton = React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>>;

/** Les boutons du pied, fragments et conditions dépliés. */
function deplier(noeud: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(noeud).flatMap((enfant) =>
    React.isValidElement(enfant) && enfant.type === React.Fragment
      ? deplier((enfant.props as { children?: React.ReactNode }).children)
      : [enfant],
  );
}

const estBouton = (n: React.ReactNode): n is Bouton =>
  React.isValidElement(n) && n.type === "button";

const classe = (b: Bouton) => b.props.className ?? "";

/** `useLayoutEffect` côté navigateur seulement : le rendu serveur n'a
    rien à mesurer et préviendrait à chaque page. */
const useEffetDeMiseEnPage = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Au plus, ce nombre d'actions courantes restent en vue. */
const VISIBLES_MAX = 2;

export const PiedActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ouvert, setOuvert] = useState(false);
  const [visibles, setVisibles] = useState(VISIBLES_MAX);
  const zone = useRef<HTMLDivElement>(null);
  const pied = useRef<HTMLDivElement>(null);
  const droite = useRef<HTMLDivElement>(null);
  const fermer = useCallback(() => setOuvert(false), []);
  useClicExterieur(zone, ouvert, fermer);

  // Ce qui tient dépend de la largeur de la FICHE, et des mots : « Voir,
  // PDF, imprimer » ne prend pas la place de « Reçu ». On mesure donc.
  // Tant que les actions débordent du pied — à gauche, puisqu'elles sont
  // calées à droite —, la dernière action courante passe dans le menu.
  useEffetDeMiseEnPage(() => {
    const boite = droite.current;
    if (!boite || visibles === 0) return;
    const premier = boite.firstElementChild?.getBoundingClientRect();
    if (premier && premier.left < boite.getBoundingClientRect().left - 1) {
      setVisibles((n) => Math.max(0, n - 1));
    }
  });

  // Quand la fiche change de largeur (rotation, fenêtre), on remesure
  // depuis le début.
  useEffect(() => {
    const el = pied.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let largeur = el.clientWidth;
    const obs = new ResizeObserver(() => {
      if (el.clientWidth === largeur) return;
      largeur = el.clientWidth;
      setVisibles(VISIBLES_MAX);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const elements = deplier(children);
  if (elements.length < SEUIL || !elements.every(estBouton)) return <>{children}</>;
  const boutons = elements as Bouton[];

  const principale = boutons.find((b) => classe(b).includes("app-btn-primary")) ?? null;
  const danger = boutons.filter((b) => classe(b).includes("app-btn-danger"));
  const courantes = boutons.filter((b) => b !== principale && !danger.includes(b));
  const enVue = courantes.slice(0, visibles);
  const autres = courantes.slice(visibles);

  /** Un bouton du pied, recopié en ligne de menu. */
  const enLigne = (b: Bouton, cle: string) =>
    React.cloneElement(b, {
      key: cle,
      type: b.props.type ?? "button",
      className: `app-menu-item ${classe(b).includes("app-btn-danger") ? "t-danger" : ""}`,
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        setOuvert(false);
        b.props.onClick?.(e);
      },
    });

  return (
    <div ref={pied} className="app-pied">
      {autres.length + danger.length > 0 && (
        <div ref={zone} className="app-pied-plus">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
            className="app-btn-secondary app-pied-plus-bouton"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>Plus</span>
          </button>
          {ouvert && (
            <div className="app-menu app-pied-menu" role="group" aria-label="Autres actions">
              {autres.map((b, i) => enLigne(b, `autre-${i}`))}
              {danger.length > 0 && autres.length > 0 && <div className="my-1 h-px bg-border" />}
              {danger.map((b, i) => enLigne(b, `danger-${i}`))}
            </div>
          )}
        </div>
      )}
      <div ref={droite} className="app-pied-droite">
        {enVue}
        {principale}
      </div>
    </div>
  );
};
