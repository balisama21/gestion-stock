import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * Héros à morphose : des cartes se rassemblent, forment un cercle, puis
 * se déploient en arc à mesure que la page défile.
 *
 * Adapté d'un composant de galerie. Trois de ses choix ont été refaits,
 * et il vaut mieux savoir lesquels :
 *
 * 1. L'original confisquait la molette et le toucher — `preventDefault`
 *    sur `wheel` et `touchmove` — pour alimenter un défilement virtuel.
 *    Le visiteur se retrouvait prisonnier du héros : impossible
 *    d'atteindre quoi que ce soit en dessous tant que trois mille pixels
 *    virtuels n'avaient pas été parcourus. Ici la section est simplement
 *    haute, sa scène est `sticky`, et l'animation suit la progression du
 *    défilement réel. La page reste une page.
 *
 * 2. L'original s'abonnait à trois valeurs animées pour les recopier
 *    dans des états React, ce qui provoquait un rendu de l'arbre entier
 *    à chaque image. Ici chaque carte dérive ses propres coordonnées de
 *    valeurs animées : le compositeur travaille seul, React ne rend rien
 *    pendant le défilement.
 *
 * 3. Les faces portaient vingt photos distantes. Le contenu est laissé
 *    à l'appelant, qui fournit ce qu'il veut montrer.
 *
 * Le mouvement se coupe entièrement si les animations sont refusées :
 * les cartes prennent alors leur position finale, sans transition.
 */

export interface ScrollMorphHeroProps {
  /** Face avant de chaque carte, dans l'ordre. */
  cartes: readonly React.ReactNode[];
  /** Texte de la face arrière, révélée au survol. */
  etiquettes?: readonly string[];
  /** Affiché au centre au départ, puis effacé par la morphose. */
  introduction?: React.ReactNode;
  /** Affiché en haut une fois l'arc formé. */
  contenu?: React.ReactNode;
  /** Dimensions d'une carte, en pixels. */
  largeurCarte?: number;
  hauteurCarte?: number;
  className?: string;
}

type Phase = "dispersion" | "ligne" | "cercle";

interface CarteProps {
  index: number;
  total: number;
  phase: Phase;
  dispersion: { x: number; y: number; rotation: number };
  morphose: MotionValue<number>;
  parallaxe: MotionValue<number>;
  taille: { largeur: number; hauteur: number };
  dimensions: { l: number; h: number };
  avant: React.ReactNode;
  arriere?: string;
  mouvementReduit: boolean;
}

const interpoler = (depart: number, arrivee: number, t: number) => depart * (1 - t) + arrivee * t;

/** Géométrie d'une carte, pour une progression de morphose donnée. */
function position(
  index: number,
  total: number,
  m: number,
  parallaxe: number,
  l: number,
  h: number,
) {
  const petitEcran = l < 768;
  const plusPetiteDimension = Math.min(l, h);

  // Le cercle de départ.
  const rayonCercle = Math.min(plusPetiteDimension * 0.35, 320);
  const angleCercle = (index / total) * 360;
  const radCercle = (angleCercle * Math.PI) / 180;

  // L'arc d'arrivée : une voûte, sommet vers le haut.
  //
  // Le rayon est délibérément court. Une voûte trop profonde envoie ses
  // extrémités bien au-delà du cadre : mesuré sur un écran de 1 280
  // pixels, la première version étalait les cartes sur 2 654 pixels et
  // n'en laissait voir qu'une poignée au centre. Ici, la corde de l'arc
  // reste de l'ordre de la largeur disponible.
  const rayonArc = Math.min(l * 0.5, h * 0.78);
  // Le sommet, mesuré depuis le centre de la scène. Assez bas pour que la
  // voûte passe sous le texte qui l'accompagne, assez haut pour qu'elle
  // se lise comme une voûte.
  const sommet = -h / 2 + h * (petitEcran ? 0.46 : 0.42);
  const centreArc = sommet + rayonArc;
  const ouverture = petitEcran ? 122 : 150;
  const depart = -90 - ouverture / 2;
  const pas = ouverture / Math.max(total - 1, 1);
  const angle = depart + index * pas;
  const radArc = (angle * Math.PI) / 180;

  return {
    x: interpoler(Math.cos(radCercle) * rayonCercle, Math.cos(radArc) * rayonArc + parallaxe, m),
    y: interpoler(Math.sin(radCercle) * rayonCercle, Math.sin(radArc) * rayonArc + centreArc, m),
    rotation: interpoler(angleCercle + 90, angle + 90, m),
    echelle: interpoler(1, petitEcran ? 1.05 : 1.35, m),
  };
}

