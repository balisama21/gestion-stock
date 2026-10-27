import React from "react";
import { dateDuJour } from "../../../lib/dates";
import { joursDuMois } from "../lib/agenda";
import type { TacheAffichee } from "../cards/CarteTaches";
import { court, useIdSvg } from "./geometrie";

/**
 * LES VRAIES DONNÉES, POSÉES SUR L'IMAGE DE LA BANNIÈRE
 *
 * L'image (`public/illustrations/operations.webp`, 1812 × 868) a été
 * débarrassée de ses données inventées : la date, le mois et les jours
 * du calendrier, les lignes du presse-papiers. Cette couche SVG, de la
 * même taille, les redessine à leur place avec les données du jour, en
 * suivant l'inclinaison de chaque objet. Elle se met à jour avec les
 * cartes de la section (même source, même rafraîchissement).
 *
 * Les coordonnées viennent de l'image : si elle change, elles changent.
 */

export interface CommandesBanniere {
  recues: number;
  enPreparation: number;
  enLivraison: number;
  aEncaisser: number;
}

const C = {
  date: "#5d7268",
  titre: "#173b35",
  chiffre: "#273e43",
  passe: "#a3afae",
  vert: "#2fae7c",
  aujourdhui: "#38ba8c",
  point: "#2aa0a0",
  gris: "#d7dfe3",
  texte: "#4b5d5c",
};

/* ── Le calendrier mural ──
   Ses lignes montent de 9,2 px tous les 45,2 px ; ses colonnes restent
   verticales. Dans le repère (s, t) « redressé », t = y + PENTE·(x − 705). */
const PENTE = 9.2 / 45.2;
const CAL = {
  /** Centre de la case « lundi, première semaine », en (s, t). */
  s0: 705,
  t0: 279.5,
  colonne: 45.2,
  ligne: 35.8,
  /** Six semaines n'entrent qu'en serrant les lignes. */
  ligneSerree: 29.5,
  titre: { s: 842.5, t: 207 },
};
/** Le visage blanc du calendrier, moins la tête qui passe devant. */
const FACE = "M670 172 L1007 105 L1006 383 L670 463 Z";
const TETE =
  "M640 380 L645 372 L660 344 L675 329 L695 320 L720 318 L742 323 L751 331 L758 340 " +
  "L763 350 L765 360 L762 369 L756 376 L752 382 L755 392 L756 470 L640 470 Z";

/* ── La fiche « Confirmations… Encaissements » : un rond par ligne. */
const LISTE_Y = [165, 227.5, 290, 347.5];
const LISTE_X = 1091.5;

/* ── La fiche des étapes « Reçue → Encaissement ». */
const ETAPES: [number, number][] = [
  [1203, 450],
  [1196.5, 496],
  [1190, 542.5],
  [1183.5, 589],
];

/* ── Le presse-papiers, posé à plat : (350, 734) est le coin haut-gauche
   de la feuille ; u longe le bord du haut, v le bord de gauche. */
const PAPIER = "matrix(0.9729 -0.2316 0.8909 0.4545 350 734)";
const PRESSE = { x: 31, y: 34.5, pas: 44.3, decalage: 0.56 };

