import React from "react";
import {
  BOITE_VERTE,
  CARTON,
  COS,
  iso,
  pts,
  SIN,
  T,
  type CouleursBoite,
  type Ids,
} from "./geometrie";

/**
 * LE KIT DES ILLUSTRATIONS 3D DE LA SECTION « OPÉRATIONS »
 *
 * Des illustrations vectorielles en relief — projection isométrique,
 * faces dégradées, ombres portées douces — plutôt que des images
 * figées. C'est ce qui leur permet de dire l'état réel de la boutique :
 * le calendrier montre le vrai mois et les vrais jours chargés, le
 * presse-papiers les vraies tâches, la table d'emballage autant de
 * cartons qu'il y a de commandes à préparer. Une photo ou un rendu PNG
 * ne saurait pas changer avec la base ; un composant React, si.
 *
 * Elles restent légères (aucun fichier à télécharger), nettes à toutes
 * les tailles, et toujours décoratives : `aria-hidden`, l'information
 * qu'elles mettent en scène est écrite en clair à côté.
 */

/** Les dégradés que tous les dessins partagent. */
export const DefsCommunes: React.FC<{ id: Ids }> = ({ id }) => (
  <>
    <radialGradient id={id("ombre")}>
      <stop offset="0" stopColor="#0f3d2a" stopOpacity="0.32" />
      <stop offset="0.6" stopColor="#0f3d2a" stopOpacity="0.12" />
      <stop offset="1" stopColor="#0f3d2a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={id("feuille")} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stopColor={T.vertFonce} />
      <stop offset="0.55" stopColor={T.vert} />
      <stop offset="1" stopColor={T.vertVif} />
    </linearGradient>
    <linearGradient id={id("feuilleClaire")} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stopColor={T.vert} />
      <stop offset="1" stopColor={T.vertClair} />
    </linearGradient>
    <linearGradient id={id("pot")} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="0.55" stopColor="#eef3f0" />
      <stop offset="1" stopColor="#c9d4cf" />
    </linearGradient>
    <linearGradient id={id("vertCyl")} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={T.vertVif} />
      <stop offset="0.5" stopColor={T.vert} />
      <stop offset="1" stopColor={T.vertNuit} />
    </linearGradient>
    <linearGradient id={id("papier")} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" />
      <stop offset="1" stopColor="#f2f6f4" />
    </linearGradient>
    <linearGradient id={id("metal")} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f4f7f6" />
      <stop offset="0.5" stopColor="#c3cdc9" />
      <stop offset="1" stopColor="#8d9a95" />
    </linearGradient>
  </>
);

/** L'ombre douce posée au sol sous un objet. */
export const Ombre: React.FC<{
  id: Ids;
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  opacite?: number;
}> = ({ id, cx, cy, rx, ry = rx * 0.32, opacite = 1 }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id("ombre")})`} opacity={opacite} />
);

/* ── La feuille de Tantana Suite ── */
const FEUILLE =
  "M0 0C-26.75 -30.01 -0.69 -86.02 66.38 -129.81C121.54 -166.17 176.68 -175.34 226.52 -164.58C209.45 -120.03 196.19 -63.43 142.35 -21.84C82.04 24.45 22.26 35.74 0 0Z";
const TIGE =
  "M2.36 -10.37C-14.85 3.37 -27.22 27.19 -29.29 58.36C-29.81 66.16 -20.62 66.89 -19.51 59.91C-16.12 33.96 -6.04 15.51 11.98 1.18Z";

/**
 * Le logo TS : la feuille, sa tige, et les deux lettres. `taille` est la
 * largeur du dessin ; `(x, y)` son coin haut-gauche.
 */
export const LogoTS: React.FC<{
  x: number;
  y: number;
  taille: number;
  couleur?: string;
  lettres?: string;
}> = ({ x, y, taille, couleur = T.vert, lettres = "#ffffff" }) => {
  const s = taille / 262;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) translate(32.81 178.34)`}>
      <path d={FEUILLE} fill={couleur} />
      <path d={TIGE} fill={couleur} />
      <text
        x="104"
        y="-48"
        textAnchor="middle"
        fontSize="78"
        fontWeight="800"
        fontStyle="italic"
        fill={lettres}
        transform="rotate(-14 104 -70)"
      >
        TS
      </text>
    </g>
  );
};

/**
 * Une boîte de `a` × `b` × `h`, posée en `(ox, oy)` : ce point est la
 * projection de son coin arrière-bas. Le scotch court sur le dessus et
 * descend sur la face droite ; le logo se pose sur la face gauche.
 */
