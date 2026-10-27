import React from "react";
import { court, iso, pts, T, useIdSvg } from "./geometrie";
import {
  Boite,
  Camion,
  Coche,
  DefsCommunes,
  Halo,
  LogoTS,
  Ombre,
  Pastille,
  Plante,
  PotCrayons,
  Stylo,
  Tasse,
} from "./kit3d";

/**
 * LES CINQ ILLUSTRATIONS DE LA SECTION « OPÉRATIONS »
 *
 * Une par rôle — la vue d'ensemble, l'agenda, les tâches, la
 * préparation des commandes, la tournée — et toutes de la même main
 * (voir `kit3d.tsx`). Chacune reçoit en propriétés ce qu'elle doit
 * montrer : rien n'y est écrit en dur qui puisse passer pour une donnée.
 */

const Svg: React.FC<{ vb: string; className?: string; children: React.ReactNode }> = ({
  vb,
  className = "",
  children,
}) => (
  <svg
    className={`ill3d${className ? ` ${className}` : ""}`}
    viewBox={vb}
    aria-hidden="true"
    focusable="false"
    preserveAspectRatio="xMidYMid meet"
  >
    {children}
  </svg>
);

/* ═══ AGENDA ═══════════════════════════════════════════════════════ */

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Un calendrier de bureau, posé en chevalet, ouvert sur le mois que la
 * carte affiche : le jour d'aujourd'hui y est cerclé, et chaque jour qui
 * porte un élément de l'agenda reçoit son point. Devant, le carnet
 * « Aujourd'hui » liste ce qui est vraiment prévu ce jour.
 */
export const IllAgenda: React.FC<{
  /** « Octobre 2026 ». */
  titreMois: string;
  /** Tous les jours du mois affiché, « AAAA-MM-JJ ». */
  jours: string[];
  aujourdhui: string;
  /** Les jours du mois qui portent au moins un élément. */
  charges: Set<string>;
  /** Ce qui est prévu aujourd'hui, en clair. */
  notes: string[];
}> = ({ titreMois, jours, aujourdhui, charges, notes }) => {
  const id = useIdSvg();
  const premier = new Date(`${jours[0]}T12:00:00`).getDay();
  const decalage = (premier + 6) % 7;
  const cellW = 19;
  const cellH = 14.2;
  const x0 = 12;
  const y0 = 50;
  return (
    <Svg vb="0 0 320 236">
      <defs>
        <DefsCommunes id={id} />
        <linearGradient id={id("tete")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={T.vertVif} />
          <stop offset="1" stopColor={T.vertFonce} />
        </linearGradient>
      </defs>
      <Halo id={id} cx={175} cy={130} rx={160} ry={110} />

      <Plante id={id} x={44} y={150} t={0.95} />

      {/* ── le chevalet ── */}
      <Ombre id={id} cx={180} cy={168} rx={96} ry={14} />
      <polygon points="104,26 262,14 274,150 112,164" fill={T.vertNuit} />
      <g transform="matrix(0.985 -0.075 0.06 1 92 28)">
        {/* l'épaisseur des pages */}
        <rect x="5" y="6" width="164" height="132" rx="7" fill="#d9e3de" />
        <rect x="2.5" y="3" width="164" height="132" rx="7" fill="#eef3f0" />
        <rect x="0" y="0" width="164" height="132" rx="7" fill={`url(#${id("papier")})`} />
        <path d="M0 7a7 7 0 0 1 7-7h150a7 7 0 0 1 7 7v27H0Z" fill={`url(#${id("tete")})`} />
        <text x="82" y="23" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#ffffff">
          {titreMois}
        </text>
        {/* les spirales */}
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={14 + i * 17} y="-6" width="4" height="12" rx="2" fill="#3b4a44" />
        ))}
        {JOURS_COURTS.map((j, i) => (
          <text
            key={i}
            x={x0 + i * cellW + 7}
            y={y0 - 5}
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill={T.grisMoyen}
          >
            {j}
          </text>
        ))}
        {jours.map((jour, i) => {
          const k = i + decalage;
          const cx = x0 + (k % 7) * cellW + 7;
          const cy = y0 + Math.floor(k / 7) * cellH + 6;
          const estAujourdhui = jour === aujourdhui;
          return (
            <g key={jour}>
              {estAujourdhui && <circle cx={cx} cy={cy - 2.6} r="6.8" fill={T.vert} />}
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize="7.4"
                fontWeight={estAujourdhui ? 700 : 500}
                fill={estAujourdhui ? "#ffffff" : jour < aujourdhui ? "#b3bfba" : T.encre}
              >
                {Number(jour.slice(8))}
              </text>
              {charges.has(jour) && !estAujourdhui && (
                <circle cx={cx} cy={cy + 3.6} r="1.5" fill={T.vertVif} />
              )}
              {charges.has(jour) && estAujourdhui && (
                <circle cx={cx + 6} cy={cy - 8} r="2.4" fill={T.or} stroke="#fff" strokeWidth="1" />
              )}
            </g>
          );
        })}
      </g>

      <Tasse id={id} x={286} y={196} t={0.95} />

      {/* ── le carnet « Aujourd'hui » ── */}
      <Ombre id={id} cx={128} cy={214} rx={84} ry={13} />
      <g transform="matrix(0.97 0.2 -0.36 0.84 82 132)">
        <rect x="4" y="5" width="132" height="84" rx="5" fill="#cfdad5" />
        <rect x="0" y="0" width="132" height="84" rx="5" fill={`url(#${id("papier")})`} />
        <rect x="0" y="0" width="132" height="12" rx="5" fill={T.vertFonce} />
        {Array.from({ length: 7 }, (_, i) => (
          <circle key={i} cx={14 + i * 17} cy="6" r="2" fill="#ffffff" opacity="0.8" />
        ))}
        <text x="10" y="27" fontSize="11" fontWeight="700" fontStyle="italic" fill={T.vertFonce}>
          Aujourd&apos;hui
        </text>
        {notes.length === 0 ? (
          <>
            <text x="10" y="45" fontSize="9" fontStyle="italic" fill={T.grisFonce}>
              Journée libre
            </text>
            <path d="M10 56h60M10 68h44" stroke={T.ligne} strokeWidth="1.2" />
          </>
        ) : (
          notes.slice(0, 3).map((n, i) => (
            <g key={i} transform={`translate(10 ${36 + i * 15})`}>
              <rect
                x="0"
                y="0"
                width="8"
                height="8"
                rx="2"
                fill="none"
                stroke={T.vert}
                strokeWidth="1.3"
              />
              <path d="M1.8 4.2l1.9 1.9 3-3.6" stroke={T.vert} strokeWidth="1.4" fill="none" />
              <text x="13" y="7.4" fontSize="8.4" fill={T.encre}>
                {court(n, 20)}
              </text>
            </g>
          ))
        )}
      </g>
      <Stylo x={150} y={208} angle={-28} long={64} />
    </Svg>
  );
};

