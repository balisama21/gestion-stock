import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Tracés qui dérivent lentement en arrière-plan.
 *
 * Repris du modèle de page d'authentification proposé. Deux choses y ont
 * changé.
 *
 * Le nombre de courbes : trente-six par sens, soit soixante-douze
 * chemins animés en continu. C'est beaucoup de travail demandé au
 * compositeur pour un motif qu'on ne regarde pas ; il en reste seize par
 * sens, et le dessin est le même à l'oeil.
 *
 * Le montage : le panneau qui les porte est masqué sous 1 024 pixels,
 * mais un élément masqué reste monté, et ses animations continuent de
 * tourner. Sur les téléphones que vise ce logiciel, cela revient à faire
 * payer une décoration jamais vue. Le composant ne se monte donc qu'au
 * delà de cette largeur, et se démonte si l'on repasse en dessous.
 *
 * La couleur vient de `currentColor` : c'est l'appelant qui décide du
 * ton, au lieu d'un bleu ardoise codé en dur.
 */
export function FloatingPaths({ position }: { position: number }) {
  const chemins = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 11 * position} -${189 + i * 13}C-${380 - i * 11 * position} -${
      189 + i * 13
    } -${312 - i * 11 * position} ${216 - i * 13} ${152 - i * 11 * position} ${
      343 - i * 13
    }C${616 - i * 11 * position} ${470 - i * 13} ${684 - i * 11 * position} ${
      875 - i * 13
    } ${684 - i * 11 * position} ${875 - i * 13}`,
    epaisseur: 0.5 + i * 0.07,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" viewBox="0 0 696 316" fill="none" aria-hidden>
        {chemins.map((c) => (
          <motion.path
            key={c.id}
            d={c.d}
            stroke="currentColor"
            strokeWidth={c.epaisseur}
            strokeOpacity={0.08 + c.id * 0.02}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 22 + c.id,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Les tracés, montés seulement là où on les verra.
 *
 * `largeurMinimale` correspond au point de rupture à partir duquel le
 * panneau qui les porte devient visible.
 */
export const TracesFlottants: React.FC<{ largeurMinimale?: number }> = ({
  largeurMinimale = 1024,
}) => {
  const mouvementReduit = useReducedMotion() ?? false;
  const [assezLarge, setAssezLarge] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia(`(min-width: ${largeurMinimale}px)`);
    const suivre = () => setAssezLarge(requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  }, [largeurMinimale]);

  if (!assezLarge || mouvementReduit) return null;

  return (
    <>
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </>
  );
};