export const Boite: React.FC<{
  ox: number;
  oy: number;
  a: number;
  b: number;
  h: number;
  couleurs?: CouleursBoite;
  scotch?: boolean;
  logo?: boolean;
  ouverte?: boolean;
}> = ({ ox, oy, a, b, h, couleurs = CARTON, scotch = true, logo = false, ouverte = false }) => {
  const q = (x: number, y: number, z: number) => iso(ox, oy, x, y, z);
  const t = Math.min(b, a) * 0.09;
  const [gx, gy] = q(0, b, h);
  return (
    <g>
      {/* face gauche (y = b) */}
      <polygon
        points={pts(q(0, b, 0), q(a, b, 0), q(a, b, h), q(0, b, h))}
        fill={couleurs.gauche}
      />
      {/* face droite (x = a) */}
      <polygon
        points={pts(q(a, 0, 0), q(a, b, 0), q(a, b, h), q(a, 0, h))}
        fill={couleurs.droite}
      />
      {ouverte ? (
        <>
          {/* l'intérieur, puis les deux rabats levés */}
          <polygon points={pts(q(0, 0, h), q(a, 0, h), q(a, b, h), q(0, b, h))} fill="#9c6a35" />
          <polygon
            points={pts(
              q(0, b, h),
              q(a, b, h),
              q(a, b + b * 0.55, h + h * 0.38),
              q(0, b + b * 0.55, h + h * 0.38),
            )}
            fill={couleurs.haut}
            stroke="#ffffff"
            strokeOpacity="0.35"
            strokeWidth="0.6"
          />
          <polygon
            points={pts(
              q(a, 0, h),
              q(a, b, h),
              q(a + a * 0.32, b, h + h * 0.42),
              q(a + a * 0.32, 0, h + h * 0.42),
            )}
            fill={couleurs.droite}
            opacity="0.92"
          />
        </>
      ) : (
        <polygon
          points={pts(q(0, 0, h), q(a, 0, h), q(a, b, h), q(0, b, h))}
          fill={couleurs.haut}
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="0.7"
        />
      )}
      {scotch && !ouverte && (
        <>
          <polygon
            points={pts(
              q(0, b / 2 - t, h),
              q(a, b / 2 - t, h),
              q(a, b / 2 + t, h),
              q(0, b / 2 + t, h),
            )}
            fill={T.scotch}
            opacity="0.85"
          />
          <polygon
            points={pts(
              q(a, b / 2 - t, h),
              q(a, b / 2 + t, h),
              q(a, b / 2 + t, h * 0.6),
              q(a, b / 2 - t, h * 0.6),
            )}
            fill={T.scotch}
            opacity="0.7"
          />
        </>
      )}
      {logo && (
        <g transform={`matrix(${COS} ${SIN} 0 1 ${gx} ${gy})`}>
          <LogoTS
            x={a * 0.32}
            y={h * 0.28}
            taille={Math.min(a, h) * 0.42}
            couleur="#ffffff"
            lettres={couleurs.gauche}
          />
        </g>
      )}
    </g>
  );
};

/* ── Une plante en pot ── */
const feuillePath = (l: number, w: number) =>
  `M0 0C${w * 0.75} ${-l * 0.25} ${w * 0.6} ${-l * 0.78} 0 ${-l}C${-w * 0.6} ${-l * 0.78} ${-w * 0.75} ${-l * 0.25} 0 0Z`;

/**
 * Une plante : un pot blanc et un bouquet de feuilles. `(x, y)` est le
 * milieu du bas du pot ; `t` l'échelle.
 */
export const Plante: React.FC<{ id: Ids; x: number; y: number; t?: number; variante?: 0 | 1 }> = ({
  id,
  x,
  y,
  t = 1,
  variante = 0,
}) => {
  const feuilles =
    variante === 0
      ? [
          [-52, 40, 13],
          [-30, 50, 15],
          [-8, 56, 15],
          [14, 52, 15],
          [36, 44, 13],
          [58, 34, 11],
          [-70, 30, 10],
        ]
      : [
          [-40, 34, 9],
          [-20, 46, 10],
          [0, 52, 10],
          [22, 44, 10],
          [44, 34, 9],
          [-6, 38, 9],
        ];
  return (
    <g transform={`translate(${x} ${y}) scale(${t})`}>
      <Ombre id={id} cx={2} cy={1} rx={24} ry={6} />
      <g transform="translate(0 -30)">
        {feuilles.map(([angle, l, w], i) => (
          <g key={i} transform={`rotate(${angle})`}>
            <path d={feuillePath(l, w)} fill={`url(#${id(i % 2 ? "feuilleClaire" : "feuille")})`} />
            <path
              d={`M0 0L0 ${-l * 0.86}`}
              stroke="#ffffff"
              strokeOpacity="0.35"
              strokeWidth="0.9"
            />
          </g>
        ))}
      </g>
      {/* le pot */}
      <path d="M-17 -31 L17 -31 L13 0 Q0 3 -13 0 Z" fill={`url(#${id("pot")})`} />
      <ellipse cx="0" cy="-31" rx="17" ry="4.5" fill="#f7faf8" />
      <ellipse cx="0" cy="-31" rx="14" ry="3.2" fill="#5b4632" />
    </g>
  );
};

