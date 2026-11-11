import React from "react";

/**
 * UNE CARTE « PRO ».
 *
 * Une page entièrement sans cadre fatigue autant qu'une page de cartes
 * empilées : l'œil ne sait plus où un sujet finit. La carte revient donc,
 * mais soignée, à la manière des grands réseaux professionnels : fond
 * blanc, coins doux, une ombre à peine posée, et un en-tête qui dit ce
 * que la carte contient — une tuile d'icône, un titre, une ligne grise.
 *
 * `illustree` lui donne un bandeau de tête en dégradé vert, orné de
 * formes douces : pour la carte principale d'un écran, celle qu'on doit
 * repérer d'abord.
 */
interface CarteProProps {
  icone: React.ReactNode;
  titre: string;
  sousTitre?: React.ReactNode;
  /** Ce qui se pose à droite de l'en-tête : une année, un lien. */
  action?: React.ReactNode;
  illustree?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const CartePro: React.FC<CarteProProps> = ({
  icone,
  titre,
  sousTitre,
  action,
  illustree = false,
  className = "",
  children,
}) => {
  const idTitre = React.useId();
  return (
    <section
      className={`app-carte-pro${illustree ? " est-illustree" : ""} ${className}`}
      aria-labelledby={idTitre}
    >
      <header className="app-carte-pro-tete">
        {illustree && (
          <svg className="app-carte-pro-decor" viewBox="0 0 320 120" aria-hidden="true">
            <circle cx="292" cy="18" r="46" />
            <circle cx="250" cy="104" r="28" />
            <path d="M0 96 C 70 70, 130 118, 210 92 S 300 70, 320 84 V120 H0Z" />
          </svg>
        )}
        <span className="app-carte-pro-ico" aria-hidden="true">
          {icone}
        </span>
        <span className="app-carte-pro-titres">
          <h3 id={idTitre} className="app-carte-pro-titre">
            {titre}
          </h3>
          {sousTitre && <span className="app-carte-pro-sous">{sousTitre}</span>}
        </span>
        {action && <span className="app-carte-pro-action">{action}</span>}
      </header>
      <div className="app-carte-pro-corps">{children}</div>
    </section>
  );
};
