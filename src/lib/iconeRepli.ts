/**
 * Icône provisoire d'une marque cliente sans logo : son initiale sur sa
 * couleur primaire, dessinée par le serveur (`iconeRepliRendu.ts`).
 * Ce module-ci ne contient que les URL : il part aussi dans le client.
 */

export type VarianteIcone = "any" | "maskable" | "apple";

const PREFIXE = "/marque-icone-";
const MOTIF = /^\/marque-icone-(any|maskable|apple)-(180|192|512)\.png$/;
/** À changer si le dessin change : les icônes sont en cache immuable. */
const VERSION_DESSIN = "1";

export const FOND_PAR_DEFAUT = "#334155";

/** Première lettre ou chiffre du nom, sans accent, en capitale. */
export function initialeDeMarque(nom: string): string {
  const sansAccent = nom.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return sansAccent.match(/[a-z0-9]/i)?.[0].toUpperCase() ?? "";
}

function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function urlIconeRepli(
  nom: string,
  couleur: string | null,
  variante: VarianteIcone,
  taille: 180 | 192 | 512,
): string {
  const v = empreinte(`${VERSION_DESSIN}|${initialeDeMarque(nom)}|${couleur ?? ""}`);
  return `${PREFIXE}${variante}-${taille}.png?v=${v}`;
}

export const estIconeRepli = (url: string): boolean => url.startsWith(PREFIXE);

/** Chemin demandé au serveur → variante et taille ; `null` sinon. */
export function lireCheminIconeRepli(
  chemin: string,
): { variante: VarianteIcone; taille: number } | null {
  const m = MOTIF.exec(chemin);
  return m ? { variante: m[1] as VarianteIcone, taille: Number(m[2]) } : null;
}
