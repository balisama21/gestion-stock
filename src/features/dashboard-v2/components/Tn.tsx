import React from "react";
import { IconeDuo, type NomIcone } from "../../../components/shared/IconeDuo";

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

/** Le carré teinté à gauche d'un titre de carte, avec son icône duotone. */
export const Lead: React.FC<{ nom: NomIcone; plein?: boolean; className?: string }> = ({
  nom,
  plein,
  className = "",
}) => (
  <div className={`lead${plein ? " plein" : ""}${className ? ` ${className}` : ""}`}>
    <IconeDuo nom={nom} />
  </div>
);

/** L'illustration posée à gauche d'un titre de carte, en lieu et place de l'icône. */
export const LeadImage: React.FC<{ src: string; largeur?: number }> = ({ src, largeur = 40 }) => (
  <img className="lead" src={src} alt="" width={largeur} height={largeur} />
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
  <IconeDuo nom="chevright" className={className} />
);

/** Une pastille d'initiale, colorée d'après le nom. */
export const Initiale: React.FC<{ nom: string; teinte: string; taille?: number }> = ({
  nom,
  teinte,
  taille = 46,
}) => (
  <span
    className="ava ini"
    style={{ background: teinte, width: taille, height: taille, fontSize: taille * 0.4 }}
    aria-hidden="true"
  >
    {(nom.trim().charAt(0) || "?").toUpperCase()}
  </span>
);
