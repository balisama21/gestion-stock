import { describe, expect, it } from "vitest";
import { mentionDePage, repartirLesPages, type MesuresDuDocument } from "./pagination";

/**
 * LE DÉCOUPAGE EN PAGES.
 *
 * Les hauteurs ci-dessous sont en pixels CSS, comme celles que le
 * navigateur rend. Les valeurs de départ sont celles mesurées sur le
 * vrai modèle Classique : une feuille A4 fait 1123 px, son en-tête
 * complet 310 px, son en-tête allégé 68 px, la clôture 250 px, et une
 * ligne d'article 43 px.
 */

const REEL: MesuresDuDocument = {
  hauteurUtile: 1123 - 106, // 297 mm moins 14 mm de marge en haut et en bas
  tete: 310,
  teteSuite: 68,
  enTeteTableau: 40,
  lignes: [],
  cloture: 250,
  interligne: 23, // 6 mm
};

/** Le même document, avec `n` lignes de hauteur ordinaire. */
const avec = (n: number, hauteur = 43): MesuresDuDocument => ({
  ...REEL,
  lignes: Array.from({ length: n }, () => hauteur),
});

const total = (m: MesuresDuDocument) => m.lignes.length;
const toutesLesLignes = (pages: number[][]) => pages.flat();

describe("une facture courte tient sur une page", () => {
  it("sans aucune ligne — une facture vide reste une facture", () => {
    const pages = repartirLesPages(avec(0));
    expect(pages).toEqual([[]]);
  });

  it("avec une seule ligne", () => {
    expect(repartirLesPages(avec(1))).toEqual([[0]]);
  });

  it("avec quatre lignes, la capacité mesurée du modèle Classique", () => {
    expect(repartirLesPages(avec(4))).toHaveLength(1);
  });
});

describe("une facture longue se répartit", () => {
  it("passe à deux pages quand la première est pleine", () => {
    const pages = repartirLesPages(avec(12));
    expect(pages.length).toBeGreaterThan(1);
  });

  it("ne perd aucune ligne, et n'en répète aucune", () => {
    // La garantie la plus importante du module : sur un bon de
    // livraison de vingt-cinq articles, un article oublié est une
    // marchandise qui n'arrive pas.
    for (const n of [1, 5, 12, 25, 60]) {
      const pages = repartirLesPages(avec(n));
      expect(toutesLesLignes(pages)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("garde les lignes dans l'ordre", () => {
    const pages = repartirLesPages(avec(25));
    expect(toutesLesLignes(pages)).toEqual([...toutesLesLignes(pages)].sort((a, b) => a - b));
  });

  it("remplit davantage les pages suivantes, dont l'en-tête est allégé", () => {
    // Quarante lignes, pour que les deux premières pages soient
    // PLEINES : comparer une page pleine à une page de reste ne
    // dirait rien de leur capacité.
    const pages = repartirLesPages(avec(40));
    expect(pages[1].length).toBeGreaterThan(pages[0].length);
  });

  it("ne dépasse jamais la hauteur d'une page", () => {
    const m = avec(25);
    const pages = repartirLesPages(m);
    pages.forEach((page, rang) => {
      const enTete = rang === 0 ? m.tete : m.teteSuite;
      const cloture = rang === pages.length - 1 ? m.cloture + m.interligne : 0;
      const hauteur = enTete + m.enTeteTableau + 2 * m.interligne + page.length * 43 + cloture;
      expect(hauteur).toBeLessThanOrEqual(m.hauteurUtile);
    });
  });
});

describe("la clôture ne se coupe jamais", () => {
  it("descend d'une page plutôt que de se séparer de ses totaux", () => {
    /*
     * On construit exprès le cas piège : assez de lignes pour remplir
     * la première page à ras bord, mais pas assez de place au bas de
     * celle-ci pour y poser les totaux.
     */
    const m = avec(0);
    const dispoPremiere = m.hauteurUtile - m.tete - m.enTeteTableau - 2 * m.interligne;
    const combien = Math.floor(dispoPremiere / 43);
    const pages = repartirLesPages(avec(combien));

    expect(pages).toHaveLength(2);
    // Des lignes ont été rendues à la page suivante pour faire place
    // à la clôture : la première n'est plus pleine.
    expect(pages[0].length).toBeLessThan(combien);
    expect(toutesLesLignes(pages)).toHaveLength(combien);
  });

  it("part seule sur une page quand il ne reste vraiment plus rien", () => {
    // Une clôture presque aussi haute qu'une page : aucune ligne ne
    // peut l'accompagner.
    const m: MesuresDuDocument = { ...avec(3), cloture: 900 };
    const pages = repartirLesPages(m);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(toutesLesLignes(pages)).toEqual([0, 1, 2]);
  });
});

describe("les cas qui feraient boucler un découpage naïf", () => {
  it("pose quand même une ligne plus haute qu'une page entière", () => {
    // Une désignation interminable. Elle débordera — on n'y peut
    // rien — mais le document sort, et c'est ce qui compte.
    const m: MesuresDuDocument = { ...avec(0), lignes: [5000, 43] };
    const pages = repartirLesPages(m);
    expect(toutesLesLignes(pages)).toEqual([0, 1]);
  });

  it("s'arrête au lieu de geler le navigateur si les mesures sont folles", () => {
    // Hauteur utile nulle : aucune ligne ne peut jamais tenir.
    const m: MesuresDuDocument = { ...avec(500), hauteurUtile: 0 };
    const pages = repartirLesPages(m);
    expect(pages.length).toBeLessThanOrEqual(100);
  });

  it("supporte une clôture absente", () => {
    // Un document dont toutes les options sont coupées.
    const pages = repartirLesPages({ ...avec(4), cloture: 0 });
    expect(pages).toHaveLength(1);
  });
});

describe("la mention de page", () => {
  it("ne s'affiche pas sur un document d'une seule page", () => {
    // « Page 1/1 » n'apprend rien et encombre un pied déjà chargé.
    expect(mentionDePage(0, 1)).toBeNull();
  });

  it("se compte à partir de un, pas de zéro", () => {
    expect(mentionDePage(0, 3)).toBe("Page 1/3");
    expect(mentionDePage(2, 3)).toBe("Page 3/3");
  });
});

describe("le nombre de pages reste raisonnable", () => {
  it.each([
    [4, 1],
    [25, 3],
  ])("%i lignes tiennent en %i page(s) au plus", (lignes, pagesMax) => {
    expect(repartirLesPages(avec(lignes)).length).toBeLessThanOrEqual(pagesMax);
  });

  it("une facture de vingt-cinq lignes sort en deux ou trois pages", () => {
    const pages = repartirLesPages(avec(25));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(total(avec(25))).toBe(25);
  });
});
