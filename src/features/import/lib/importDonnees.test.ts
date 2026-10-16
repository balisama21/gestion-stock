import { describe, expect, it } from "vitest";
import {
  analyserCsv,
  bilanPreparation,
  detecterNature,
  lireDate,
  clesExistantes,
  detecterSeparateur,
  devinerCorrespondance,
  empreinte,
  enTableau,
  lireNombre,
  preparerLignes,
  preparerLignesNommees,
} from "./importDonnees";

describe("lecture CSV", () => {
  it("devine le point-virgule d'Excel en français", () => {
    expect(detecterSeparateur("Désignation;Prix;Stock")).toBe(";");
    expect(detecterSeparateur("a,b,c")).toBe(",");
    expect(detecterSeparateur('"a;b",c,d')).toBe(",");
  });

  it("gère guillemets, guillemets doublés, retours à la ligne cités et BOM", () => {
    const csv = '﻿Nom;Note\r\n"Rakoto; fils";"il a dit ""oui"""\r\n"Multi\nligne";x\r\n\r\n';
    expect(analyserCsv(csv)).toEqual([
      ["Nom", "Note"],
      ["Rakoto; fils", 'il a dit "oui"'],
      ["Multi\nligne", "x"],
    ]);
  });

  it("saute un titre seul au-dessus des en-têtes", () => {
    const t = enTableau([["Inventaire 2026"], ["Produit", "Prix"], ["Riz", 1000]]);
    expect(t.entetes).toEqual(["Produit", "Prix"]);
    expect(t.lignes).toEqual([["Riz", 1000]]);
  });
});

describe("nombres", () => {
  it.each([
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["12 000 Ar", 12000],
    ["12,000", 12000],
    ["3,5", 3.5],
    ["0,500", 0.5],
    [42, 42],
    ["", null],
    [null, null],
  ])("%s → %s", (entree, attendu) => {
    expect(lireNombre(entree as string)).toBe(attendu);
  });

  it("rend NaN pour un texte illisible", () => {
    expect(lireNombre("douze")).toBeNaN();
  });
});

describe("correspondance des colonnes", () => {
  it("rapproche les en-têtes courants, sans réutiliser une colonne", () => {
    const c = devinerCorrespondance(
      ["Désignation", "Prix d'achat", "Prix de vente", "Qté", "Stock minimum", "Fournisseur"],
      "produits",
    );
    expect(c).toMatchObject({
      designation: 0,
      prix_achat: 1,
      prix_vente: 2,
      stock_initial: 3,
      seuil_alerte: 4,
      fournisseur: 5,
    });
  });

  it("laisse vide ce qu'il ne reconnaît pas", () => {
    const c = devinerCorrespondance(["Nom", "Zzz"], "clients");
    expect(c.nom).toBe(0);
    expect(c.email).toBeNull();
  });
});

describe("validation et doublons", () => {
  const tableau = {
    entetes: ["Produit", "PV", "Stock"],
    lignes: [
      ["Riz 25kg", "50 000", 10],
      ["riz 25KG", "50 000", 2], // doublon dans le fichier
      ["Sucre", "abc", 1], // prix illisible
      ["", "100", 1], // désignation manquante
      ["Huile", "12000", 1.5], // stock non entier
      ["Farine", "30000", 4], // déjà en base
      ["Sel", "1000", ""],
    ],
  };
  const corr = devinerCorrespondance(tableau.entetes, "produits");
  const existantes = clesExistantes("produits", [{ designation: "FARINE", variante: "" }]);
  const lignes = preparerLignes(tableau, corr, "produits", existantes);

  it("classe chaque ligne", () => {
    expect(lignes.map((l) => l.statut)).toEqual([
      "ok",
      "doublon_fichier",
      "erreur",
      "erreur",
      "erreur",
      "doublon_existant",
      "ok",
    ]);
    expect(lignes[0].numero).toBe(2);
    expect(lignes[0].valeurs).toMatchObject({
      designation: "Riz 25kg",
      prix_vente: 50000,
      stock_initial: 10,
    });
    expect(lignes[3].erreurs).toContain("Désignation obligatoire");
    expect(lignes[4].erreurs[0]).toMatch(/entier/);
  });

  it("fait le bilan", () => {
    expect(bilanPreparation(lignes)).toEqual({
      total: 7,
      aImporter: 2,
      erreurs: 3,
      doublonsFichier: 1,
      doublonsExistants: 1,
    });
  });

  it("donne une empreinte stable", () => {
    expect(empreinte(lignes)).toBe(
      empreinte(preparerLignes(tableau, corr, "produits", existantes)),
    );
    expect(empreinte(lignes)).not.toBe(empreinte(lignes.slice(1)));
  });

  it("reconnaît un client déjà connu par e-mail ou téléphone", () => {
    const ex = clesExistantes("clients", [
      { nom: "Rabe", email: "rabe@exemple.mg", telephone: "034 12 345 67" },
    ]);
    const l = preparerLignesNommees(
      [
        { nom: "Rabe B.", email: "RABE@exemple.mg" },
        { nom: "Autre", telephone: "+261 34 12 345 67" },
        { nom: "Nouveau", email: "pas-un-email" },
        { nom: "Nouveau", email: "n@exemple.mg" },
      ],
      "clients",
      ex,
    );
    expect(l.map((x) => x.statut)).toEqual([
      "doublon_existant",
      "doublon_existant",
      "erreur",
      "ok",
    ]);
  });

  it("applique aux lignes de l'IA la même validation qu'à un fichier", () => {
    const l = preparerLignesNommees(
      [
        { designation: "Savon", prix_vente: -5 },
        { designation: "Savon", stock_initial: "3" },
      ],
      "produits",
      new Set(),
    );
    expect(l[0].statut).toBe("erreur");
    expect(l[1].statut).toBe("ok");
    expect(l[1].valeurs.stock_initial).toBe(3);
  });
});

