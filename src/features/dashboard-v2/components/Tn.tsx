import React from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";

/**
 * Les briques de la mise en page `docs/maquette/dashboard-tantana.html`.
 * Les styles vivent dans `tantana.css`, sous la classe `.tn` de la page.
 */

/** Une bannière de section : titre à gauche, illustration pleine largeur derrière. */
export const Banniere: React.FC<{
  id: string;
  image: string;
  titre: string;
  sousTitre?: string;
}> = ({ id, image, titre, sousTitre }) => (
  <div className="banner full" style={{ ["--bn" as string]: `url(${image})` }}>
    <div className="blk-h">
      <h2 id={id}>{titre}</h2>
      {sousTitre && <p>{sousTitre}</p>}
    </div>
  </div>
);

/** Une section du tableau de bord, avec sa bannière. */
export const Section: React.FC<{
  id: string;
  image: string;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
}> = ({ id, image, titre, sousTitre, children }) => (
  <section className="blk" id={id} aria-labelledby={`${id}-titre`}>
    <Banniere id={`${id}-titre`} image={image} titre={titre} sousTitre={sousTitre} />
    <div className="blk-corps">{children}</div>
  </section>
);

export type TonIcone = "vert" | "bleu" | "rouge" | "orange" | "violet" | "neutre";

/** Le carré teinté à gauche d'un titre de carte, avec son icône. */
export const Lead: React.FC<{
  nom: NomIcone;
  plein?: boolean;
  /** Rond plutôt que carré arrondi : les chiffres clés d'une section. */
  rond?: boolean;
  ton?: TonIcone;
  className?: string;
}> = ({ nom, plein, rond, ton, className = "" }) => (
  <div
    className={`lead${plein ? " plein" : ""}${rond ? " rond" : ""}${ton ? ` ${ton}` : ""}${className ? ` ${className}` : ""}`}
  >
    <Icone nom={nom} />
  </div>
);

export const TeteCarte: React.FC<{
  lead?: React.ReactNode;
  titre: React.ReactNode;
  sous?: React.ReactNode;
  action?: React.ReactNode;
  grand?: boolean;
  className?: string;
}> = ({ lead, titre, sous, action, grand, className = "" }) => (
  <div className={`card-h${className ? ` ${className}` : ""}`}>
    {lead}
    <div className="card-t">
      <h3 className={grand ? "grand" : undefined}>{titre}</h3>
      {sous && <div className="sub">{sous}</div>}
    </div>
    {action}
  </div>
);

/** « Voir tout », « Gérer »… : un lien texte, sans flèche. */
export const Lien: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, children, className = "" }) =>
  onClick ? (
    <button type="button" className={`link${className ? ` ${className}` : ""}`} onClick={onClick}>
      {children}
    </button>
  ) : null;

/** L'état vide illustré : une image, un titre, une phrase. */
export const Vide: React.FC<{
  image?: string;
  largeur?: number;
  titre: string;
  detail?: string;
  className?: string;
}> = ({ image, largeur = 140, titre, detail, className = "" }) => (
  <div className={`empty${className ? ` ${className}` : ""}`}>
    {image && <img src={image} alt="" style={{ width: largeur }} />}
    <b>{titre}</b>
    {detail && <span className="s">{detail}</span>}
  </div>
);

/** Le chevron du coin d'une carte cliquable. */
export const Chevron: React.FC<{ className?: string }> = ({ className = "chev" }) => (
  <Icone nom="chevright" className={className} />
);
