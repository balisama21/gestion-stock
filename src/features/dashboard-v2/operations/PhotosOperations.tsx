import React from "react";
import { dateLocale } from "../lib/format";
import { court } from "./geometrie";

/**
 * LES PHOTOS DES CARTES « OPÉRATIONS », ET LEURS VRAIES DONNÉES
 *
 * Trois photos (`public/illustrations/ops-*.webp`) : le calendrier de
 * bureau, le bloc-notes « Tâches du jour » et le camion au quai. Les
 * données imprimées des deux premières en ont été effacées ; une couche
 * SVG, à la taille exacte de la photo, les redessine avec celles de la
 * boutique, dans la perspective de la feuille. Elles se mettent à jour
 * avec les listes de leur carte (mêmes données, même rafraîchissement).
 *
 * Les coordonnées viennent des photos : si une photo change, elles
 * changent avec elle.
 */

const C = {
  encre: "#2b3e48",
  titre: "#1f3340",
  passe: "#9aa5ab",
  ligne: "#b8bec4",
  vert: "#12895f",
  point: "#2aa0a0",
  case: "#20343a",
  coche: "#148c64",
};

/**
 * Une photo et sa couche de données, toujours à la même échelle : la
 * boîte a les proportions de la photo, l'image et le SVG la remplissent.
 * Rien n'est rogné, les données restent entières.
 */
const Photo: React.FC<{
  src: string;
  largeur: number;
  hauteur: number;
  children?: React.ReactNode;
}> = ({ src, largeur, hauteur, children }) => (
  <figure
    className="op-photo"
    style={{ ["--ratio" as string]: `${largeur} / ${hauteur}` }}
    aria-hidden="true"
  >
    <img src={src} alt="" width={largeur} height={hauteur} loading="lazy" decoding="async" />
    {children && (
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} focusable="false">
        {children}
      </svg>
    )}
  </figure>
);

/* ── Le calendrier de bureau ──
   La grille de la feuille (7 colonnes, 5 lignes) vue en perspective : une
   homographie envoie la case (colonne, ligne) sur la photo. Un mois de
   six semaines resserre ses lignes dans le même cadre. */
const H = [
  88.070991, -7.360294, 120.0, -0.925148, 57.280621, 203.0, -0.009167, -0.004239, 1.0,
] as const;
const surPhoto = (c: number, r: number): [number, number] => {
  const w = H[6] * c + H[7] * r + H[8];
  return [(H[0] * c + H[1] * r + H[2]) / w, (H[3] * c + H[4] * r + H[5]) / w];
};
const pts = (...p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);