/* ═══ À FAIRE ══════════════════════════════════════════════════════ */

export interface LigneDessin {
  texte: string;
  fait: boolean;
}

/**
 * Le presse-papiers « Tâches du jour » : les vraies tâches de la carte,
 * cochées quand elles sont terminées. Sans tâche, la feuille dit que
 * tout est à jour.
 */
export const IllTaches: React.FC<{ lignes: LigneDessin[] }> = ({ lignes }) => {
  const id = useIdSvg();
  const vide = lignes.length === 0;
  return (
    <Svg vb="0 0 320 236">
      <defs>
        <DefsCommunes id={id} />
        <linearGradient id={id("planche")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={T.vertVif} />
          <stop offset="1" stopColor={T.vertNuit} />
        </linearGradient>
      </defs>
      <Halo id={id} cx={170} cy={128} rx={160} ry={110} />

      <Plante id={id} x={46} y={200} t={1.05} />

      {/* le téléphone, à plat */}
      <Ombre id={id} cx={88} cy={222} rx={44} ry={8} />
      <g transform="matrix(0.9 0.26 -0.62 0.46 70 186)">
        <rect x="0" y="0" width="56" height="90" rx="9" fill="#1d2723" />
        <rect x="4" y="5" width="48" height="80" rx="6" fill="#2f5d4a" />
        <rect x="10" y="14" width="36" height="5" rx="2.5" fill={T.vertClair} opacity="0.8" />
        <rect x="10" y="25" width="26" height="5" rx="2.5" fill="#ffffff" opacity="0.5" />
      </g>

      {/* ── le presse-papiers ── */}
      <Ombre id={id} cx={172} cy={210} rx={82} ry={13} />
      <g transform="rotate(-5 170 120)">
        <rect
          x="112"
          y="26"
          width="128"
          height="174"
          rx="10"
          fill={T.vertNuit}
          transform="translate(6 6)"
        />
        <rect x="112" y="26" width="128" height="174" rx="10" fill={`url(#${id("planche")})`} />
        <rect
          x="121"
          y="40"
          width="110"
          height="152"
          rx="4"
          fill="#dfe8e3"
          transform="translate(2 3)"
        />
        <rect x="121" y="40" width="110" height="152" rx="4" fill={`url(#${id("papier")})`} />
        {/* la pince */}
        <rect x="150" y="18" width="52" height="22" rx="6" fill={`url(#${id("metal")})`} />
        <circle cx="176" cy="22" r="5" fill="none" stroke="#8d9a95" strokeWidth="3" />
        <text
          x="176"
          y="60"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="0.6"
          fill={T.vertFonce}
        >
          TÂCHES DU JOUR
        </text>
        <path d="M134 66h84" stroke={T.ligne} strokeWidth="1.2" />
        {vide ? (
          <>
            <Coche x={176} y={108} r={20} />
            <text
              x="176"
              y="148"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={T.vertFonce}
            >
              Tout est à jour
            </text>
            <path d="M146 162h60M154 174h44" stroke={T.ligne} strokeWidth="1.2" />
          </>
        ) : (
          lignes.slice(0, 5).map((l, i) => (
            <g key={i} transform={`translate(132 ${78 + i * 22})`}>
              <rect
                x="0"
                y="0"
                width="11"
                height="11"
                rx="2.5"
                fill={l.fait ? T.vert : "#ffffff"}
                stroke={l.fait ? T.vert : T.grisMoyen}
                strokeWidth="1.4"
              />
              {l.fait && (
                <path
                  d="M2.5 5.8l2.4 2.4 3.8-4.6"
                  stroke="#fff"
                  strokeWidth="1.7"
                  fill="none"
                  strokeLinecap="round"
                />
              )}
              <text
                x="17"
                y="9"
                fontSize="8.6"
                fill={l.fait ? T.grisMoyen : T.encre}
                textDecoration={l.fait ? "line-through" : undefined}
              >
                {court(l.texte, 17)}
              </text>
              <path d="M17 16h70" stroke={T.ligne} strokeWidth="0.8" />
            </g>
          ))
        )}
      </g>

      <PotCrayons id={id} x={276} y={206} t={1.05} />
      <Stylo x={212} y={218} angle={-8} long={52} />
    </Svg>
  );
};

/* ═══ COMMANDES ════════════════════════════════════════════════════ */

/** Une étagère métallique à deux niveaux, chargée de cartons. */
const Etagere: React.FC<{ ox: number; oy: number }> = ({ ox, oy }) => {
  const a = 120;
  const b = 34;
  const q = (x: number, y: number, z: number) => iso(ox, oy, x, y, z);
  const montant = (x: number, y: number) => {
    const [x1, y1] = q(x, y, 0);
    const [, y2] = q(x, y, 120);
    return (
      <rect
        key={`${x}-${y}`}
        x={x1 - 2}
        y={y2}
        width="4"
        height={y1 - y2}
        rx="1.5"
        fill="#8d9a95"
      />
    );
  };
  const plateau = (z: number) => (
    <g key={z}>
      <polygon points={pts(q(0, 0, z), q(a, 0, z), q(a, b, z), q(0, b, z))} fill="#e3e9e6" />
      <polygon
        points={pts(q(0, b, z), q(a, b, z), q(a, b, z - 4), q(0, b, z - 4))}
        fill="#a7b4af"
      />
      <polygon
        points={pts(q(a, 0, z), q(a, b, z), q(a, b, z - 4), q(a, 0, z - 4))}
        fill="#bfcac6"
      />
    </g>
  );
  return (
    <g>
      {montant(0, 0)}
      {montant(a, 0)}
      {plateau(4)}
      <Boite ox={q(8, 4, 4)[0]} oy={q(8, 4, 4)[1]} a={34} b={26} h={30} />
      <Boite ox={q(48, 4, 4)[0]} oy={q(48, 4, 4)[1]} a={30} b={26} h={24} />
      <Boite ox={q(84, 4, 4)[0]} oy={q(84, 4, 4)[1]} a={30} b={26} h={34} logo />
      {plateau(62)}
      <Boite ox={q(10, 4, 62)[0]} oy={q(10, 4, 62)[1]} a={40} b={26} h={28} />
      <Boite ox={q(58, 4, 62)[0]} oy={q(58, 4, 62)[1]} a={26} b={26} h={20} />
      <Boite ox={q(88, 4, 62)[0]} oy={q(88, 4, 62)[1]} a={26} b={26} h={26} />
      {plateau(118)}
      {montant(0, b)}
      {montant(a, b)}
    </g>
  );
};

/**
 * L'atelier d'emballage : l'étagère du stock au fond, et sur la table
 * autant de cartons qu'il y a de commandes reçues ou en préparation
 * (quatre au plus). Une commande en préparation laisse un carton
 * ouvert. Rien en cours : la table est rangée, et une coche le dit.
 */
export const IllCommandes: React.FC<{ aPreparer: number; enPreparation: number }> = ({
  aPreparer,
  enPreparation,
}) => {
  const id = useIdSvg();
  const n = Math.min(aPreparer, 4);
  // La table : un plateau de bois sur des pieds verts.
  const tx = 180;
  const ty = 112;
  const a = 96;
  const b = 50;
  const q = (x: number, y: number, z: number) => iso(tx, ty, x, y, z);
  const pied = (x: number, y: number) => {
    const [x1, y1] = q(x, y, 0);
    const [, y2] = q(x, y, 30);
    return (
      <rect
        key={`${x}${y}`}
        x={x1 - 2.5}
        y={y2}
        width="5"
        height={y1 - y2}
        rx="2"
        fill={T.vertFonce}
      />
    );
  };
  const places: [number, number, number, number, number][] = [
    [6, 8, 26, 24, 22],
    [36, 6, 30, 28, 28],
    [70, 10, 22, 22, 18],
    [10, 10, 20, 18, 16],
  ];
  return (
    <Svg vb="0 0 320 236">
      <defs>
        <DefsCommunes id={id} />
      </defs>
      <Halo id={id} cx={165} cy={130} rx={160} ry={110} />

      <Ombre id={id} cx={70} cy={172} rx={70} ry={14} />
      <g transform="translate(2 20) scale(0.74)">
        <Etagere ox={40} oy={126} />
      </g>

      {/* ── la table ── */}
      <Ombre id={id} cx={q(a / 2, b / 2, 0)[0]} cy={q(a / 2, b / 2, 0)[1] + 4} rx={100} ry={20} />
      {pied(4, 4)}
      {pied(a - 4, 4)}
      <polygon points={pts(q(0, 0, 30), q(a, 0, 30), q(a, b, 30), q(0, b, 30))} fill={T.bois} />
      <polygon
        points={pts(q(0, b, 30), q(a, b, 30), q(a, b, 25), q(0, b, 25))}
        fill={T.boisFonce}
      />
      <polygon points={pts(q(a, 0, 30), q(a, b, 30), q(a, b, 25), q(a, 0, 25))} fill="#d7b386" />
      {pied(4, b - 4)}
      {pied(a - 4, b - 4)}

      {/* le rouleau de scotch, toujours là */}
      {(() => {
        const [sx, sy] = q(84, 40, 30);
        return (
          <g transform={`translate(${sx} ${sy})`}>
            <ellipse cx="0" cy="-5" rx="9" ry="7" fill={T.scotch} />
            <ellipse cx="0" cy="-5" rx="4" ry="3" fill={T.bois} />
          </g>
        );
      })()}

      {n === 0
        ? (() => {
            const [cx, cy] = q(a / 2, b / 2, 30);
            return <Coche x={cx - 8} y={cy - 18} r={16} />;
          })()
        : places.slice(0, n).map(([x, y, ba, bb, h], i) => {
            // Le quatrième carton s'empile sur le premier.
            const z = i === 3 ? 30 + 22 : 30;
            const [ox, oy] = q(x, y, z);
            return (
              <Boite
                key={i}
                ox={ox}
                oy={oy}
                a={ba}
                b={bb}
                h={h}
                ouverte={i === 1 && enPreparation > 0}
                logo={i === 0}
              />
            );
          })}
      {n > 0 && (
        <Pastille x={q(a * 0.55, 0, 30)[0] + 4} y={q(a * 0.55, 0, 30)[1] - 62} n={aPreparer} />
      )}
    </Svg>
  );
};

/* ═══ LIVRAISONS ═══════════════════════════════════════════════════ */

/**
 * La tournée : le camion vert devant un plan de quartier. Chaque
 * livraison ouverte à venir pose son repère sur l'itinéraire (trois au
 * plus) ; celle du jour bat doucement. Rien de prévu : le camion est à
 * quai, le plan n'a que la boutique.
 */
export const IllLivraisons: React.FC<{ duJour: number; aVenir: number; enRoute: boolean }> = ({
  duJour,
  aVenir,
  enRoute,
}) => {
  const id = useIdSvg();
  const reperes = Math.min(duJour + aVenir, 3);
  const mx = 168;
  const my = 30;
  const A = 120;
  const B = 92;
  const q = (x: number, y: number) => iso(mx, my, x, y, 0);
  // Les étapes de l'itinéraire, dans le plan de la carte.
  const etapes: [number, number][] = [
    [20, 70],
    [52, 46],
    [82, 66],
    [104, 22],
  ];
  const chemin = etapes
    .slice(0, reperes + 1)
    .map(([x, y], i) => `${i ? "L" : "M"}${q(x, y)[0].toFixed(1)} ${q(x, y)[1].toFixed(1)}`)
    .join(" ");
  const repere = (x: number, y: number, k: number, actif: boolean) => {
    const [px, py] = q(x, y);
    return (
      <g key={k} transform={`translate(${px} ${py})`}>
        <ellipse cx="0" cy="0" rx="6" ry="2.5" fill="#0f3d2a" opacity="0.25" />
        <g className={actif ? "pouls" : undefined}>
          <path
            d="M0 0C-3 -7 -10 -12 -10 -20a10 10 0 0 1 20 0C10 -12 3 -7 0 0Z"
            fill={actif ? T.or : T.vert}
          />
          <circle cx="0" cy="-20" r="4" fill="#ffffff" />
        </g>
      </g>
    );
  };
  const [bx, by] = q(etapes[0][0], etapes[0][1]);
  return (
    <Svg vb="0 0 320 236">
      <defs>
        <DefsCommunes id={id} />
      </defs>
      <Halo id={id} cx={170} cy={128} rx={160} ry={110} />

      {/* ── le plan ── */}
      <polygon points={pts(q(0, 0), q(A, 0), q(A, B), q(0, B))} fill="#eaf5ee" />
      <polygon
        points={pts(q(0, B), q(A, B), [q(A, B)[0], q(A, B)[1] + 5], [q(0, B)[0], q(0, B)[1] + 5])}
        fill="#bcdcc9"
      />
      <polygon
        points={pts(q(A, 0), q(A, B), [q(A, B)[0], q(A, B)[1] + 5], [q(A, 0)[0], q(A, 0)[1] + 5])}
        fill="#cfe6d8"
      />
      {/* les rues */}
      {[30, 62, 94].map((x) => (
        <polyline key={`x${x}`} points={pts(q(x, 0), q(x, B))} stroke="#ffffff" strokeWidth="5" />
      ))}
      {[26, 58].map((y) => (
        <polyline key={`y${y}`} points={pts(q(0, y), q(A, y))} stroke="#ffffff" strokeWidth="5" />
      ))}
      {/* les îlots verts */}
      {[
        [36, 6],
        [68, 32],
        [6, 64],
      ].map(([x, y], i) => (
        <polygon
          key={i}
          points={pts(q(x, y), q(x + 20, y), q(x + 20, y + 16), q(x, y + 16))}
          fill="#cbe9d6"
        />
      ))}
      {reperes > 0 && (
        <path
          d={chemin}
          fill="none"
          stroke={T.vert}
          strokeWidth="2.4"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      )}
      {/* la boutique, point de départ */}
      <g transform={`translate(${bx} ${by})`}>
        <Boite
          ox={-10}
          oy={-10}
          a={14}
          b={14}
          h={12}
          couleurs={{ haut: "#ffffff", droite: "#e3ebe7", gauche: "#c9d6d0" }}
          scotch={false}
        />
        <LogoTS x={-6} y={-24} taille={12} />
      </g>
      {etapes.slice(1, reperes + 1).map(([x, y], i) => repere(x, y, i, i === 0 && duJour > 0))}

      {/* ── le camion, et deux colis prêts ── */}
      <g className={enRoute ? "roule" : undefined}>
        <Camion id={id} ox={64} oy={128} t={0.84} />
      </g>
      <Boite ox={232} oy={178} a={26} b={22} h={22} />
      <Boite ox={240} oy={156} a={18} b={16} h={16} logo />
      {reperes === 0 && (
        <text x="268" y="98" textAnchor="middle" fontSize="10" fontWeight="700" fill={T.vertFonce}>
          À quai
        </text>
      )}
    </Svg>
  );
};
