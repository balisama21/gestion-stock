import React, { useEffect, useState } from "react";
import { Icone, type NomIcone } from "../../../components/shared/Icone";
import { sourcePhoto, srcsetPhoto, type Photo } from "../assets/images";

/**
 * Les briques de la mise en page `docs/maquette/dashboard-tantana.html`.
 * Les styles vivent dans `tantana.css`, sous la classe `.tn` de la page.
 */

/**
 * Une bannière de section : un surtitre, le titre souligné de vert et sa
 * description à gauche, sur un voile clair ; la photo de la section
 * occupe toute la bannière et se dévoile vers la droite. Elle reste dans
 * son cadre : les cartes de la section commencent en dessous.
 *
 * L'illustration locale (`image`) reste dessous : si la photo ne charge
 * pas, c'est elle qu'on voit. La photo n'est demandée qu'à l'approche de
 * la section — les bannières du bas ne retardent pas le haut de page.
 *
 * Avec une `scene` (une photo dont les vides sont retirés), la bannière
 * n'a ni photo plein cadre ni voile : le titre à gauche, la scène posée à
 * droite directement sur la page, nette.
 */
export interface Scene {
  src: string;
  alt: string;
  largeur: number;
  hauteur: number;
}

export const Banniere: React.FC<{
  id: string;
  image: string;
  photo?: Photo;
  scene?: Scene;
  titre: string;
  sousTitre?: string;
  /** La petite ligne au-dessus du titre. */
  surtitre?: string;
}> = ({ id, image, photo, scene, titre, sousTitre, surtitre = "Espace de gestion" }) => {
  const [echec, setEchec] = useState(false);
  // Une autre photo (le lendemain, ou choisie dans les paramètres) : on
  // retente l'affichage.
  useEffect(() => setEchec(false), [photo?.id]);
  const avecPhoto = photo && !echec;
  if (scene) {
    return (
      <div className="banner scene">
        <div className="blk-h">
          {surtitre && (
            <span className="blk-sur" aria-hidden="true">
              <Icone nom="leaf" />
              {surtitre}
            </span>
          )}
          <h2 id={id}>{titre}</h2>
          {sousTitre && <p>{sousTitre}</p>}
        </div>
        <img
          className="bn-scene"
          src={scene.src}
          alt={scene.alt}
          width={scene.largeur}
          height={scene.hauteur}
          style={{ ["--ratio" as string]: scene.largeur / scene.hauteur }}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <div
      className={`banner full${avecPhoto ? " photo" : ""}`}
      style={{ ["--bn" as string]: `url(${image})` }}
    >
      {avecPhoto && (
        <img
          className="bn-photo"
          key={photo.id}
          src={sourcePhoto(photo, 1600)}
          srcSet={photo.url ? undefined : srcsetPhoto(photo.id, [800, 1200, 1600, 2200])}
          sizes="(max-width: 999px) 100vw, 75vw"
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ objectPosition: photo.cadrage }}
          onError={() => setEchec(true)}
        />
      )}
      <div className="blk-h">
        {surtitre && (
          <span className="blk-sur" aria-hidden="true">
            <Icone nom="leaf" />
            {surtitre}
          </span>
        )}
        <h2 id={id}>{titre}</h2>
        {sousTitre && <p>{sousTitre}</p>}
      </div>
    </div>
  );
};

/** Une section du tableau de bord, avec sa bannière. */
export const Section: React.FC<{
  id: string;
  image: string;
  photo?: Photo;
  scene?: Scene;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
}> = ({ id, image, photo, scene, titre, sousTitre, children }) => (
  <section className="blk" id={id} aria-labelledby={`${id}-titre`}>
    <Banniere
      id={`${id}-titre`}
      image={image}
      photo={photo}
      scene={scene}
      titre={titre}
      sousTitre={sousTitre}
    />
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
