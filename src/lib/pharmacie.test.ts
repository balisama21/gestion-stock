import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import {
  correspond,
  delaiLisible,
  equivalents,
  etatStock,
  finDeMois,
  lotsEnRayon,
  lotsParUrgence,
  partsTiersPayant,
  urgence,
  type FichePharma,
  type LotPharma,
} from "./pharmacie";

const J = "2026-11-20";

const produit = (p: Partial<Product>): Product =>
  ({
    id: "amox",
    displayName: "Amoxil 500 mg",
    designation: "Amoxil",
    prixAchat: 1000,
    prixVenteDefaut: 1500,
    stockActuel: 0,
    seuilAlerte: 5,
    codeBarres: null,
    sku: null,
    conditionnements: [],
    ...p,
  }) as Product;

let n = 0;
const lot = (p: Partial<LotPharma>): LotPharma => ({
  id: `l${++n}`,
  store_id: "s",
  product_id: "amox",
  numero_lot: `A${n}`,
  date_peremption: "2027-06-30",
  quantite_recue: 10,
  quantite: 10,
  prix_achat_unit: 1000,
  fournisseur: null,
  purchase_id: null,
  recu_le: "2026-10-01",
  cree_le: `2026-10-01T10:00:0${n % 10}Z`,
  ...p,
});

const fiche = (product_id: string, dci: string, dosage: string | null = null): FichePharma => ({
  product_id,
  store_id: "s",
  dci,
  dosage,
  forme: null,
  laboratoire: null,
  emplacement: null,
  regime: "libre",
  conservation: "ambiante",
  notes: null,
});

describe("les péremptions", () => {
  it("classe une date selon l'urgence", () => {
    expect(urgence(null, J)).toBe("sans_date");
    expect(urgence("2026-11-19", J)).toBe("perime");
    expect(urgence("2026-12-15", J)).toBe("un_mois");
    expect(urgence("2027-02-10", J)).toBe("trois_mois");
    expect(urgence("2027-05-01", J)).toBe("six_mois");
    expect(urgence("2028-01-31", J)).toBe("plus_tard");
  });

  it("dit le délai comme on le lit", () => {
    expect(delaiLisible("2026-11-10", J)).toBe("périmé depuis 10 j");
    expect(delaiLisible("2026-11-25", J)).toBe("dans 5 j");
    expect(delaiLisible("2027-03-20", J)).toBe("dans 4 mois");
    expect(delaiLisible("2028-03-31", J)).toBe("03/2028");
  });

  it("prend la fin du mois imprimé sur la boîte", () => {
    expect(finDeMois("2028-02")).toBe("2028-02-29");
    expect(finDeMois("2027-11")).toBe("2027-11-30");
    expect(finDeMois("2027-13")).toBeNull();
  });

  it("sort d'abord le lot qui périme le premier, le périmé en dernier", () => {
    const lots = [
      lot({ id: "tard", date_peremption: "2028-01-31" }),
      lot({ id: "sans", date_peremption: null }),
      lot({ id: "perime", date_peremption: "2026-10-31" }),
      lot({ id: "tot", date_peremption: "2027-01-31" }),
      lot({ id: "vide", quantite: 0 }),
    ];
    expect(lotsEnRayon(lots, "amox", J).map((l) => l.id)).toEqual([
      "tot",
      "tard",
      "sans",
      "perime",
    ]);
  });

  it("sépare le stock en lots, sans date et périmé", () => {
    const p = produit({ stockActuel: 25 });
    const e = etatStock(
      p,
      [
        lot({ quantite: 4, date_peremption: "2026-10-31" }),
        lot({ quantite: 10, date_peremption: "2027-03-31" }),
      ],
      J,
    );
    expect(e).toEqual({
      enLots: 14,
      sansDate: 11,
      totalSansDate: 11,
      disponible: 21,
      perime: 4,
      prochaine: "2027-03-31",
    });
  });

  it("chiffre les lots à risque", () => {
    const g = lotsParUrgence(
      [lot({ quantite: 3, date_peremption: "2026-11-01", prix_achat_unit: 2000 })],
      [produit({})],
      J,
    );
    expect(g.get("perime")![0].valeur).toBe(6000);
    expect(g.get("plus_tard")).toEqual([]);
  });
});

describe("la recherche et les équivalents", () => {
  const doliprane = produit({
    id: "doli",
    displayName: "Doliprane 500 mg",
    prixVenteDefaut: 2000,
    stockActuel: 0,
  });
  const efferalgan = produit({
    id: "effe",
    displayName: "Efferalgan 500 mg",
    prixVenteDefaut: 2500,
    stockActuel: 8,
  });
  const generique = produit({
    id: "para",
    displayName: "Paracétamol 500 mg",
    prixVenteDefaut: 500,
    stockActuel: 30,
  });
  const fort = produit({ id: "para1g", displayName: "Paracétamol 1 g", stockActuel: 30 });
  const fiches = new Map([
    ["doli", fiche("doli", "Paracétamol", "500 mg")],
    ["effe", fiche("effe", "paracetamol", "500 mg")],
    ["para", fiche("para", "Paracétamol", "500 mg")],
    ["para1g", fiche("para1g", "Paracétamol", "1 g")],
  ]);

  it("trouve par molécule, sans accent ni majuscule", () => {
    expect(correspond(doliprane, fiches.get("doli"), "paracetamol 500")).toBe(true);
    expect(correspond(doliprane, fiches.get("doli"), "ibuprofène")).toBe(false);
    expect(correspond(produit({ codeBarres: "6111 2222" }), undefined, "61112222")).toBe(true);
  });

  it("propose la même molécule au même dosage, en stock et moins cher d'abord", () => {
    const e = equivalents(doliprane, fiches, [doliprane, efferalgan, generique, fort]);
    expect(e.map((p) => p.id)).toEqual(["para", "effe"]);
  });
});

describe("le tiers payant", () => {
  it("partage le total entre l'organisme et le patient", () => {
    expect(partsTiersPayant(12_500, 80)).toEqual({ organisme: 10_000, patient: 2_500 });
    expect(partsTiersPayant(3_333, 70)).toEqual({ organisme: 2_333, patient: 1_000 });
    expect(partsTiersPayant(5_000, 100)).toEqual({ organisme: 5_000, patient: 0 });
  });
});

describe("le stock disponible", () => {
  it("compte les lots sans date sans les confondre avec le stock sans lot", () => {
    const e = etatStock(
      produit({ stockActuel: 20 }),
      [
        lot({ quantite: 7, date_peremption: null }),
        lot({ quantite: 5, date_peremption: "2026-10-31" }),
      ],
      J,
    );
    expect(e.sansDate).toBe(8);
    expect(e.totalSansDate).toBe(15);
    expect(e.disponible).toBe(15);
  });
  it("détecte une rupture lorsque tout est périmé", () => {
    expect(
      etatStock(produit({ stockActuel: 10 }), [lot({ date_peremption: "2026-10-31" })], J)
        .disponible,
    ).toBe(0);
  });
  it("conserve le lot du jour et borne le disponible à zéro", () => {
    expect(
      etatStock(produit({ stockActuel: 10 }), [lot({ date_peremption: J })], J).disponible,
    ).toBe(10);
    expect(
      etatStock(produit({ stockActuel: 2 }), [lot({ date_peremption: "2026-10-31" })], J)
        .disponible,
    ).toBe(0);
  });
});
