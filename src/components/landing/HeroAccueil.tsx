import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "../../lib/appConfig";
import { FondAnime } from "./FondAnime";

interface HeroAccueilProps {
  /** Amène au formulaire de connexion, plus bas dans la page. */
  onRejoindreConnexion: () => void;
}

export const HeroAccueil: React.FC<HeroAccueilProps> = ({ onRejoindreConnexion }) => {
  const [parallaxe, setParallaxe] = useState({ x: 0, y: 0 });
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const suivre = (e: PointerEvent) => {
      setParallaxe({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("pointermove", suivre);
    return () => window.removeEventListener("pointermove", suivre);
  }, []);

  return (
    <section
      ref={section}
      className="relative isolate flex min-h-[calc(100svh-3rem)] flex-col items-center justify-center overflow-hidden px-5 py-16 text-center"
    >
      <style>{`
        /* Le nom s'encre de gauche à droite, comme sur l'écran de
           chargement : la même signature d'un bout à l'autre du produit. */
        @keyframes gs-encrer-hero { to { clip-path: inset(0 0 0 0); } }
        @keyframes gs-monter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes gs-flotter { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes gs-descendre { 0%,100% { transform: translateY(0); opacity: .55 } 50% { transform: translateY(6px); opacity: 1 } }

        .hero-mot { position: relative; display: inline-block; white-space: nowrap; }
        .hero-mot .hero-encre {
          position: absolute; inset: 0; color: #fff;
          clip-path: inset(0 100% 0 0);
          animation: gs-encrer-hero 1.5s cubic-bezier(.66,0,.34,1) .2s forwards;
        }
        .hero-mot .hero-contour { color: transparent; -webkit-text-stroke: .7px rgba(255,255,255,.45); }

        .hero-monte { opacity: 0; animation: gs-monter .8s ease-out forwards; }
        .hero-flotte { animation: gs-flotter 6s ease-in-out infinite; }
        .hero-fleche { animation: gs-descendre 2s ease-in-out infinite; }

        .hero-contenu {
          transform: translateY(calc(var(--defilement, 0) * -0.22px));
          opacity: calc(1 - var(--defilement, 0) / 620);
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-mot .hero-encre { clip-path: none; animation: none; }
          .hero-mot .hero-contour { visibility: hidden; }
          .hero-monte { opacity: 1; animation: none; }
          .hero-flotte, .hero-fleche { animation: none; }
          .hero-contenu { transform: none; opacity: 1; }
        }
      `}</style>

      <FondAnime />

      <div className="hero-contenu relative mx-auto max-w-3xl">
        <div
          className="hero-monte hero-flotte mx-auto mb-7 h-16 w-16"
          style={{
            animationDelay: "0ms",
            transform: `translate3d(${parallaxe.x * -8}px, ${parallaxe.y * -8}px, 0)`,
          }}
        >
          {/* Le logo est un carré vert : posé tel quel sur un fond vert
              sombre, il s'y dissout. Un cartouche clair l'en détache. */}
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/25 bg-white/95 shadow-xl shadow-emerald-950/40">
            <img src="/logo.svg" alt="" width={44} height={44} className="h-11 w-11 rounded-xl" />
          </span>
        </div>

        <h1 className="text-[clamp(2rem,9vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-white">
          <span className="hero-mot">
            <span className="hero-contour" aria-hidden>
              {APP_NAME}
            </span>
            <span className="hero-encre" aria-hidden>
              {APP_NAME}
            </span>
            <span className="sr-only">{APP_NAME}</span>
          </span>
        </h1>

        <p
          className="hero-monte mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-emerald-50/90 sm:text-lg"
          style={{ animationDelay: "900ms" }}
        >
          {APP_TAGLINE}
        </p>

        <p
          className="hero-monte mx-auto mt-3 max-w-lg text-sm leading-relaxed text-emerald-100/70"
          style={{ animationDelay: "1050ms" }}
        >
          Stock, ventes, achats, clients, commandes, facturation et trésorerie — réunis dans un même
          tableau de bord.
        </p>

        <div
          className="hero-monte mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "1200ms" }}
        >
          <button
            type="button"
            onClick={onRejoindreConnexion}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-emerald-950/40 transition-transform hover:scale-[1.02] active:scale-100 sm:w-auto"
          >
            Accéder à mon espace
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="#modules"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10 sm:w-auto"
          >
            Voir ce que fait le logiciel
          </a>
        </div>
      </div>

      <a
        href="#modules"
        aria-label="Descendre"
        className="hero-fleche absolute bottom-6 text-white/70 hover:text-white"
      >
        <ChevronDown className="h-6 w-6" />
      </a>
    </section>
  );
};
