import React, { useEffect, useRef, useState } from "react";

interface RevelProps {
  children: React.ReactNode;
  /** Décalage en millisecondes, pour faire apparaître une série en cascade. */
  delai?: number;
  className?: string;
}

/**
 * Fait apparaître son contenu lorsqu'il entre dans l'écran.
 *
 * Un `IntersectionObserver` plutôt qu'un écouteur de défilement : le
 * navigateur fait le travail hors du fil principal, et rien n'est
 * recalculé à chaque pixel parcouru. L'observation cesse dès la première
 * apparition — une section déjà vue n'a plus rien à annoncer.
 *
 * Un bloc déjà à hauteur d'écran, ou déjà dépassé, se montre sans
 * attendre : sans ce contrôle, arriver directement au milieu de la page
 * — par une ancre, ou en restaurant une position de défilement —
 * laisserait invisible tout ce qui se trouve au-dessus, puisque ces
 * blocs n'auraient jamais croisé l'écran.
 *
 * Qui a désactivé les animations voit le contenu posé d'emblée.
 */
export const Revele: React.FC<RevelProps> = ({ children, delai = 0, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const noeud = ref.current;
    if (!noeud) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    if (noeud.getBoundingClientRect().top < window.innerHeight) {
      setVisible(true);
      return;
    }

    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      // Seuil nul : le moindre pixel entrant suffit. Avec un seuil en
      // pourcentage, une rangée haute pouvait traverser l'écran sans
      // jamais en exposer la fraction demandée pendant un défilement
      // rapide, et restait alors invisible pour de bon.
      { threshold: 0, rootMargin: "0px 0px -40px 0px" },
    );

    observateur.observe(noeud);

    // Filet de sécurité : l'observateur signale une ENTRÉE dans l'écran.
    // Un bloc que l'on dépasse d'un bond — ancre, position de défilement
    // restaurée, molette rapide — peut se retrouver au-dessus sans y être
    // jamais entré, et resterait alors invisible pour de bon. Ce contrôle
    // au défilement le rattrape, puis se retire.
    const rattraper = () => {
      if (!noeud.isConnected) return;
      if (noeud.getBoundingClientRect().top < window.innerHeight) {
        setVisible(true);
        observateur.disconnect();
        window.removeEventListener("scroll", rattraper);
      }
    };
    window.addEventListener("scroll", rattraper, { passive: true });

    return () => {
      observateur.disconnect();
      window.removeEventListener("scroll", rattraper);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delai}ms` : "0ms" }}
    >
      {children}
    </div>
  );
};
