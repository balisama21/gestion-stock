import React, { useId } from "react";
import { ombre, traitsDe, type Coiffure, type Traits } from "../../lib/avatarPersonne";

/**
 * L'AVATAR D'UNE PERSONNE : un buste illustré dans un rond.
 *
 * Aucune photo n'est demandée : le visage se compose à partir du NOM
 * (teint, coiffure, couleur de cheveux, tenue, lunettes, barbe). Le même
 * nom donne toujours le même visage, sur tous les écrans. Rien n'est
 * téléchargé, rien ne sort du navigateur.
 *
 * Sans nom — une vente au comptoir — une silhouette neutre : on ne
 * prête pas un visage à un client qu'on ne connaît pas.
 */

const CheveuxArriere: React.FC<{ t: Traits }> = ({ t }) => {
  if (t.coiffure === "longs")
    return (
      <path
        d="M18.5 29C18.5 16.5 24.5 12 32 12s13.5 4.5 13.5 17l1 17.5c-4.5 3.5-24.5 3.5-29 0Z"
        fill={t.cheveux}
      />
    );
  if (t.coiffure === "carre")
    return (
      <path
        d="M19 28c0-11.5 5.5-16 13-16s13 4.5 13 16l.5 11c-3 2.5-24 2.5-27 0Z"
        fill={t.cheveux}
      />
    );
  if (t.coiffure === "boucles") return <circle cx="32" cy="25" r="15.5" fill={t.cheveux} />;
  if (t.coiffure === "chignon") return <circle cx="32" cy="11.5" r="5.5" fill={t.cheveux} />;
  return null;
};

const CheveuxAvant: React.FC<{ t: Traits }> = ({ t }) => {
  const d: Record<Coiffure, string> = {
    courts:
      "M20.8 27.5C19.8 17 26 13.3 32 13.3S44.2 17 43.2 27.5C41.5 21.3 37.5 19.6 32 19.6s-9.5 1.7-11.2 7.9Z",
    raie: "M20.8 28.5C19.3 17 26 13 33 13.4c7 .4 11.6 4.6 10.2 15.1-1.6-6.3-5-9.4-9-9.9-4 2.8-9.3 4.2-13.4 9.9Z",
    longs: "M20.8 27C20.8 17 26 14 32 14s11.2 3 11.2 13c-4-4.3-8-6-14-5.6-3 .3-6 2-8.4 5.6Z",
    chignon:
      "M21 26.5C21 17.5 26 14.2 32 14.2S43 17.5 43 26.5c-3.4-4.6-7-6.3-11-6.3s-7.6 1.7-11 6.3Z",
    boucles:
      "M19.8 27C18 16.5 25 11.2 32 11.2S46 16.5 44.2 27c-3-6.2-7-7.8-12.2-7.8S22.8 20.8 19.8 27Z",
    ras: "M21.4 25.5C22 17.4 27 14.6 32 14.6s10 2.8 10.6 10.9C39 21.2 25 21.2 21.4 25.5Z",
    carre:
      "M20.6 28C20.2 17.5 26 14 32 14s11.8 3.5 11.4 14c-2.5-5.4-6.4-7.8-11.4-7.8S23.1 22.6 20.6 28Z",
  };
  return <path d={d[t.coiffure]} fill={t.cheveux} />;
};

export const AvatarPersonne: React.FC<{
  /** Le nom de la personne. Vide : la silhouette neutre du client anonyme. */
  nom?: string | null;
  taille?: number;
  className?: string;
}> = ({ nom, taille = 40, className = "" }) => {
  const id = useId().replace(/:/g, "");
  const nomPropre = nom?.trim() ?? "";
  const classes = `avatar-personne${className ? ` ${className}` : ""}`;
  const cadre = { width: taille, height: taille };

  if (!nomPropre) {
    return (
      <span className={classes} style={cadre} aria-hidden="true">
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <rect width="64" height="64" fill="#E4ECE9" />
          <circle cx="32" cy="25" r="13" fill="#A9B8B3" />
          <path d="M4 66c2-14 13.5-21 28-21s26 7 28 21Z" fill="#A9B8B3" />
        </svg>
      </span>
    );
  }

  const t = traitsDe(nomPropre);
  const peauOmbre = ombre(t.peau);
  return (
    <span className={classes} style={cadre} aria-hidden="true" title={nomPropre}>
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs>
          <clipPath id={`av${id}`}>
            <circle cx="32" cy="32" r="32" />
          </clipPath>
        </defs>
        <g clipPath={`url(#av${id})`}>
          <rect width="64" height="64" fill={t.fond} />
          {/* Le buste grandi autour du menton : le visage remplit le rond. */}
          <g transform="translate(32 40) scale(1.32) translate(-32 -40)">
            <CheveuxArriere t={t} />
            <path d="M8 64c2-11.5 11.5-16.8 24-16.8S54 52.5 56 64Z" fill={t.tenue} />
            <rect x="28" y="37" width="8" height="12" rx="3.5" fill={peauOmbre} />
            <path d="M27 47.2h10L32 53Z" fill={peauOmbre} />
            <circle cx="20.9" cy="29" r="2.6" fill={t.peau} />
            <circle cx="43.1" cy="29" r="2.6" fill={t.peau} />
            <ellipse cx="32" cy="27" rx="11" ry="12.6" fill={t.peau} />
            {t.barbe && (
              <path
                d="M21.3 29.5c.5 7.5 4.7 11.1 10.7 11.1s10.2-3.6 10.7-11.1c-1.6 4.2-4.7 6.6-10.7 6.6s-9.1-2.4-10.7-6.6Z"
                fill={t.cheveux}
              />
            )}
            <CheveuxAvant t={t} />
            <path
              d="M24.8 24.3q2.2-1.1 4.3-.2M34.9 24.1q2.1-.9 4.3.2"
              stroke={t.cheveux}
              strokeWidth="1.3"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse cx="27.2" cy="27.7" rx="1.3" ry="1.55" fill="#2A201B" />
            <ellipse cx="36.8" cy="27.7" rx="1.3" ry="1.55" fill="#2A201B" />
            <path
              d="M32.2 29.2q-1.3 2.8.6 3.3"
              stroke={peauOmbre}
              strokeWidth="1"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="24.4" cy="31.6" r="2" fill="#E9786E" opacity=".22" />
            <circle cx="39.6" cy="31.6" r="2" fill="#E9786E" opacity=".22" />
            {t.sourire === "doux" ? (
              <path
                d="M28.7 34.2q3.3 2.6 6.6 0"
                stroke="#7A3B2E"
                strokeWidth="1.35"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <path d="M28.4 33.8q3.6 4.4 7.2 0Z" fill="#7A2E2A" />
            )}
            {t.lunettes && (
              <g stroke="#2B2B2B" strokeWidth="1.1" fill="none">
                <rect x="23.3" y="25" width="7.6" height="5.6" rx="2.2" />
                <rect x="33.1" y="25" width="7.6" height="5.6" rx="2.2" />
                <path d="M30.9 27.2h2.2" />
              </g>
            )}
          </g>
        </g>
      </svg>
    </span>
  );
};
