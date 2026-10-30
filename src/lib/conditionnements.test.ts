import { describe, expect, it } from "vitest";
import {
  auPluriel,
  conditionnementDeLigne,
  conditionnementsVersBase,
  erreurConditionnements,
  lireConditionnements,
  prixAchatDe,
  prixUnitaireDepuis,
  prixVenteDe,
  quantiteDeLigne,
  remiseDuConditionnement,
  stockEnConditionnements,
  trouverParCode,
  type Conditionnement,
} from "./conditionnements";

/**
 * LES CONDITIONNEMENTS
 *
 * Un carton contient un nombre d'unités propre au produit. Le stock se
 * compte toujours en unités ; le carton n'est qu'une façon d'acheter, de
 * vendre et de lire ce stock.
 */

const CARTON: Conditionnement = {
  id: "c1",
  nom: "carton",
  quantite: 12,
  prixVente: 7000,
  prixAchat: null,
  codeBarres: "999",
};
const PACK: Conditionnement = {
  id: "c2",
  nom: "pack",
  quantite: 6,
  prixVente: null,
  prixAchat: 3000,
  codeBarres: null,
};
const EAU = { prixVenteDefaut: 650, prixAchat: 500 };

describe("lire et écrire la liste", () => {
  it("relit la colonne de la base, et écarte ce qui ne tient pas debout", () => {
    expect(
      lireConditionnements([
        {
          id: "c1",
          nom: "carton",
          quantite: 12,
          prix_vente: 7000,
          prix_achat: null,
          code_barres: "999",
        },
        { id: "x", nom: "", quantite: 12 },
        { id: "y", nom: "pack", quantite: 1 },
        "n'importe quoi",
      ]),
    ).toEqual([CARTON]);
    expect(lireConditionnements(null)).toEqual([]);
  });

  it("écrit la forme que la contrainte de la base vérifie", () => {
    expect(conditionnementsVersBase([{ ...CARTON, nom: " carton ", codeBarres: " " }])).toEqual([
      {
        id: "c1",
        nom: "carton",
        quantite: 12,
        prix_vente: 7000,
        prix_achat: null,
        code_barres: null,
      },
    ]);
  });

  it("relit les trois colonnes d'une ligne de vente ou d'achat", () => {
    expect(
      conditionnementDeLigne({
        conditionnement: "carton",
        conditionnement_nombre: 2,
        conditionnement_facteur: 12,
      }),
    ).toEqual({ nom: "carton", nombre: 2, facteur: 12 });
    expect(conditionnementDeLigne({ conditionnement: null })).toBeNull();
  });
});

describe("ce qui empêche d'enregistrer", () => {
  it("un carton d'au moins 2 unités, en nombre entier", () => {
    expect(erreurConditionnements([{ ...CARTON, quantite: 0 }], "bouteille")).toMatch(/au moins 2/);
    expect(erreurConditionnements([{ ...CARTON, quantite: 1.5 }], "bouteille")).toMatch(
      /nombre entier/,
    );
  });

  it("ni doublon, ni l'unité de base redéclarée", () => {
    expect(erreurConditionnements([CARTON, { ...PACK, nom: "Carton" }], "pièce")).toMatch(
      /deux fois/,
    );
    expect(erreurConditionnements([{ ...CARTON, nom: "Pièce" }], "pièce")).toMatch(/unité de base/);
    expect(erreurConditionnements([CARTON, PACK], "bouteille")).toBeNull();
  });
});

describe("les prix", () => {
  it("le prix propre du carton, sinon le compte des unités", () => {
    expect(prixVenteDe(CARTON, EAU)).toBe(7000);
    expect(prixVenteDe(PACK, EAU)).toBe(6 * 650);
    expect(prixAchatDe(CARTON, EAU)).toBe(12 * 500);
    expect(prixAchatDe(PACK, EAU)).toBe(3000);
  });

  it("le prix de l'unité, au centime", () => {
    expect(prixUnitaireDepuis(6500, 12)).toBe(541.67);
    expect(prixUnitaireDepuis(6000, 12)).toBe(500);
  });

  it("la remise du carton sur le détail", () => {
    // 12 × 650 = 7 800 au détail ; 7 000 le carton, soit 10 % de moins.
    expect(remiseDuConditionnement(CARTON, EAU)).toBe(10);
    expect(remiseDuConditionnement(PACK, EAU)).toBeNull();
  });
});

describe("les mots", () => {
  it("accorde le conditionnement, pas son complément", () => {
    expect(auPluriel("carton", 2)).toBe("cartons");
    expect(auPluriel("sac de 50 kg", 3)).toBe("sacs de 50 kg");
    expect(auPluriel("colis", 2)).toBe("colis");
    expect(auPluriel("seau", 2)).toBe("seaux");
    expect(auPluriel("kg", 4)).toBe("kg");
    expect(auPluriel("carton", 1)).toBe("carton");
  });

  it("une ligne dit ce qu'on a saisi, puis ce qui a bougé en stock", () => {
    expect(quantiteDeLigne(24, "bouteille", { nom: "carton", nombre: 2, facteur: 12 })).toEqual({
      principal: "2 cartons",
      detail: "24 bouteilles",
    });
    expect(quantiteDeLigne(3, "bouteille", null)).toEqual({
      principal: "3 bouteilles",
      detail: null,
    });
  });

  it("le stock en cartons pleins, et le reste à l'unité", () => {
    expect(stockEnConditionnements(30, "bouteille", [PACK, CARTON])).toBe(
      "2 cartons + 6 bouteilles",
    );
    expect(stockEnConditionnements(24, "bouteille", [CARTON])).toBe("2 cartons");
    expect(stockEnConditionnements(6, "bouteille", [CARTON])).toBeNull();
    expect(stockEnConditionnements(30, "bouteille", [])).toBeNull();
  });
});

describe("le code scanné", () => {
  const produits = [
    { id: "p1", codeBarres: "111", sku: "EAU", conditionnements: [CARTON] },
    { id: "p2", codeBarres: "222", sku: null, conditionnements: [] },
  ];

  it("le code du carton dit qu'on vend le carton", () => {
    expect(trouverParCode(produits, "999")).toEqual({
      produit: produits[0],
      conditionnement: CARTON,
    });
  });

  it("le code du produit, ou sa référence, le vend à l'unité", () => {
    expect(trouverParCode(produits, " 222 ")?.produit.id).toBe("p2");
    expect(trouverParCode(produits, "eau")?.conditionnement).toBeNull();
    expect(trouverParCode(produits, "000")).toBeNull();
  });
});
