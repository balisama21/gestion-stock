import React from "react";

/**
 * Fond animé du héros, sans vidéo ni moteur 3D.
 *
 * La première version posait une vidéo de deux mégaoctets et demi en
 * arrière-plan. Elle dépendait de trois choses qu'un téléphone peut
 * refuser une à une : le téléchargement, la politique de lecture
 * automatique du navigateur, et une estimation de débit qui n'est
 * qu'une estimation. Sur l'appareil de l'utilisateur, elle ne
 * s'affichait pas.
 *
 * Ce fond-ci ne dépend de rien. Il ne pèse aucun octet, démarre à la
 * première image et ne peut pas être bloqué. Trois couches :
 *
 *   - des halos colorés qui dérivent lentement, pour la profondeur ;
 *   - une grille en perspective qui file vers l'horizon, pour le relief.
 *     C'est une simple trame de dégradés basculée sur l'axe X ; l'oeil y
 *     lit un sol qui s'éloigne ;
 *   - un voile sombre, pour que le texte reste lisible quoi qu'il arrive.
 *
 * La grille et les halos se décalent aussi avec le défilement, via la
 * variable `--defilement` publiée par `useDefilement`.
 */
export const FondAnime: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <style>{`
      @keyframes fa-deriveA {
        0%,100% { transform: translate3d(-12%, -8%, 0) scale(1); }
        50%     { transform: translate3d(6%, 6%, 0) scale(1.15); }
      }
      @keyframes fa-deriveB {
        0%,100% { transform: translate3d(10%, 4%, 0) scale(1.1); }
        50%     { transform: translate3d(-8%, -10%, 0) scale(.95); }
      }
      @keyframes fa-grille { to { background-position: 0 96px; } }

      .fa-socle {
        background:
          radial-gradient(120% 90% at 50% 0%, #0d7a4f 0%, #075437 42%, #032a1e 78%, #01140f 100%);
      }
      .fa-halo { position: absolute; border-radius: 9999px; filter: blur(70px); opacity: .5; }
      .fa-halo-a { width: 62vw; height: 62vw; left: -10vw; top: -12vw; background: #10b981;
                   animation: fa-deriveA 22s ease-in-out infinite; }
      .fa-halo-b { width: 55vw; height: 55vw; right: -12vw; top: 18vh; background: #0ea5a3;
                   animation: fa-deriveB 27s ease-in-out infinite; }

      /* Le sol : une trame régulière basculée, donc vue en fuyante. */
      .fa-sol {
        position: absolute; left: -60%; right: -60%; bottom: 0; height: 110vh;
        transform-origin: 50% 100%;
        transform: perspective(900px) rotateX(66deg) translateY(calc(var(--defilement, 0) * .06px));
        background-image:
          linear-gradient(to right, rgba(255,255,255,.22) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,.22) 1px, transparent 1px);
        background-size: 96px 96px;
        animation: fa-grille 3.2s linear infinite;
        mask-image: linear-gradient(to top, #000 0%, transparent 80%);
      }

      /* Les halos suivent le défilement, plus lentement que la page :
         c'est ce décalage qui donne la sensation de profondeur. */
      .fa-couche-lente { transform: translateY(calc(var(--defilement, 0) * .18px)); }

      @media (prefers-reduced-motion: reduce) {
        .fa-halo-a, .fa-halo-b, .fa-sol { animation: none; }
        .fa-sol, .fa-couche-lente { transform: none; }
        .fa-sol { display: none; }
      }
    `}</style>

    <div className="fa-socle absolute inset-0" />
    <div className="fa-couche-lente absolute inset-0">
      <span className="fa-halo fa-halo-a" />
      <span className="fa-halo fa-halo-b" />
    </div>
    <div className="fa-sol" />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/25 to-slate-950/85" />
  </div>
);