export const PhotoAgenda: React.FC<{
  /** « Octobre 2026 ». */
  titreMois: string;
  /** Les jours du mois affiché, au format AAAA-MM-JJ. */
  jours: string[];
  aujourdhui: string;
  /** Les jours qui ont quelque chose de prévu. */
  charges: Set<string>;
}> = ({ titreMois, jours, aujourdhui, charges }) => {
  const vides = (dateLocale(jours[0]).getDay() + 6) % 7;
  const semaines = Math.ceil((vides + jours.length) / 7);
  const pas = 5 / semaines;
  return (
    <Photo src="/illustrations/ops-agenda.webp" largeur={920} hauteur={630}>
      <text
        x="457.5"
        y="118"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="42"
        fontWeight="700"
        fill={C.titre}
        transform="rotate(0.5 457.5 118)"
      >
        {titreMois}
      </text>
      <g stroke={C.ligne} strokeWidth="1.4" fill="none">
        {Array.from({ length: 8 }, (_, c) => (
          <polyline key={`c${c}`} points={pts(surPhoto(c, 0), surPhoto(c, 5)).join(" ")} />
        ))}
        {Array.from({ length: semaines + 1 }, (_, r) => (
          <polyline
            key={`r${r}`}
            points={pts(surPhoto(0, r * pas), surPhoto(7, r * pas)).join(" ")}
          />
        ))}
      </g>
      {jours.map((jour, i) => {
        const k = vides + i;
        const c = k % 7;
        const r = Math.floor(k / 7) * pas;
        const [x, y] = surPhoto(c + 0.5, r + pas / 2);
        const [x2, y2] = surPhoto(c + 1.5, r + pas / 2);
        const angle = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
        const haut = surPhoto(c + 0.5, r + pas)[1] - surPhoto(c + 0.5, r)[1];
        const estAujourdhui = jour === aujourdhui;
        return (
          <g key={jour} transform={`rotate(${angle.toFixed(2)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
            {estAujourdhui && (
              <circle cx={x} cy={y} r={haut * 0.42} fill={C.vert} className="op-aujourdhui" />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={(haut * 0.4).toFixed(1)}
              fontWeight="600"
              fill={estAujourdhui ? "#fff" : jour < aujourdhui ? C.passe : C.encre}
            >
              {i + 1}
            </text>
            {charges.has(jour) && !estAujourdhui && (
              <circle cx={x} cy={y + haut * 0.3} r="3.2" fill={C.point} className="op-charge" />
            )}
          </g>
        );
      })}
    </Photo>
  );
};

/* ── Le bloc-notes « Tâches du jour » ──
   Chaque case est relevée sur la photo (coin haut gauche, haut droit,
   bas gauche) ; chaque ligne d'écriture part de sa ligne de base, dans
   le sens de la feuille. Le titre garde sa case : cochée quand il ne
   reste rien à faire.

   Les repères sont pris sur le bloc-notes seul ; la photo, elle, montre
   aussi le bureau autour (tasse, stylo, plante). Le bloc-notes commence à
   `DECALAGE_BLOC` du coin de la photo. */
type Pt = [number, number];
const DECALAGE_BLOC: Pt = [140, 250];
const CASE_TITRE: [Pt, Pt, Pt] = [
  [38, 117],
  [117, 104],
  [53, 165],
];
/** Chaque ligne s'arrête au bord de la photo : `max` caractères. */
const LIGNES_BLOC: { case: [Pt, Pt, Pt]; base: [Pt, Pt]; max: number }[] = [
  {
    case: [
      [100, 235],
      [175, 220],
      [120, 283],
    ],
    base: [
      [250, 242],
      [500, 192],
    ],
    max: 21,
  },
  {
    case: [
      [155, 349],
      [230, 334],
      [178, 400],
    ],
    base: [
      [308, 360],
      [508, 315],
    ],
    max: 18,
  },
  {
    case: [
      [215, 471],
      [293, 456],
      [240, 523],
    ],
    base: [
      [370, 480],
      [688, 410],
    ],
    max: 15,
  },
];

const unitaire = ([x0, y0]: Pt, [x1, y1]: Pt): Pt => {
  const l = Math.hypot(x1 - x0, y1 - y0);
  return [(x1 - x0) / l, (y1 - y0) / l];
};

const Case: React.FC<{ coins: [Pt, Pt, Pt]; cochee: boolean }> = ({ coins, cochee }) => {
  const [tl, tr, bl] = coins;
  const q = (a: number, b: number): Pt => [
    tl[0] + a * (tr[0] - tl[0]) + b * (bl[0] - tl[0]),
    tl[1] + a * (tr[1] - tl[1]) + b * (bl[1] - tl[1]),
  ];
  return (
    <g className={cochee ? "op-case cochee" : "op-case"}>
      <polygon
        points={pts(q(0, 0), q(1, 0), q(1, 1), q(0, 1)).join(" ")}
        fill="none"
        stroke={C.case}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {cochee && (
        <polyline
          points={pts(q(0.18, 0.5), q(0.42, 0.82), q(0.95, -0.15)).join(" ")}
          fill="none"
          stroke={C.coche}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
};

export interface LigneBloc {
  texte: string;
  fait: boolean;
}

export const PhotoTaches: React.FC<{ lignes: LigneBloc[] }> = ({ lignes }) => {
  const affichees = lignes.length > 0 ? lignes : [{ texte: "Tout est à jour", fait: true }];
  const resteAFaire = lignes.some((l) => !l.fait);
  return (
    <Photo src="/illustrations/ops-taches.webp" largeur={1180} hauteur={812}>
      <g transform={`translate(${DECALAGE_BLOC[0]} ${DECALAGE_BLOC[1]})`}>
        <Case coins={CASE_TITRE} cochee={!resteAFaire} />
        {affichees.slice(0, LIGNES_BLOC.length).map((l, i) => {
          const { case: coins, base, max } = LIGNES_BLOC[i];
          const [ux, uy] = unitaire(base[0], base[1]);
          const [vx, vy] = unitaire(coins[0], coins[2]);
          return (
            <g key={i}>
              <Case coins={coins} cochee={l.fait} />
              <text
                transform={`matrix(${ux.toFixed(4)} ${uy.toFixed(4)} ${vx.toFixed(4)} ${vy.toFixed(4)} ${base[0][0]} ${base[0][1]})`}
                fontSize="42"
                fontWeight="600"
                fill={C.encre}
              >
                {court(l.texte, max)}
              </text>
            </g>
          );
        })}
      </g>
    </Photo>
  );
};

/** Le camion au quai : une photo, sans donnée à réécrire. */
export const PhotoLivraisons: React.FC = () => (
  <Photo src="/illustrations/ops-livraisons.webp" largeur={1160} hauteur={670} />
);
