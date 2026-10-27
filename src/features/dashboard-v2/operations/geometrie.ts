import { useId } from "react";

/**
 * LA GÉOMÉTRIE ET LA PALETTE DES ILLUSTRATIONS 3D
 *
 * Tout ce qui n'est pas un composant : la palette, la projection
 * isométrique, les identifiants de dégradés. Séparé de `kit3d.tsx` pour
 * que le rechargement à chaud garde l'état des composants.
 */

/* ── La palette : celle de la marque, posée une fois ── */
export const T = {
  vert: "#16865b",
  vertFonce: "#0e6443",
  vertNuit: "#0a4a32",
  vertVif: "#2fae72",
  vertClair: "#7fd3a6",
  menthe: "#dcf1e4",
  menthe2: "#eef8f2",
  carton: "#ecc189",
  cartonG: "#d29d5e",
  cartonD: "#bb8448",
  scotch: "#f6dfb8",
  papier: "#ffffff",
  papierOmbre: "#e6ede9",
  ligne: "#d7e2dc",
  gris: "#cfd8d4",
  grisMoyen: "#9aa8a2",
  grisFonce: "#55635d",
  encre: "#1f2d27",
  bois: "#e3c49d",
  boisFonce: "#c9a173",
  or: "#e8b64a",
} as const;

/* ── La projection isométrique ── */
export const COS = 0.866;
export const SIN = 0.5;
export type P = [number, number];

/** Le point (x, y, z) de l'espace, vu en isométrie depuis l'origine (ox, oy). */
export const iso = (ox: number, oy: number, x: number, y: number, z: number): P => [
  ox + (x - y) * COS,
  oy + (x + y) * SIN - z,
];

export const pts = (...p: P[]): string =>
  p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/**
 * Des identifiants de dégradés propres à chaque dessin : la page en
 * affiche plusieurs, et deux `#ombre` se marcheraient dessus.
 */
export function useIdSvg(): (nom: string) => string {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (nom) => `tn3d${base}-${nom}`;
}
export type Ids = ReturnType<typeof useIdSvg>;

/* ── Les couleurs d'un carton ── */
export interface CouleursBoite {
  haut: string;
  droite: string;
  gauche: string;
}
export const CARTON: CouleursBoite = { haut: T.carton, droite: T.cartonG, gauche: T.cartonD };
export const BOITE_VERTE: CouleursBoite = { haut: T.vertVif, droite: T.vert, gauche: T.vertFonce };

/** Couper un texte trop long pour tenir sur une ligne du dessin. */
export const court = (texte: string, max: number): string =>
  texte.length > max ? `${texte.slice(0, max - 1).trimEnd()}…` : texte;
