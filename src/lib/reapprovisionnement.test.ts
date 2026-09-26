import { describe, expect, it } from "vitest";
import {
  grouperParFournisseur,
  groupeEnCours,
  lignesDeReappro,
  nombreDeFournisseurs,
  niveauCible,
  quantiteACommander,
  rangeesDeLaFeuille,
  recollerLesGroupes,
} from "./reapprovisionnement";
import { lignesDuBonDeCommande, quantiteSuggeree, type ProduitARecommander } from "./bonDeCommande";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "./prealerteStock";

const ACTIF: ReglagesAlertesStock = { ...REGLAGES_PAR_DEFAUT, reapproActive: true };

const produit = (p: Partial<ProduitARecommander> & { id: string }): ProduitARecommander => ({
  nom: p.id,
  stockActuel: 0,
  seuilAlerte: 10,
  ...p,
});

describe("quantité avec niveau cible renseigné", () => {
  it("cible − stock : seuil 10, cible 20, stock 4 → 16", () => {
    expect(quantiteACommander(4, 10, 20, ACTIF)).toBe(16);
  });

  it("la cible libre prime sur la règle de la boutique", () => {
    const r = { ...ACTIF, reapproMode: "ecart" as const, reapproValeur: 3 };
    expect(quantiteACommander(4, 10, 50, r)).toBe(46);
  });

  it("une cible décimale (kg) reste exacte", () => {
    expect(quantiteACommander(1.2, 2, 5.5, ACTIF)).toBe(4.3);
  });
});

describe("repli sans niveau cible", () => {
  it("règle par défaut (×2) = calcul historique", () => {
    expect(quantiteACommander(4, 10, null, ACTIF)).toBe(16);
  });

  it("règle « seuil + quantité »", () => {
    const r = { ...ACTIF, reapproMode: "ecart" as const, reapproValeur: 5 };
    expect(niveauCible(10, null, r)).toBe(15);
    expect(quantiteACommander(4, 10, null, r)).toBe(11);
  });

  it("multiplicateur décimal arrondi au supérieur, sans erreur flottante", () => {
    expect(niveauCible(10, null, { ...ACTIF, reapproValeur: 1.1 })).toBe(11);
    expect(niveauCible(3, null, { ...ACTIF, reapproValeur: 1.5 })).toBe(5);
  });

  it("une cible nulle, vide ou à zéro n'est pas une cible", () => {
    expect(quantiteACommander(4, 10, 0, ACTIF)).toBe(16);
    expect(quantiteACommander(4, 10, undefined, ACTIF)).toBe(16);
  });
});

describe("jamais de quantité négative", () => {
  it("stock au-dessus de la cible → 0", () => {
    expect(quantiteACommander(50, 10, 20, ACTIF)).toBe(0);
    expect(quantiteACommander(50, 10, null, REGLAGES_PAR_DEFAUT)).toBe(0);
  });

  it("stock négatif : la quantité compense le manque", () => {
    expect(quantiteACommander(-3, 10, 20, ACTIF)).toBe(23);
  });

  it("stock nul", () => {
    expect(quantiteACommander(0, 10, 20, ACTIF)).toBe(20);
  });
});

describe("non-régression : réglage éteint ou produit sans cible", () => {
  const cas: [number, number][] = [
    [5, 3],
    [0, 3],
    [-2, 4],
    [10, 10],
    [100, 3],
    [2.5, 4],
  ];

  it.each(cas)("stock %s, seuil %s : identique à 2 × seuil − stock", (stock, seuil) => {
    expect(quantiteACommander(stock, seuil, null, REGLAGES_PAR_DEFAUT)).toBe(
      quantiteSuggeree(stock, seuil),
    );
    expect(quantiteACommander(stock, seuil, null, ACTIF)).toBe(quantiteSuggeree(stock, seuil));
  });

  it("réglage éteint : un stock_max renseigné est ignoré", () => {
    expect(quantiteACommander(4, 10, 50, REGLAGES_PAR_DEFAUT)).toBe(16);
  });

  it("le bon de commande reste identique tant que le réglage est éteint", () => {
    const catalogue = [
      produit({ id: "a", stockActuel: 1, seuilAlerte: 3, niveauCible: 40 }),
      produit({ id: "b", stockActuel: 5, seuilAlerte: 3 }),
    ];
    const r = { ...REGLAGES_PAR_DEFAUT, prealerteActive: true, ecart: 2 };
    const lignes = lignesDuBonDeCommande(catalogue, r);
    expect(lignes.map((l) => [l.id, l.quantiteSuggeree])).toEqual([
      ["a", 5],
      ["b", 1],
    ]);
  });

  it("réglage allumé : le bon de commande suit la cible", () => {
    const catalogue = [produit({ id: "a", stockActuel: 1, seuilAlerte: 3, niveauCible: 40 })];
    expect(lignesDuBonDeCommande(catalogue, ACTIF)[0].quantiteSuggeree).toBe(39);
  });
});