describe("dates", () => {
  const jour = new Date("2026-10-16T12:00:00Z");
  it.each([
    ["15/10/2026", "2026-10-15"],
    ["5-1-26", "2026-01-05"],
    ["2026-10-01", "2026-10-01"],
    [46300, "2026-10-05"],
    ["", null],
  ])("%s → %s", (entree, attendu) => {
    expect(lireDate(entree as string, jour)).toBe(attendu);
  });

  it("refuse une date impossible ou future", () => {
    expect(lireDate("31/02/2026", jour)).toBe("invalide");
    expect(lireDate("01/01/2030", jour)).toBe("invalide");
    expect(lireDate("bientôt", jour)).toBe("invalide");
  });
});

describe("achats", () => {
  it("exige date, produit, quantité positive et prix ; contrôle le montant payé", () => {
    const l = preparerLignesNommees(
      [
        { date: "2026-10-01", designation: "Riz", quantite: 2, prix_achat: 100 },
        { date: "2026-10-01", designation: "Riz", quantite: 0, prix_achat: 100 },
        { date: "2026-10-01", designation: "Riz", quantite: 2, prix_achat: 100, montant_paye: 500 },
        { designation: "Riz", quantite: 2, prix_achat: 100 },
      ],
      "achats",
      new Map(),
    );
    expect(l.map((x) => x.statut)).toEqual(["ok", "erreur", "erreur", "erreur"]);
    expect(l[1].erreurs[0]).toMatch(/supérieur à zéro/);
    expect(l[2].erreurs[0]).toMatch(/Montant payé/);
    expect(l[3].erreurs).toEqual(["Date obligatoire"]);
  });

  it("reconnaît un achat déjà enregistré", () => {
    const ex = clesExistantes("achats", [
      { date: "2026-10-01", designation: "Riz 25kg", quantite: 2, prix_achat: 100 },
    ]);
    const l = preparerLignesNommees(
      [
        {
          date: "01/10/2026",
          designation: "riz",
          variante: "25KG",
          quantite: 2,
          prix_achat: "100",
        },
      ],
      "achats",
      ex,
    );
    expect(l[0].statut).toBe("doublon_existant");
  });
});

describe("rattachement à l'existant", () => {
  it("garde l'identifiant de l'enregistrement recoupé", () => {
    const ex = clesExistantes("produits", [{ id: "p1", designation: "Riz", variante: "" }]);
    const [l] = preparerLignesNommees([{ designation: "RIZ", prix_vente: 1 }], "produits", ex);
    expect(l).toMatchObject({ statut: "doublon_existant", existantId: "p1" });
  });
});

describe("détection du type de données", () => {
  it.each([
    [["Désignation", "Prix de vente", "Quantité", "Fournisseur"], [], "produits"],
    [["Article", "PA", "PV", "Stock"], [], "produits"],
    [["Nom", "Prénom", "Téléphone", "Email"], [], "clients"],
    [["Nom du fournisseur", "Téléphone", "Conditions de paiement"], [], "fournisseurs"],
    [["Date", "Produit", "Quantité", "Prix d'achat", "Fournisseur"], [], "achats"],
    [["Date", "Produit", "Qté", "Prix de vente", "Client", "Vendeur"], [], "ventes"],
    [["Nom", "Téléphone"], ["Fournisseurs.xlsx"], "fournisseurs"],
    [["Nom", "Téléphone"], ["Feuil1", "clients 2026.csv"], "clients"],
  ])("%j (%j) → %s", (entetes, indices, attendu) => {
    expect(detecterNature(entetes as string[], indices as string[]).nature).toBe(attendu);
  });

  it("demande quand plusieurs destinations sont possibles", () => {
    const d = detecterNature(["Nom", "Téléphone", "Email"]);
    expect(d.nature).toBeNull();
    expect(d.ambigu).toBe(true);
    expect(d.candidats.map((c) => c.nature)).toEqual(
      expect.arrayContaining(["clients", "fournisseurs"]),
    );
  });

  it("ne reconnaît rien sans colonne obligatoire", () => {
    expect(detecterNature(["Colonne A", "Colonne B"])).toMatchObject({
      nature: null,
      ambigu: false,
    });
  });

  it("ne prend pas une liste de contacts pour des produits", () => {
    expect(detecterNature(["Nom", "Ville"]).candidats.map((c) => c.nature)).not.toContain(
      "produits",
    );
  });
});
