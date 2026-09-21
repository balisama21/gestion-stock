import { describe, expect, it } from "vitest";
import {
  cellulesDeLigne,
  COLONNES_BON_DE_COMMANDE,
  lignesDuBonDeCommande,
  quantiteSuggeree,
  totalDuBon,
  type ProduitARecommander,
} from "./bonDeCommande";
import { composerCsv } from "./exportTableur";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "./prealerteStock";

/**
 * CE QUE LE FOURNISSEUR VA RECEVOIR.
 *
 * Un bon de commande part chez un tiers : une quantité fausse se paie
 * en marchandise, un total inventé en discussion. C'est la raison
 * d'être de ces tests.
 */

const ACTIVE: ReglagesAlertesStock = { ...REGLAGES_PAR_DEFAUT, prealerteActive: true, ecart: 2 };

const produit = (p: Partial<ProduitARecommander> & { id: string }): ProduitARecommander => ({
  nom: p.id,
  stockActuel: 0,
  seuilAlerte: 3,
  ...p,
});

describe("combien commander", () => {
  it("l'exemple du client : stock 5, seuil 3, il manque 1", () => {
    // Le niveau normal est le double du seuil, soit 6.
    expect(quantiteSuggeree(5, 3)).toBe(1);
  });

  it("un produit à zéro se recharge entièrement", () => {
    expect(quantiteSuggeree(0, 3)).toBe(6);
  });

  it("jamais négative", () => {
    // « −4 » sur un bon de commande ne veut rien dire.
    expect(quantiteSuggeree(20, 3)).toBe(0);
  });
});

describe("qui entre dans la liste", () => {
  const catalogue = [
    produit({ id: "Sous le seuil", stockActuel: 2, seuilAlerte: 3 }),
    produit({ id: "Dans la bande", stockActuel: 5, seuilAlerte: 3 }),
    produit({ id: "Au-dessus", stockActuel: 9, seuilAlerte: 3 }),
    produit({ id: "Sans seuil", stockActuel: 0, seuilAlerte: 0 }),
  ];

  it("les deux niveaux, et rien d'autre", () => {
    const noms = lignesDuBonDeCommande(catalogue, ACTIVE).map((l) => l.produit);
    expect(noms).toEqual(["Sous le seuil", "Dans la bande"]);
  });

  it("préalerte éteinte, la liste se réduit au seuil", () => {
    // C'est la garantie « rien ne change pour qui n'active pas » :
    // exactement ce que l'application listait déjà.
    const noms = lignesDuBonDeCommande(catalogue, REGLAGES_PAR_DEFAUT).map((l) => l.produit);
    expect(noms).toEqual(["Sous le seuil"]);
  });

  it("du plus urgent au moins urgent, en proportion du seuil", () => {
    // Les deux manquent de DEUX unités. L'un a l'étagère vide, l'autre
    // en a dix-huit : une soustraction les confondrait, la proportion
    // les sépare.
    const lignes = lignesDuBonDeCommande(
      [
        produit({ id: "Confortable", stockActuel: 18, seuilAlerte: 20 }),
        produit({ id: "Critique", stockActuel: 0, seuilAlerte: 2 }),
      ],
      ACTIVE,
    );
    expect(lignes.map((l) => l.produit)).toEqual(["Critique", "Confortable"]);
  });
});

