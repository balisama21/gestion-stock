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

    // Déjà à hauteur d'écran, ou déjà dépassé : on montre sans attendre.
    // Sans ce contrôle, arriver directement en bas de page — par un lien
    // d'ancrage, ou en restaurant une position de défilement — laissait
    // définitivement invisible tout ce qui se trouvait au-dessus, puisque
    // ces blocs n'avaient jamais croisé l'écran.
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
      // Déclenche un peu avant que le bloc ne touche le bas de l'écran :
      // l'apparition doit être finie quand le regard y arrive.
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );

    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delai}ms` : "0ms" }}
    >
      {children}
    </div>
  );
};
