import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Courbes qui traversent lentement le fond d'une carte.
 *
 * Reprises du modèle de page d'authentification proposé, mais réduites à
 * ce que la maquette demande : quelques longues courbes qui balaient la
 * carte, et trois points posés dessus. Le modèle en dessinait
 * soixante-douze, animées en continu — beaucoup de travail demandé au
 * compositeur pour un motif qu'on ne regarde pas, et un dessin chargé là
 * où la maquette veut du calme.
 *
 * Le trait avance par décalage de pointillés plutôt que par déplacement
 * du chemin : la courbe reste immobile, seule la lumière la parcourt.
 * C'est ce qui donne le mouvement lent voulu, sans que rien ne bouge à
 * l'écran.
 *
 * La couleur vient de `currentColor` : l'appelant décide du ton.
 */

const COURBES = [
  "M-40 300 C 180 300, 300 210, 520 190 S 900 150, 1120 90",
  "M-40 350 C 200 348, 340 262, 560 238 S 940 196, 1160 128",
  "M-40 402 C 220 398, 380 316, 600 288 S 980 244, 1200 170",
  "M-40 456 C 240 450, 420 372, 640 340 S 1020 294, 1240 214",
  "M-40 512 C 260 504, 460 430, 680 394 S 1060 346, 1280 260",
];

const POINTS = [
  { cx: 300, cy: 253, r: 4 },
  { cx: 560, cy: 330, r: 3.5 },
  { cx: 640, cy: 300, r: 3 },
  { cx: 1108, cy: 232, r: 4 },
];

export const CourbesFond: React.FC<{ className?: string }> = ({ className = "" }) => {
  const mouvementReduit = useReducedMotion() ?? false;

  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 560"
      preserveAspectRatio="xMidYMax slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      fill="none"
    >
      {COURBES.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={1.1}
          strokeOpacity={0.5 - i * 0.06}
          strokeLinecap="round"
          {...(mouvementReduit
            ? {}
            : {
                strokeDasharray: "260 1400",
                animate: { strokeDashoffset: [0, -1660] },
                transition: {
                  duration: 26 + i * 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                },
              })}
        />
      ))}

      {POINTS.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill="currentColor"
          fillOpacity={0.45}
          {...(mouvementReduit
            ? {}
            : {
                animate: { fillOpacity: [0.25, 0.6, 0.25] },
                transition: {
                  duration: 4 + i,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "mirror" as const,
                },
              })}
        />
      ))}
    </svg>
  );
};

/**
 * Les courbes, montées seulement là où on les verra.
 *
 * Un élément masqué reste monté, et ses animations continuent de
 * tourner. Sur les téléphones que vise ce logiciel, cela reviendrait à
 * faire payer une décoration invisible.
 */
export const CourbesSiVisible: React.FC<{ largeurMinimale?: number; className?: string }> = ({
  largeurMinimale = 640,
  className,
}) => {
  const [assezLarge, setAssezLarge] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia(`(min-width: ${largeurMinimale}px)`);
    const suivre = () => setAssezLarge(requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  }, [largeurMinimale]);

  if (!assezLarge) return null;
  return <CourbesFond className={className} />;
};
