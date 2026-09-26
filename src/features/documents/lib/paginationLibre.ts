import { clesPosees, FEUILLE, MARGES, type Blocs, type ClePosee } from "./disposition";
import type { ModeleDocument } from "./reglages";
import type { Page } from "./pagination";

/**
 * PAGINATION DU MODE LIBRE
 *
 * Le tableau est le seul bloc de hauteur variable.
 *  - Tout tient dans son cadre : une seule page, telle que dessinée.
 *  - Sinon, la page 1 garde les blocs posés au-dessus du tableau, les
 *    pages suivantes continuent le tableau sur toute la hauteur utile,
 *    et la dernière reçoit les blocs posés sous le haut du tableau
 *    (totaux, signatures…) à leur place ; le tableau s'y arrête au-dessus.
 *  - Un bloc « répété » figure sur toutes les pages.
 */

/** L'écart laissé entre le tableau et un bloc voisin, en mm. */
const ECART = 3;
const PAGES_MAX = 100;

export interface Cadre {
  y: number;
  h: number;
}

export interface ZonesLibres {
  /** Toutes les clés posées, dans l'ordre de rendu. */
  ordre: ClePosee[];
  avant: ClePosee[];
  apres: ClePosee[];
  repetes: ClePosee[];
  premiere: Cadre;
  suite: Cadre;
  derniere: Cadre;
}

export function zonesLibres(blocs: Blocs, base: ModeleDocument): ZonesLibres {
  const t = blocs.tableau;
  const ordre = clesPosees(blocs);
  const visibles = ordre.filter((c) => c !== "tableau" && !blocs[c].masque);
  const repetes = visibles.filter((c) => blocs[c].repete);
  const avant = visibles.filter((c) => !blocs[c].repete && blocs[c].y < t.y);
  const apres = visibles.filter((c) => !blocs[c].repete && blocs[c].y >= t.y);

  const m = MARGES[base];
  const hautsRepetes = repetes.map((c) => blocs[c]).filter((b) => b.y + b.h <= t.y);
  const basRepetes = repetes.map((c) => blocs[c]).filter((b) => b.y >= t.y);
  const haut = Math.max(m.y, ...hautsRepetes.map((b) => b.y + b.h + ECART));
  const bas = Math.min(FEUILLE.h - m.y, ...basRepetes.map((b) => b.y - ECART));
  const finDerniere = Math.min(bas, ...apres.map((c) => blocs[c].y - ECART));

  return {
    ordre,
    avant,
    apres,
    repetes,
    premiere: { y: t.y, h: t.h },
    suite: { y: haut, h: Math.max(0, bas - haut) },
    derniere: { y: haut, h: Math.max(0, finDerniere - haut) },
  };
}

export interface MesuresLibres {
  /** Hauteur de l'en-tête du tableau, en mm. */
  enTete: number;
  /** Hauteur de chaque ligne, en mm. */
  lignes: number[];
}

/** Combien de lignes, à partir de `i`, tiennent dans `h` mm. Au moins une, pour ne jamais boucler. */
function remplir(m: MesuresLibres, i: number, h: number, auMoinsUne: boolean): Page {
  const page: Page = [];
  let reste = h - m.enTete;
  while (i < m.lignes.length && m.lignes[i] <= reste) {
    page.push(i);
    reste -= m.lignes[i];
    i++;
  }
  if (auMoinsUne && page.length === 0 && i < m.lignes.length) page.push(i);
  return page;
}

export function paginerLibre(m: MesuresLibres, z: ZonesLibres): Page[] {
  const toutes = m.lignes.map((_, i) => i);
  const p1 = remplir(m, 0, z.premiere.h, false);
  if (p1.length === toutes.length) return [toutes];

  const pages: Page[] = [p1];
  let i = p1.length;
  while (pages.length < PAGES_MAX - 1) {
    const fin = remplir(m, i, z.derniere.h, false);
    if (i + fin.length >= m.lignes.length) {
      pages.push(fin);
      return pages;
    }
    const milieu = remplir(m, i, z.suite.h, true);
    pages.push(milieu);
    i += milieu.length;
  }
  pages.push(toutes.slice(i));
  return pages;
}

/** Ce que porte la feuille de rang `rang` sur `total`. */
export function feuilleLibre(
  rang: number,
  total: number,
  z: ZonesLibres,
): { cles: ClePosee[]; cadre: Cadre } {
  const avecTableau = (cles: ClePosee[]) =>
    z.ordre.filter((c) => c === "tableau" || cles.includes(c));
  if (total <= 1) {
    return { cles: avecTableau([...z.avant, ...z.apres, ...z.repetes]), cadre: z.premiere };
  }
  if (rang === 0) return { cles: avecTableau([...z.avant, ...z.repetes]), cadre: z.premiere };
  if (rang === total - 1) {
    return { cles: avecTableau([...z.apres, ...z.repetes]), cadre: z.derniere };
  }
  return { cles: avecTableau(z.repetes), cadre: z.suite };
}