/** La date longue, « Mardi 27 octobre 2026 ». */
const dateLongue = (jour: Date): string => {
  const t = jour.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * Les trois lignes du presse-papiers : les tâches ouvertes, la plus
 * proche échéance d'abord, puis celles terminées aujourd'hui (la même
 * règle que la carte « À faire »).
 */
function lignesPresse(
  taches: TacheAffichee[],
  aujourdhui: string,
): { titre: string; faite: boolean }[] {
  const ouvertes = taches
    .filter((t) => t.statut !== "termine")
    .sort((a, b) => {
      if (!a.echeance) return 1;
      if (!b.echeance) return -1;
      return a.echeance.localeCompare(b.echeance);
    })
    .map((t) => ({ titre: t.titre, faite: false }));
  const faites = taches
    .filter(
      (t) =>
        t.statut === "termine" && t.termine_le && dateDuJour(new Date(t.termine_le)) === aujourdhui,
    )
    .map((t) => ({ titre: t.titre, faite: true }));
  return [...ouvertes, ...faites].slice(0, 3);
}

export const DonneesBanniere: React.FC<{
  jour: Date;
  /** Les jours du mois courant qui ont quelque chose de prévu. */
  joursCharges: Set<string>;
  commandes: CommandesBanniere;
  taches: TacheAffichee[];
}> = ({ jour, joursCharges, commandes, taches }) => {
  const id = useIdSvg();
  const aujourdhui = dateDuJour(jour);
  const jours = joursDuMois(jour.getFullYear(), jour.getMonth());
  const vides = (new Date(jour.getFullYear(), jour.getMonth(), 1).getDay() + 6) % 7;
  const semaines = Math.ceil((vides + jours.length) / 7);
  const pasLigne = semaines > 5 ? CAL.ligneSerree : CAL.ligne;
  const nomMois = jour.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  /** Du repère redressé du calendrier vers l'image. */
  const xy = (s: number, t: number): [number, number] => [s, t - PENTE * (s - CAL.s0)];

  const lignes = lignesPresse(taches, aujourdhui);
  const comptes = [
    commandes.recues,
    commandes.enPreparation,
    commandes.enLivraison,
    commandes.aEncaisser,
  ];

  return (
    <svg className="op-donnees" viewBox="0 0 1812 868" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={id("face")}>
          <path d={`${FACE} ${TETE}`} clipRule="evenodd" />
        </clipPath>
      </defs>

      {/* La date du jour, sous le titre. */}
      <text x="155" y="285" fontSize="24.5" fontWeight="500" fill={C.date}>
        {dateLongue(jour)}
      </text>

      {/* Le calendrier : le mois réel, aujourd'hui cerclé, les jours
          chargés pointés. La tête du personnage passe devant. */}
      <g clipPath={`url(#${id("face")})`}>
        <g transform={`matrix(1 ${-PENTE} 0 1 0 ${PENTE * CAL.s0})`}>
          <text
            x={CAL.titre.s}
            y={CAL.titre.t}
            textAnchor="middle"
            fontSize="21"
            fontWeight="600"
            fill={C.titre}
          >
            {nomMois.charAt(0).toUpperCase() + nomMois.slice(1)}
          </text>
        </g>
        {jours.map((j, i) => {
          const k = vides + i;
          const s = CAL.s0 + (k % 7) * CAL.colonne;
          const t = CAL.t0 + Math.floor(k / 7) * pasLigne;
          const [x, y] = xy(s, t);
          const estAujourdhui = j === aujourdhui;
          return (
            <g key={j}>
              {estAujourdhui && <circle cx={x} cy={y} r="14" fill={C.aujourdhui} />}
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize="14.5"
                fontWeight={estAujourdhui ? 700 : 600}
                fill={estAujourdhui ? "#fff" : j < aujourdhui ? C.passe : C.chiffre}
                transform={`rotate(${(-Math.atan(PENTE) * 180) / Math.PI} ${x} ${y})`}
              >
                {i + 1}
              </text>
              {joursCharges.has(j) && !estAujourdhui && (
                <circle cx={x} cy={y + 12.5} r="3" fill={C.point} />
              )}
            </g>
          );
        })}
      </g>

      {/* Confirmations, préparation, livraisons, encaissements : le
          nombre en attente remplace la coche ; la coche reste quand il
          n'y a rien. */}
      {comptes.map((n, i) =>
        n > 0 ? (
          <g key={i}>
            <circle cx={LISTE_X} cy={LISTE_Y[i]} r="14.5" fill={C.vert} />
            <text
              x={LISTE_X}
              y={LISTE_Y[i] + 5.5}
              textAnchor="middle"
              fontSize={n > 99 ? 11 : 15}
              fontWeight="700"
              fill="#fff"
            >
              {n > 99 ? "99+" : n}
            </text>
          </g>
        ) : null,
      )}

      {/* Les étapes s'allument quand des commandes y sont. */}
      {ETAPES.map(([x, y], i) =>
        comptes[i] > 0 ? (
          <g key={i}>
            <circle cx={x} cy={y} r="14.5" fill={C.vert} />
            <path
              d={`M${x - 6} ${y} l4 4.5 l8 -9`}
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <circle key={i} cx={x} cy={y} r="14.5" fill={C.gris} />
        ),
      )}

      {/* Le presse-papiers : les tâches du jour, cochées quand elles
          sont faites. */}
      <g transform={PAPIER}>
        {(lignes.length > 0 ? lignes : [{ titre: "Tout est à jour", faite: true }]).map((l, i) => {
          const x = PRESSE.x + i * PRESSE.decalage;
          const y = PRESSE.y + i * PRESSE.pas;
          return (
            <g key={i}>
              <rect
                x={x - 9}
                y={y - 9}
                width="18"
                height="18"
                rx="3"
                fill={l.faite ? C.vert : "#fff"}
                stroke={C.vert}
                strokeWidth="2.5"
              />
              {l.faite && (
                <path
                  d={`M${x - 5} ${y} l3.5 3.5 l6.5 -7`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <text
                x={x + 17}
                y={y + 4.5}
                fontSize="13"
                fontWeight="600"
                fill={l.faite ? C.passe : C.texte}
                textDecoration={l.faite ? "line-through" : undefined}
              >
                {court(l.titre, 18)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