/** Une tasse verte frappée de la feuille TS. `(x, y)` : le bas, au milieu. */
export const Tasse: React.FC<{ id: Ids; x: number; y: number; t?: number }> = ({
  id,
  x,
  y,
  t = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${t})`}>
    <Ombre id={id} cx={4} cy={1} rx={22} ry={5.5} />
    <path d="M14 -26 C30 -27 30 -8 13 -9" fill="none" stroke={T.vertFonce} strokeWidth="5" />
    <path d="M-16 -32 L16 -32 L14 -2 Q0 2 -14 -2 Z" fill={`url(#${id("vertCyl")})`} />
    <ellipse cx="0" cy="-32" rx="16" ry="4.4" fill={T.vertVif} />
    <ellipse cx="0" cy="-32" rx="13" ry="3.2" fill="#3a2a1d" />
    <LogoTS x={-8} y={-24} taille={15} couleur="#ffffff" lettres={T.vert} />
  </g>
);

/** Un stylo, posé en biais. */
export const Stylo: React.FC<{ x: number; y: number; angle?: number; long?: number }> = ({
  x,
  y,
  angle = -24,
  long = 70,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect x="1" y="2" width={long} height="6" rx="3" fill="#0f3d2a" opacity="0.18" />
    <rect x="0" y="0" width={long} height="6" rx="3" fill={T.vertNuit} />
    <rect x={long * 0.62} y="0" width={long * 0.12} height="6" fill={T.or} />
    <path d={`M${long} 0 L${long + 9} 3 L${long} 6 Z`} fill="#d9dfdc" />
    <rect x="2" y="1" width={long * 0.58} height="1.4" rx="0.7" fill="#ffffff" opacity="0.35" />
  </g>
);

/** Un pot à crayons avec trois stylos. */
export const PotCrayons: React.FC<{ id: Ids; x: number; y: number; t?: number }> = ({
  id,
  x,
  y,
  t = 1,
}) => (
  <g transform={`translate(${x} ${y}) scale(${t})`}>
    <Ombre id={id} cx={3} cy={1} rx={22} ry={5.5} />
    <rect
      x="-9"
      y="-62"
      width="4"
      height="40"
      rx="2"
      fill={T.vertNuit}
      transform="rotate(-12 -7 -22)"
    />
    <rect x="-1" y="-70" width="4" height="48" rx="2" fill="#2563a8" transform="rotate(4 1 -22)" />
    <rect x="7" y="-60" width="4" height="38" rx="2" fill={T.or} transform="rotate(14 9 -22)" />
    <path d="M-15 -34 L15 -34 L13 -1 Q0 2 -13 -1 Z" fill={`url(#${id("vertCyl")})`} />
    <ellipse cx="0" cy="-34" rx="15" ry="4" fill={T.vertVif} />
    <ellipse cx="0" cy="-34" rx="12" ry="2.8" fill={T.vertNuit} />
  </g>
);

/** Une pastille ronde portant un nombre, pour dire « combien » sur le dessin. */
export const Pastille: React.FC<{ x: number; y: number; n: number; couleur?: string }> = ({
  x,
  y,
  n,
  couleur = T.vert,
}) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="11" fill={couleur} stroke="#ffffff" strokeWidth="2.5" />
    <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
      {n > 99 ? "99+" : n}
    </text>
  </g>
);

/** Une coche blanche dans un rond vert. */
export const Coche: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 11 }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r} fill={T.vert} stroke="#ffffff" strokeWidth="2.5" />
    <path
      d={`M${-r * 0.42} 0 L${-r * 0.1} ${r * 0.32} L${r * 0.45} ${-r * 0.32}`}
      fill="none"
      stroke="#ffffff"
      strokeWidth={r * 0.22}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>
);

/**
 * Le camion de livraison, en isométrie : la caisse verte frappée du
 * logo, la cabine blanche, quatre roues. `(ox, oy)` : le coin arrière-bas.
 */
