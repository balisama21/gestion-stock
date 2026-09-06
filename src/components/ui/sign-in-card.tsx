import React, { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

/**
 * Enveloppe de la carte de connexion : relief au pointeur et faisceau
 * qui parcourt la bordure.
 *
 * Reprise d'un modèle en verre noir sur fond violet. Ce qui a été gardé,
 * c'est la mécanique — l'inclinaison qui suit la souris, le trait de
 * lumière qui fait le tour du cadre, la respiration du halo. Ce qui a
 * été laissé, c'est sa palette : la page est du papier, et le vert de la
 * marque y reste la seule couleur d'action.
 *
 * Un faisceau blanc n'aurait rien donné sur du papier clair ; il est ici
 * dans le vert de la marque, et ne se voit que par intermittence, comme
 * un reflet qui passe.
 *
 * Quatre écarts avec le modèle, tous délibérés :
 *
 * - le contenu n'est pas repris. Le formulaire de l'application gère la
 *   connexion, l'inscription, l'activation par code et la demande de
 *   réinitialisation ; le remplacer par le formulaire de démonstration
 *   aurait coûté quatre parcours pour gagner une apparence ;
 * - pas de case « se souvenir de moi » : la session Supabase persiste
 *   déjà, et une case qui ne commande rien ment à celui qui la coche ;
 * - pas de `next/link`, absent de ce projet ;
 * - l'inclinaison ne se déclenche qu'au pointeur fin. Sur un écran
 *   tactile, elle ne surviendrait qu'au moment du toucher, en faisant
 *   fuir la cible sous le doigt.
 */

export interface CarteConnexionProps {
  children: React.ReactNode;
  className?: string;
}

export const CarteConnexion: React.FC<CarteConnexionProps> = ({ children, className = "" }) => {
  const mouvementReduit = useReducedMotion() ?? false;
  const cadre = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 18 });
  const sy = useSpring(y, { stiffness: 120, damping: 18 });
  // Amplitude modeste : au-delà, la carte se déforme plus qu'elle ne
  // s'incline, et le texte d'un formulaire devient pénible à viser.
  const rotateX = useTransform(sy, [-260, 260], [6, -6]);
  const rotateY = useTransform(sx, [-260, 260], [-6, 6]);

  const finPointeur = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !mouvementReduit;

  const suivre = (e: React.PointerEvent<HTMLDivElement>) => {
    const noeud = cadre.current;
    if (!noeud || !finPointeur()) return;
    const r = noeud.getBoundingClientRect();
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  };

  const relacher = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className={className} style={{ perspective: 1400 }}>
      <style>{`
        @keyframes cc-haut   { from { left: -45%  } to { left: 100% } }
        @keyframes cc-droite { from { top: -45%   } to { top: 100%  } }
        @keyframes cc-bas    { from { right: -45% } to { right: 100% } }
        @keyframes cc-gauche { from { bottom: -45%} to { bottom: 100% } }

        .carte-connexion .cc-faisceau { position: absolute; opacity: 0; }
        .carte-connexion .cc-h,
        .carte-connexion .cc-b { height: 2px; width: 45%; }
        .carte-connexion .cc-d,
        .carte-connexion .cc-g { width: 2px; height: 45%; }

        .carte-connexion .cc-h { top: 0; left: -45%;
          background: linear-gradient(to right, transparent, var(--primary), transparent);
          animation: cc-haut 4s ease-in-out infinite; }
        .carte-connexion .cc-d { top: -45%; right: 0;
          background: linear-gradient(to bottom, transparent, var(--primary), transparent);
          animation: cc-droite 4s ease-in-out 1s infinite; }
        .carte-connexion .cc-b { bottom: 0; right: -45%;
          background: linear-gradient(to left, transparent, var(--primary), transparent);
          animation: cc-bas 4s ease-in-out 2s infinite; }
        .carte-connexion .cc-g { bottom: -45%; left: 0;
          background: linear-gradient(to top, transparent, var(--primary), transparent);
          animation: cc-gauche 4s ease-in-out 3s infinite; }

        .carte-connexion .cc-faisceau { opacity: .55; }

        @media (prefers-reduced-motion: reduce) {
          .carte-connexion .cc-faisceau { display: none; }
        }
      `}</style>

      <motion.div
        ref={cadre}
        onPointerMove={suivre}
        onPointerLeave={relacher}
        style={mouvementReduit ? undefined : { rotateX, rotateY }}
        className="carte-connexion relative"
      >
        {/* Le trait de lumière qui fait le tour du cadre. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px overflow-hidden rounded-2xl"
        >
          <span className="cc-faisceau cc-h" />
          <span className="cc-faisceau cc-d" />
          <span className="cc-faisceau cc-b" />
          <span className="cc-faisceau cc-g" />
        </div>

        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-7"
          style={{
            background: "var(--papier)",
            border: "1px solid var(--reglure)",
            boxShadow: "0 30px 60px -40px rgba(28,27,24,.45)",
          }}
        >
          {/* Trame très légère, reprise de la réglure du cahier. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0 27px, var(--reglure) 27px 28px)",
            }}
          />
          <div className="relative">{children}</div>
        </div>
      </motion.div>
    </div>
  );
};

export default CarteConnexion;
