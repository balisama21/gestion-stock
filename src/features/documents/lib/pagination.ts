/**
 * COMBIEN DE PAGES, ET QUELLE LIGNE SUR LAQUELLE
 *
 * ── POURQUOI CE CALCUL EXISTE ──────────────────────────────────────
 *
 * Parce que les boîtes de marge de `@page`, qui savent compter les
 * pages en CSS, ne sont pas reconnues par les navigateurs à moteur
 * Chromium — donc par la quasi-totalité du parc d'une boutique. Un
 * « Page 2/3 » juste ne peut venir que de nous.
 *
 * Et parce que le PDF est une photographie : laisser le navigateur
 * couper où il veut donnerait une image coupée au milieu d'une ligne.
 * Une feuille DOM par page imprimée, c'est une photographie par page,
 * et chaque coupure tombe où on l'a décidée.
 *
 * ── CE MODULE NE TOUCHE PAS AU DOM ─────────────────────────────────
 *
 * Il reçoit des hauteurs déjà mesurées et rend une répartition. C'est
 * ce qui permet de le vérifier sur cinquante cas en une seconde, là
 * où mesurer un vrai document demande un vrai navigateur. La mesure,
 * elle, vit dans `DocumentPreview`.
 */

export interface MesuresDuDocument {
  /** Hauteur utile d'une feuille : la page moins ses marges. */
  hauteurUtile: number;
  /** L'en-tête complet — identité, titre, repères, adresses. */
  tete: number;
  /** L'en-tête allégé des pages suivantes. Hauteur fixe, posée en CSS. */
  teteSuite: number;
  /** L'en-tête du tableau, répété en haut de chaque page. */
  enTeteTableau: number;
  /** La hauteur de chaque ligne d'article, dans l'ordre. */
  lignes: number[];
  /** Totaux, montant en lettres, mentions, signature, pied. */
  cloture: number;
  /** L'espace que le modèle pose entre deux blocs. */
  interligne: number;
}

/** Une page : les rangs des lignes qu'elle porte. */
export type Page = number[];

/**
 * Garde-fou. Un document de boutique ne fait pas cent pages ; au-delà,
 * c'est que les mesures sont fausses, et il vaut mieux s'arrêter que
 * geler le navigateur de quelqu'un qui voulait imprimer une facture.
 */
const PAGES_MAX = 100;

const somme = (t: number[]) => t.reduce((n, v) => n + v, 0);

/**
 * Répartit les lignes sur les pages.
 *
 * Rend toujours au moins une page, fût-elle vide : une facture sans
 * article reste une facture, et son total doit s'imprimer.
 *
 * ── LES DEUX RÈGLES DU DÉCOUPAGE ───────────────────────────────────
 *
 * Une ligne ne se coupe jamais en deux. Et la clôture — totaux,
 * mentions, signature — ne se sépare jamais d'elle-même : soit elle
 * tient au bas de la dernière page de lignes, soit elle part entière
 * sur une page de plus. Un bloc de totaux seul en haut d'une page est
 * laid ; un bloc de totaux coupé en deux fait douter du document.
 */
export function repartirLesPages(m: MesuresDuDocument): Page[] {
  const besoin = m.cloture > 0 ? m.cloture + m.interligne : 0;

  /*
   * EN DEUX TEMPS, ET C'EST LA LEÇON D'UNE PREMIÈRE VERSION FAUSSE.
   *
   * Placer les lignes en réservant la clôture au fur et à mesure
   * paraissait plus simple. Mais lorsque la clôture est trop haute
   * pour partager une page avec quoi que ce soit, chaque page rendait
   * ses lignes à la suivante, qui les rendait à son tour : le
   * découpage tournait à vide et perdait TOUTES les lignes. Un test
   * l'a montré avant qu'un client n'imprime un bon de livraison sans
   * articles.
   *
   * On remplit donc d'abord, on case la clôture ensuite.
   */

  // ── Temps 1 : les lignes, et rien qu'elles ──────────────────────
  const pages: Page[] = [];
  let i = 0;

  do {
    const enTete = pages.length === 0 ? m.tete : m.teteSuite;
    let dispo = m.hauteurUtile - enTete - m.enTeteTableau - 2 * m.interligne;
    const page: Page = [];

    while (i < m.lignes.length && m.lignes[i] <= dispo) {
      page.push(i);
      dispo -= m.lignes[i];
      i++;
    }

    /*
     * Une ligne plus haute qu'une page entière — une désignation
     * interminable, par exemple. On la pose quand même : la laisser
     * de côté ferait boucler indéfiniment, et une ligne qui déborde
     * vaut mieux qu'un document qui ne sort pas.
     */
    if (page.length === 0 && i < m.lignes.length) {
      page.push(i);
      i++;
    }

    pages.push(page);
  } while (i < m.lignes.length && pages.length < PAGES_MAX);

  // ── Temps 2 : la clôture, entière ───────────────────────────────
  if (besoin > 0) {
    /** Ce qui reste libre au bas d'une page donnée. */
    const libreSur = (rang: number) =>
      m.hauteurUtile -
      (rang === 0 ? m.tete : m.teteSuite) -
      m.enTeteTableau -
      2 * m.interligne -
      somme(pages[rang].map((k) => m.lignes[k]));

    let garde = 0;
    while (garde++ < PAGES_MAX) {
      const rang = pages.length - 1;
      if (libreSur(rang) >= besoin) break;
      // Le plafond vaut pour le document entier, clôture comprise.
      if (pages.length >= PAGES_MAX) break;

      // Une page déjà sans ligne : la clôture est plus haute qu'une
      // feuille. Elle débordera, mais entière — on n'y peut rien.
      if (pages[rang].length === 0) break;

      // On rend des lignes à une page nouvelle jusqu'à faire place.
      const reporte: Page = [];
      while (pages[rang].length > 0 && libreSur(rang) < besoin) {
        reporte.unshift(pages[rang].pop() as number);
      }

      if (pages[rang].length === 0) {
        /*
         * On a vidé la page : ses lignes repartiraient à l'identique
         * sur la suivante, et on tournerait en rond. On les lui rend,
         * et la clôture s'en va seule sur une page de plus.
         */
        pages[rang] = reporte;
        pages.push([]);
        break;
      }

      pages.push(reporte);
    }
  }

  return pages;
}

/**
 * La mention de page, ou `null` quand le document tient sur une seule.
 *
 * « Page 1/1 » n'apprend rien à personne et encombre un pied déjà
 * chargé. La mention n'apparaît qu'à partir du moment où elle sert :
 * savoir s'il manque une feuille.
 */
export function mentionDePage(rang: number, total: number): string | null {
  return total > 1 ? `Page ${rang + 1}/${total}` : null;
}