export const Camion: React.FC<{ id: Ids; ox: number; oy: number; t?: number }> = ({
  id,
  ox,
  oy,
  t = 1,
}) => {
  const L = 92;
  const B = 40;
  const H = 50;
  const q = (x: number, y: number, z: number) => iso(0, 0, x, y, z);
  // Une roue, dessinée dans le plan de la face gauche (y = B).
  const roue = (x: number) => {
    const [rx, ry] = q(x, B, 0);
    return (
      <g transform={`matrix(${COS} ${SIN} 0 1 ${rx} ${ry})`}>
        <circle cx="0" cy="-8" r="9.5" fill="#1d2723" />
        <circle cx="0" cy="-8" r="4.6" fill="#b9c4c0" />
        <circle cx="0" cy="-8" r="1.6" fill="#55635d" />
      </g>
    );
  };
  const [cx0, cy0] = q(L, B, H * 0.86);
  return (
    <g transform={`translate(${ox} ${oy}) scale(${t})`}>
      <Ombre
        id={id}
        cx={q(L * 0.62, B * 0.5, 0)[0]}
        cy={q(L * 0.62, B * 0.5, 0)[1] + 6}
        rx={88}
        ry={20}
      />
      {/* les roues du fond */}
      {(() => {
        const [rx, ry] = q(18, 0, 0);
        const [sx, sy] = q(L + 8, 0, 0);
        return (
          <>
            <ellipse cx={rx + 4} cy={ry - 7} rx="7" ry="8.5" fill="#1d2723" />
            <ellipse cx={sx + 4} cy={sy - 7} rx="7" ry="8.5" fill="#1d2723" />
          </>
        );
      })()}
      {/* le châssis */}
      <polygon
        points={pts(q(0, B, 4), q(L + 30, B, 4), q(L + 30, B, 9), q(0, B, 9))}
        fill="#2b3732"
      />
      {/* la caisse */}
      <Boite ox={0} oy={-6} a={L} b={B} h={H} couleurs={BOITE_VERTE} scotch={false} logo />
      {/* la cabine */}
      <g>
        <polygon
          points={pts(q(L, 0, 6), q(L + 30, 0, 6), q(L + 30, 0, 26), q(L + 18, 0, 44), q(L, 0, 44))}
          fill="#e9efec"
        />
        <polygon
          points={pts(q(L + 30, 0, 6), q(L + 30, B, 6), q(L + 30, B, 26), q(L + 30, 0, 26))}
          fill="#f7faf9"
        />
        <polygon
          points={pts(q(L + 18, 0, 44), q(L + 18, B, 44), q(L + 30, B, 26), q(L + 30, 0, 26))}
          fill="#7fb3d6"
        />
        <polygon
          points={pts(
            q(L + 21, 4, 40),
            q(L + 21, B - 4, 40),
            q(L + 28.5, B - 4, 28),
            q(L + 28.5, 4, 28),
          )}
          fill="#a9d1ea"
        />
        <polygon
          points={pts(q(L, B, 6), q(L + 30, B, 6), q(L + 30, B, 26), q(L + 18, B, 44), q(L, B, 44))}
          fill="#dfe7e3"
        />
        {/* la vitre latérale */}
        <polygon
          points={pts(q(L + 3, B, 28), q(L + 16, B, 28), q(L + 16, B, 40), q(L + 3, B, 40))}
          fill="#8fc0de"
        />
        <polygon
          points={pts(q(L, 0, 44), q(L + 18, 0, 44), q(L + 18, B, 44), q(L, B, 44))}
          fill="#f4f8f6"
        />
        {/* phare */}
        <polygon
          points={pts(
            q(L + 30, B - 9, 12),
            q(L + 30, B - 3, 12),
            q(L + 30, B - 3, 16),
            q(L + 30, B - 9, 16),
          )}
          fill={T.or}
        />
      </g>
      {/* reflet sur la caisse */}
      <polyline
        points={pts(q(4, B, H * 0.9), [cx0, cy0])}
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1.2"
        fill="none"
      />
      {roue(20)}
      {roue(L + 12)}
    </g>
  );
};

/**
 * Le fond d'une carte illustrée : un halo menthe derrière le dessin,
 * pour que l'objet se pose sur quelque chose plutôt que de flotter.
 */
export const Halo: React.FC<{ id: Ids; cx: number; cy: number; rx: number; ry: number }> = ({
  id,
  cx,
  cy,
  rx,
  ry,
}) => (
  <>
    <defs>
      <radialGradient id={id("halo")}>
        <stop offset="0" stopColor={T.menthe} stopOpacity="0.95" />
        <stop offset="0.7" stopColor={T.menthe2} stopOpacity="0.6" />
        <stop offset="1" stopColor={T.menthe2} stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse className="halo" cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id("halo")})`} />
  </>
);
