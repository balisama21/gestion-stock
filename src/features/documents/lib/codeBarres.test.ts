import { describe, expect, it } from "vitest";
import { dessinerCode128, modulesCode128 } from "./codeBarres";

/**
 * LE CODE-BARRES DOIT SE LIRE, PAS RESSEMBLER À UN CODE-BARRES.
 *
 * Un symbole faux ne se voit pas à l'œil : les barres ont l'air
 * normales, et c'est la douchette de la caisse qui refusera — ou,
 * pire, rendra un autre numéro. Ces tests vérifient donc la NORME,
 * pas l'apparence.
 */

/** La somme des largeurs : la largeur du symbole, en modules. */
const largeurTotale = (t: number[]) => t.reduce((a, b) => a + b, 0);

describe("la structure du symbole", () => {
  it("commence par la marque de départ de la variante B", () => {
    // Motif 104 = « 211214 ».
    expect(modulesCode128("A")?.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
  });

  it("finit par la marque d'arrêt et sa barre de fin", () => {
    // Motif 106 = « 2331112 », suivi des deux modules imposés.
    expect(modulesCode128("A")?.slice(-8)).toEqual([2, 3, 3, 1, 1, 1, 2, 2]);
  });

  it("compte six modules par caractère, plus l'arrêt et la fin", () => {
    // Départ + n caractères + clé, à six modules chacun ; puis la
    // marque d'arrêt à sept, et la barre de fin à un.
    for (const texte of ["A", "V026", "FAC-V026"]) {
      const m = modulesCode128(texte);
      expect(m).toHaveLength((texte.length + 2) * 6 + 7 + 1);
    }
  });
});

describe("la clé de contrôle", () => {
  it("vaut 34 pour « A », le cas de référence de la norme", () => {
    /*
     * Départ B = 104, « A » vaut 65 − 32 = 33, à la position 1.
     * (104 + 1 × 33) modulo 103 = 34. Le motif 34 est « 131123 ».
     * Si ce test tombe, c'est le calcul de la clé qui a bougé, et
     * aucun lecteur n'acceptera plus les tickets.
     */
    expect(modulesCode128("A")?.slice(12, 18)).toEqual([1, 3, 1, 1, 2, 3]);
  });

  it("change dès qu'un caractère change", () => {
    const a = modulesCode128("V026");
    const b = modulesCode128("V027");
    expect(a).not.toEqual(b);
  });

  it("dépend de la POSITION, pas seulement des caractères", () => {
    // « AB » et « BA » contiennent les mêmes lettres : sans la
    // pondération par le rang, ils auraient la même clé.
    expect(modulesCode128("AB")).not.toEqual(modulesCode128("BA"));
  });
});

describe("ce qu'il refuse de coder", () => {
  it("renonce devant un caractère hors de la variante B", () => {
    // Mieux vaut pas de code-barres qu'un numéro mal lu à la caisse.
    expect(modulesCode128("Épicerie")).toBeNull();
    expect(modulesCode128("V026\n")).toBeNull();
  });

  it("renonce devant une chaîne vide", () => {
    expect(modulesCode128("")).toBeNull();
    expect(dessinerCode128("")).toBeNull();
  });
});

describe("le dessin", () => {
  it("ne rend que les barres noires, une largeur sur deux", () => {
    const dessin = dessinerCode128("V026");
    const modules = modulesCode128("V026")!;
    expect(dessin!.barres).toHaveLength(Math.ceil(modules.length / 2));
  });

  it("pose les barres bout à bout, sans trou ni recouvrement", () => {
    const dessin = dessinerCode128("V026")!;
    const modules = modulesCode128("V026")!;
    let attendu = 0;
    dessin.barres.forEach((b, i) => {
      expect(b.x).toBe(attendu);
      expect(b.largeur).toBe(modules[i * 2]);
      // On saute la barre puis le blanc qui la suit.
      attendu += modules[i * 2] + (modules[i * 2 + 1] ?? 0);
    });
  });

  it("annonce une largeur égale à la somme des modules", () => {
    const dessin = dessinerCode128("FAC-V026")!;
    expect(dessin.largeur).toBe(largeurTotale(modulesCode128("FAC-V026")!));
  });

  it("commence toujours par une barre, jamais par un blanc", () => {
    // La norme l'impose : un symbole qui commencerait par du blanc
    // ne serait pas détecté comme un début de code.
    expect(dessinerCode128("V026")!.barres[0].x).toBe(0);
  });
});

describe("les numéros que la boutique produit vraiment", () => {
  it.each(["V001", "V026", "REC-V026", "FAC-V026", "DEV001", "ACH004"])("%s se code", (numero) => {
    const dessin = dessinerCode128(numero);
    expect(dessin).not.toBeNull();
    // Un symbole plus large que le rouleau serait illisible : à
    // 0,25 mm le module, 80 mm en portent 320, marges comprises.
    expect(dessin!.largeur).toBeLessThan(300);
  });
});
