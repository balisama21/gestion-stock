import React, { useRef, useState } from "react";

interface CarteReliefProps {
  children: React.ReactNode;
  className?: string;
  /** Amplitude de l'inclinaison, en degrés. */
  amplitude?: number;
}

/**
 * Carte qui s'incline vers le pointeur.
 *
 * Le relief est obtenu par une perspective et deux rotations CSS, sans
 * moteur 3D : une bibliothèque comme three.js pèserait plusieurs
 * centaines de kilo-octets pour un effet que le compositeur du
 * navigateur produit gratuitement, et sur les téléphones visés le poids
 * du téléchargement compte davantage que la richesse de l'effet.
 *
 * L'inclinaison est réservée aux pointeurs fins. Sur un écran tactile
 * il n'existe pas de survol : l'effet ne se déclencherait qu'au moment
 * du toucher, c'est-à-dire au pire moment, en faisant fuir la cible sous
 * le doigt.
 */
export const CarteRelief: React.FC<CarteReliefProps> = ({
  children,
  className = "",
  amplitude = 7,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transformation, setTransformation] = useState<string>("");

  const finPointeur = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const suivre = (e: React.PointerEvent<HTMLDivElement>) => {
    const noeud = ref.current;
    if (!noeud || !finPointeur()) return;
    const boite = noeud.getBoundingClientRect();
    // Position du pointeur ramenée à l'intervalle [-0,5 ; 0,5].
    const x = (e.clientX - boite.left) / boite.width - 0.5;
    const y = (e.clientY - boite.top) / boite.height - 0.5;
    setTransformation(
      `perspective(900px) rotateX(${(-y * amplitude).toFixed(2)}deg) rotateY(${(x * amplitude).toFixed(2)}deg) translateZ(6px)`,
    );
  };

  return (
    <div
      ref={ref}
      onPointerMove={suivre}
      onPointerLeave={() => setTransformation("")}
      style={{ transform: transformation, transformStyle: "preserve-3d" }}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  );
};
