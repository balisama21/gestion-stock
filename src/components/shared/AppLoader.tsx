import React, { useEffect, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "../../lib/appConfig";

interface AppLoaderProps {
  /**
   * Ce qui se charge à cet instant. L'attente paraît plus courte quand on
   * sait ce qu'on attend — et cela distingue trois écrans qui, sans
   * libellé, semblaient être le même figé.
   */
  etape?: string;
}

/**
 * Écran de chargement de l'application.
 *
 * Il remplace un cercle qui tournait, identique aux trois moments du
 * démarrage — authentification, espace de travail, données. Ces trois
 * cercles successifs donnaient l'impression d'une application bloquée sur
 * le même écran, alors qu'elle avançait.
 *
 * Le nom s'écrit ici de gauche à droite : le mot est posé deux fois l'un
 * sur l'autre, en contour clair puis en plein, et seule la couche pleine
 * est dévoilée par un `clip-path` qui recule. Une fine plume avance sur ce
 * même bord. On voit donc le mot s'encrer, lettre après lettre.
 *
 * Le tracé au trait — `stroke-dasharray` sur un `<text>` SVG — a été
 * essayé et écarté : le motif de pointillés s'applique au contour de
 * chaque glyphe pris isolément, si bien que toutes les lettres
 * apparaissent ensemble, et en une fraction du temps prévu puisque le
 * contour d'une lettre est bien plus court que le motif. Le résultat
 * n'écrivait rien, il faisait surgir le mot d'un bloc.
 *
 * L'animation respecte `prefers-reduced-motion` : qui a désactivé les
 * animations voit le nom posé d'emblée.
 */
export const AppLoader: React.FC<AppLoaderProps> = ({ etape }) => {
  // Le libellé n'apparaît qu'après un instant : sur une connexion rapide
  // le chargement est déjà fini, et un texte qui clignote au passage est
  // plus gênant qu'utile.
  const [libelleVisible, setLibelleVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLibelleVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6">
      <style>{`
        .gs-mot {
          position: relative;
          display: inline-block;
          white-space: nowrap;
          font-size: clamp(1.15rem, 6.5vw, 1.6rem);
          font-weight: 700;
          letter-spacing: 0.01em;
          line-height: 1.25;
        }
        /* Couche du dessous : le mot en creux, qui réserve la place et
           laisse deviner ce qui va s'écrire. */
        .gs-mot .gs-contour {
          color: transparent;
          -webkit-text-stroke: 0.6px var(--primary);
          opacity: 0.35;
        }
        /* Couche du dessus : l'encre, dévoilée de la gauche vers la droite. */
        .gs-mot .gs-encre {
          position: absolute;
          inset: 0;
          color: var(--primary);
          clip-path: inset(0 100% 0 0);
          animation: gs-encrer 1.6s cubic-bezier(0.66, 0, 0.34, 1) forwards;
        }
        /* La plume, sur le bord exact du dévoilement. */
        .gs-mot .gs-plume {
          position: absolute;
          top: 8%;
          bottom: 8%;
          left: 0;
          width: 1.5px;
          border-radius: 2px;
          background: var(--primary);
          animation:
            gs-plume-avance 1.6s cubic-bezier(0.66, 0, 0.34, 1) forwards,
            gs-plume-lever 0.35s ease-out 1.5s forwards;
        }
        @keyframes gs-encrer      { to { clip-path: inset(0 0 0 0); } }
        @keyframes gs-plume-avance { to { left: 100%; } }
        @keyframes gs-plume-lever  { to { opacity: 0; } }

        /* Barre indéterminée : un segment qui balaie, plutôt qu'une
           progression chiffrée qu'on ne saurait pas calculer honnêtement. */
        @keyframes gs-balayage {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .gs-barre span { animation: gs-balayage 1.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .gs-mot .gs-encre { clip-path: none; animation: none; }
          .gs-mot .gs-plume { display: none; }
          .gs-barre span { animation: none; width: 100%; }
        }
      `}</style>

      <div className="gs-mot" role="img" aria-label={APP_NAME}>
        <span className="gs-contour" aria-hidden="true">
          {APP_NAME}
        </span>
        <span className="gs-encre" aria-hidden="true">
          {APP_NAME}
        </span>
        <span className="gs-plume" aria-hidden="true" />
      </div>

      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {APP_TAGLINE}
      </p>

      <div className="gs-barre h-0.5 w-40 overflow-hidden rounded-full bg-border">
        <span className="block h-full w-1/3 rounded-full bg-primary" />
      </div>

      {/* Réservé en permanence pour que rien ne saute quand il paraît. */}
      <p
        className={`h-4 text-[11px] tracking-wide text-muted-foreground transition-opacity duration-300 ${
          libelleVisible && etape ? "opacity-100" : "opacity-0"
        }`}
      >
        {etape}
      </p>
    </div>
  );
};