describe("ce qui manque reste vide", () => {
  it("pas de fournisseur, pas de prix : pas de total", () => {
    const [l] = lignesDuBonDeCommande([produit({ id: "Savon", stockActuel: 1 })], ACTIVE);
    expect(l.fournisseur).toBe("");
    expect(l.prixAchat).toBeNull();
    expect(l.totalEstime).toBeNull();
  });

  it("un prix à zéro compte comme absent", () => {
    // La colonne est NOT NULL DEFAULT 0 en base : rien ne distingue
    // « gratuit » de « pas saisi », et un total à zéro sur un bon de
    // commande serait un engagement faux.
    const [l] = lignesDuBonDeCommande(
      [produit({ id: "Savon", stockActuel: 1, prixAchat: 0 })],
      ACTIVE,
    );
    expect(l.prixAchat).toBeNull();
    expect(l.totalEstime).toBeNull();
  });

  it("la référence prend le numéro, sinon la référence saisie, sinon rien", () => {
    const lignes = lignesDuBonDeCommande(
      [
        produit({ id: "a", nom: "Avec numéro", stockActuel: 1, numero: "P001", sku: "XYZ" }),
        produit({ id: "b", nom: "Avec sku", stockActuel: 1, sku: "XYZ" }),
        produit({ id: "c", nom: "Sans rien", stockActuel: 1 }),
      ],
      ACTIVE,
    );
    expect(lignes.map((l) => l.reference)).toEqual(["P001", "XYZ", ""]);
  });

  it("chiffre ce qu'il sait quand le prix est là", () => {
    const [l] = lignesDuBonDeCommande(
      [produit({ id: "Huile", stockActuel: 5, seuilAlerte: 3, prixAchat: 4000 })],
      ACTIVE,
    );
    expect(l.quantiteSuggeree).toBe(1);
    expect(l.totalEstime).toBe(4000);
  });
});

describe("le total du bon", () => {
  const avecPrix = produit({ id: "Huile", stockActuel: 5, seuilAlerte: 3, prixAchat: 4000 });
  const sansPrix = produit({ id: "Savon", stockActuel: 1, seuilAlerte: 3 });

  it("n'additionne que ce qui a un prix, et dit ce qui manque", () => {
    const t = totalDuBon(lignesDuBonDeCommande([avecPrix, sansPrix], ACTIVE));
    expect(t.montant).toBe(4000); // 1 × 4000
    expect(t.lignesSansPrix).toBe(1);
  });

  it("reste nul quand aucune ligne n'a de prix", () => {
    // « 0 Ar » se lirait comme une commande gratuite.
    const t = totalDuBon(lignesDuBonDeCommande([sansPrix], ACTIVE));
    expect(t.montant).toBeNull();
    expect(t.lignesSansPrix).toBe(1);
  });
});

describe("le fichier à retravailler", () => {
  const lignes = lignesDuBonDeCommande(
    [
      produit({
        id: "h",
        nom: "Huile 1 L",
        stockActuel: 5,
        seuilAlerte: 3,
        numero: "P001",
        fournisseur: "Tiko",
        prixAchat: 4000,
      }),
      produit({ id: "s", nom: "Savon", stockActuel: 1, seuilAlerte: 3 }),
    ],
    ACTIVE,
  );

  it("porte les huit colonnes demandées, dans l'ordre", () => {
    expect([...COLONNES_BON_DE_COMMANDE]).toEqual([
      "Produit",
      "Référence",
      "Stock actuel",
      "Seuil d'alerte",
      "Quantité suggérée",
      "Fournisseur",
      "Prix d'achat",
      "Total estimé",
    ]);
  });

  it("une cellule vide reste vide, et n'est pas un zéro", () => {
    const savon = lignes.find((l) => l.produit === "Savon")!;
    expect(cellulesDeLigne(savon)).toEqual(["Savon", null, 1, 3, 5, null, null, null]);
  });

  it("une ligne complète porte ses huit valeurs", () => {
    const huile = lignes.find((l) => l.produit === "Huile 1 L")!;
    expect(cellulesDeLigne(huile)).toEqual(["Huile 1 L", "P001", 5, 3, 1, "Tiko", 4000, 4000]);
  });

  it("le CSV s'ouvre dans un tableur français", () => {
    const csv = composerCsv(COLONNES_BON_DE_COMMANDE, lignes.map(cellulesDeLigne));

    // La marque d'ordre des octets, sans laquelle « Référence »
    // devient « RÃ©fÃ©rence » à l'ouverture.
    expect(csv.startsWith("﻿")).toBe(true);
    // Le point-virgule, sans lequel le fichier s'ouvre en une colonne.
    expect(csv).toContain("Produit;Référence;Stock actuel");
    // Une cellule vide, et non un « null » écrit en toutes lettres.
    expect(csv).toContain("Savon;;1;3;5;;;");
  });

  it("protège une valeur qui contient le séparateur", () => {
    const csv = composerCsv(["A", "B"], [["Vis 4;6 mm", 'Le "grand" modèle']]);
    expect(csv).toContain('"Vis 4;6 mm";"Le ""grand"" modèle"');
  });
});
