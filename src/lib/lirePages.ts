/**
 * Lire une table en entier, page par page.
 *
 * PostgREST renvoie au plus mille lignes par requête, et il le fait EN
 * SILENCE : pas d'erreur, juste une liste coupée. Une boutique qui passe
 * sa millième vente verrait alors son chiffre d'affaires, sa trésorerie
 * et ses créances calculés sur une partie seulement de ses ventes, sans
 * que rien ne le signale.
 *
 * On lit donc par tranches jusqu'à ce qu'une tranche revienne incomplète.
 * L'appelant DOIT trier sur une colonne unique en dernier (l'`id`) : un
 * tri sur la seule date laisse l'ordre des ex æquo au hasard, et une
 * ligne pourrait passer d'une page à l'autre — lue deux fois, ou jamais.
 *
 * Une erreur sur n'importe quelle tranche rend l'erreur, sans données :
 * mieux vaut garder l'état déjà affiché qu'en poser un à moitié lu.
 */
export const TAILLE_PAGE = 1000;
/** Garde-fou : 200 000 lignes. Au-delà, on lit un registre, pas un écran. */
const PAGES_MAX = 200;

export interface ResultatLecture<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function lireToutesLesPages<T>(
  construire: (
    debut: number,
    fin: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  taillePage = TAILLE_PAGE,
): Promise<ResultatLecture<T>> {
  const tout: T[] = [];
  for (let page = 0; page < PAGES_MAX; page++) {
    const debut = page * taillePage;
    const { data, error } = await construire(debut, debut + taillePage - 1);
    if (error) return { data: null, error };
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < taillePage) break;
  }
  return { data: tout, error: null };
}