const Carte: React.FC<CarteProps> = ({
  index,
  total,
  phase,
  dispersion,
  morphose,
  parallaxe,
  taille,
  dimensions,
  avant,
  arriere,
  mouvementReduit,
}) => {
  const { l, h } = dimensions;

  // Chaque coordonnée est dérivée des valeurs animées : aucun rendu React
  // n'a lieu pendant le défilement.
  const geo = useTransform([morphose, parallaxe], ([m, p]) =>
    position(index, total, m as number, p as number, l, h),
  );
  const xMorph = useTransform(geo, (g) => g.x);
  const yMorph = useTransform(geo, (g) => g.y);
  const rMorph = useTransform(geo, (g) => g.rotation);
  const sMorph = useTransform(geo, (g) => g.echelle);

  const enCercle = phase === "cercle";
  const espacement = taille.largeur + 10;

  const cible =
    phase === "dispersion"
      ? { x: dispersion.x, y: dispersion.y, rotate: dispersion.rotation, scale: 0.6, opacity: 0 }
      : phase === "ligne"
        ? {
            x: index * espacement - (total * espacement) / 2,
            y: 0,
            rotate: 0,
            scale: 1,
            opacity: 1,
          }
        : { opacity: 1 };

  return (
    <motion.div
      animate={cible}
      transition={
        mouvementReduit ? { duration: 0 } : { type: "spring", stiffness: 40, damping: 15 }
      }
      style={{
        position: "absolute",
        width: taille.largeur,
        height: taille.hauteur,
        perspective: 1000,
        ...(enCercle ? { x: xMorph, y: yMorph, rotate: rMorph, scale: sMorph } : null),
      }}
      className="group"
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        whileHover={mouvementReduit || !arriere ? undefined : { rotateY: 180 }}
      >
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-md"
          style={{ backfaceVisibility: "hidden", boxShadow: "0 14px 30px -20px rgba(28,27,24,.6)" }}
        >
          {avant}
        </div>

        {arriere && (
          <div
            className="absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden rounded-md px-2 text-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "var(--carbone, #1c1b18)",
              boxShadow: "0 14px 30px -20px rgba(28,27,24,.6)",
            }}
          >
            <span className="text-[9px] font-medium leading-tight text-white">{arriere}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export const ScrollMorphHero: React.FC<ScrollMorphHeroProps> = ({
  cartes,
  etiquettes,
  introduction,
  contenu,
  largeurCarte = 76,
  hauteurCarte = 108,
  className = "",
}) => {
  const mouvementReduit = useReducedMotion() ?? false;
  const section = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ l: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>(mouvementReduit ? "cercle" : "dispersion");

  useEffect(() => {
    const noeud = scene.current;
    if (!noeud) return;
    const mesurer = () => setDimensions({ l: noeud.offsetWidth, h: noeud.offsetHeight });
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, []);

  // Entrée : dispersées, alignées, puis en cercle.
  useEffect(() => {
    if (mouvementReduit) return;
    const t1 = setTimeout(() => setPhase("ligne"), 400);
    const t2 = setTimeout(() => setPhase("cercle"), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mouvementReduit]);

  // Le défilement réel de la page pilote la morphose. La section est haute,
  // sa scène est collée : on avance dans l'animation en avançant dans la page.
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end start"],
  });
  const doux = useSpring(scrollYProgress, { stiffness: 60, damping: 22, restDelta: 0.001 });
  // La morphose occupe l'essentiel du parcours, puis se maintient : la
  // voûte reste formée le temps qu'on lise le texte qui l'accompagne.
  const morphose = useTransform(doux, [0, 0.8], [0, 1], { clamp: true });

  const parallaxeBrute = useMotionValue(0);
  const parallaxe = useSpring(parallaxeBrute, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const noeud = scene.current;
    if (!noeud || mouvementReduit) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const suivre = (e: MouseEvent) => {
      const r = noeud.getBoundingClientRect();
      parallaxeBrute.set(((e.clientX - r.left) / r.width) * 2 - 1);
    };
    noeud.addEventListener("mousemove", suivre);
    return () => noeud.removeEventListener("mousemove", suivre);
  }, [parallaxeBrute, mouvementReduit]);

  const parallaxePixels = useTransform(parallaxe, (v) => v * 70);

  // Sur un écran étroit, vingt et une cartes se tassent en amas au lieu
  // de dessiner une voûte : on n'en montre qu'une sur deux. Le propos —
  // « voici les écrans » — se lit tout aussi bien avec la moitié.
  const petitEcran = dimensions.l > 0 && dimensions.l < 768;
  const indices = useMemo(
    () => cartes.map((_, i) => i).filter((i) => !petitEcran || i % 2 === 0),
    [cartes, petitEcran],
  );

  const dispersions = useMemo(
    () =>
      cartes.map(() => ({
        x: (Math.random() - 0.5) * 1400,
        y: (Math.random() - 0.5) * 900,
        rotation: (Math.random() - 0.5) * 180,
      })),
    [cartes],
  );

  const opaciteIntro = useTransform(morphose, [0, 0.45], [1, 0]);
  const opaciteContenu = useTransform(morphose, [0.55, 0.95], [0, 1]);
  const yContenu = useTransform(morphose, [0.55, 0.95], [18, 0]);

  return (
    <section ref={section} className={`relative h-[190svh] ${className}`}>
      <div ref={scene} className="sticky top-0 h-svh overflow-hidden">
        <motion.div
          style={mouvementReduit ? undefined : { opacity: opaciteIntro }}
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-5 text-center"
        >
          {introduction}
        </motion.div>

        <motion.div
          style={mouvementReduit ? undefined : { opacity: opaciteContenu, y: yContenu }}
          // Sous la clé de voûte, dans l'ouverture que l'arc dégage :
          // placé en haut, le texte passait derrière le sommet.
          className="pointer-events-auto absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-5 text-center"
        >
          {contenu}
        </motion.div>

        {/* La clé force le recalcul des coordonnées quand la scène est
            mesurée : sans elle, les cartes gardaient les positions
            calculées sur une scène de taille nulle et restaient empilées
            au centre jusqu'au premier défilement. */}
        <div
          key={`${dimensions.l}x${dimensions.h}x${indices.length}`}
          className="relative flex h-full w-full items-center justify-center"
        >
          {indices.map((source, i) => (
            <Carte
              key={source}
              index={i}
              total={indices.length}
              phase={phase}
              dispersion={dispersions[source]}
              morphose={morphose}
              parallaxe={parallaxePixels}
              taille={{ largeur: largeurCarte, hauteur: hauteurCarte }}
              dimensions={dimensions}
              avant={cartes[source]}
              arriere={etiquettes?.[source]}
              mouvementReduit={mouvementReduit}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScrollMorphHero;