describe("la feuille liste exactement les produits sous le seuil", () => {
  const catalogue = [
    produit({ id: "sous", stockActuel: 4, seuilAlerte: 10, niveauCible: 20 }),
    produit({ id: "egal", stockActuel: 10, seuilAlerte: 10 }),
    produit({ id: "rupture", stockActuel: 0, seuilAlerte: 5 }),
    produit({ id: "negatif", stockActuel: -2, seuilAlerte: 5 }),
    produit({ id: "prealerte", stockActuel: 11, seuilAlerte: 10 }),
    produit({ id: "ok", stockActuel: 40, seuilAlerte: 10 }),
    produit({ id: "sansSeuil", stockActuel: 0, seuilAlerte: 0 }),
  ];

  it("sous ou au seuil, pas plus — même préalerte active", () => {
    const r = { ...ACTIF, prealerteActive: true, ecart: 5 };
    const ids = lignesDeReappro(catalogue, r)
      .map((l) => l.id)
      .sort();
    expect(ids).toEqual(["egal", "negatif", "rupture", "sous"]);
  });

  it("chaque ligne porte stock, seuil, cible et quantité", () => {
    const [l] = lignesDeReappro([catalogue[0]], ACTIF);
    expect(l).toMatchObject({
      stock: 4,
      seuil: 10,
      cible: 20,
      cibleDeLaFiche: true,
      quantite: 16,
    });
  });

  it("aucune quantité négative sur la feuille", () => {
    expect(lignesDeReappro(catalogue, ACTIF).every((l) => l.quantite >= 0)).toBe(true);
  });
});

describe("regroupement par fournisseur", () => {
  const catalogue = [
    produit({ id: "h", stockActuel: 1, fournisseur: "Tiko Import" }),
    produit({ id: "s", stockActuel: 2, fournisseur: "Grossiste Be" }),
    produit({ id: "r", stockActuel: 3, fournisseur: " tiko import " }),
    produit({ id: "x", stockActuel: 4 }),
  ];
  const lignes = lignesDeReappro(catalogue, ACTIF);

  it("un groupe par fournisseur, casse et espaces confondus, sans fournisseur en dernier", () => {
    const groupes = grouperParFournisseur(lignes);
    expect(groupes.map((g) => [g.fournisseur, g.lignes.map((l) => l.id)])).toEqual([
      ["Grossiste Be", ["s"]],
      ["Tiko Import", ["h", "r"]],
      ["", ["x"]],
    ]);
    expect(nombreDeFournisseurs(lignes)).toBe(3);
  });

  it("rien n'est perdu ni dupliqué", () => {
    const ids = grouperParFournisseur(lignes).flatMap((g) => g.lignes.map((l) => l.id));
    expect(ids.sort()).toEqual(["h", "r", "s", "x"]);
  });

  it("les rangées de la feuille : un titre puis ses lignes", () => {
    const rangees = rangeesDeLaFeuille(lignes, true);
    expect(rangees.map((r) => (r.type === "groupe" ? `#${r.nombre}` : r.ligne.id))).toEqual([
      "#1",
      "s",
      "#2",
      "h",
      "r",
      "#1",
      "x",
    ]);
    expect(rangeesDeLaFeuille(lignes, false).every((r) => r.type === "ligne")).toBe(true);
  });

  it("un titre de groupe ne reste pas seul en bas de page", () => {
    const rangees = rangeesDeLaFeuille(lignes, true);
    expect(
      recollerLesGroupes(
        [
          [0, 1, 2],
          [3, 4, 5, 6],
        ],
        rangees,
      ),
    ).toEqual([
      [0, 1],
      [2, 3, 4, 5, 6],
    ]);
  });

  it("le fournisseur en cours est rappelé en tête de page", () => {
    const rangees = rangeesDeLaFeuille(lignes, true);
    expect(groupeEnCours(rangees, 4)).toBe("Tiko Import");
    expect(groupeEnCours(rangees, 2)).toBeNull();
  });
});
