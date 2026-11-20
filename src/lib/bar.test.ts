import { describe, expect, it } from "vitest";
import {
  droitDeTable,
  dureeDepuis,
  grouperLignes,
  nomDeTable,
  tablesParZone,
  totalDesLignes,
  totalNote,
  type LigneNote,
  type TableBar,
  type ZoneBar,
} from "./bar";

const zone = (id: string, nom: string, droit: number, ordre = 0): ZoneBar => ({
  id,
  store_id: "s",
  nom,
  droit_table: droit,
  ordre,
});
const table = (id: string, numero: string, zone_id: string | null, droit: number | null = null) =>
  ({
    id,
    store_id: "s",
    zone_id,
    numero,
    places: null,
    droit_table: droit,
    active: true,
    ordre: 0,
  }) satisfies TableBar;

let n = 0;
const ligne = (p: Partial<LigneNote>): LigneNote => ({
  id: `l${++n}`,
  store_id: "s",
  note_id: "n",
  product_id: "thb",
  designation: "THB",
  genre: "article",
  quantite: 1,
  prix_unit: 5000,
  offert: false,
  serveur: null,
  annulee: false,
  motif: null,
  sale_id: null,
  cree_le: `2026-11-19T20:00:${String(n).padStart(2, "0")}Z`,
  ...p,
});

describe("le droit de table", () => {
  const zones = [zone("std", "Standard", 5000), zone("vip", "VIP", 20000)];
  it("vient de la zone, sauf si la table a le sien", () => {
    expect(droitDeTable(table("t1", "1", "std"), zones)).toBe(5000);
    expect(droitDeTable(table("t2", "V1", "vip"), zones)).toBe(20000);
    expect(droitDeTable(table("t3", "V2", "vip", 30000), zones)).toBe(30000);
    expect(droitDeTable(table("t4", "4", "std", 0), zones)).toBe(0);
    expect(droitDeTable(table("t5", "5", null), zones)).toBe(0);
  });
});

describe("l'addition d'une note", () => {
  it("compte le servi, met les offerts à 0, ignore les annulés", () => {
    const lignes = [
      ligne({ quantite: 4 }),
      ligne({ quantite: 1, offert: true }),
      ligne({ quantite: 2, annulee: true }),
      ligne({
        product_id: null,
        designation: "Droit de table",
        genre: "droit_table",
        prix_unit: 20000,
      }),
    ];
    expect(totalNote(lignes)).toEqual({
      total: 40000,
      dejaPaye: 0,
      reste: 40000,
      offerts: 5000,
      articles: 5,
    });
  });

  it("déduit ce qui est déjà encaissé", () => {
    const lignes = [ligne({ quantite: 2, sale_id: "v1" }), ligne({ quantite: 3 })];
    expect(totalNote(lignes)).toMatchObject({ total: 25000, dejaPaye: 10000, reste: 15000 });
  });

  it("totalise une addition partagée sur les seules lignes choisies", () => {
    const a = ligne({ quantite: 2 });
    const b = ligne({ quantite: 1, prix_unit: 8000 });
    const payee = ligne({ quantite: 5, sale_id: "v" });
    expect(totalDesLignes([a, b, payee], new Set([a.id, payee.id]))).toBe(10000);
  });
});

describe("les lignes regroupées", () => {
  it("rassemble le même produit au même prix, sépare offerts et payés", () => {
    const lignes = [
      ligne({ quantite: 2 }),
      ligne({ quantite: 3 }),
      ligne({ quantite: 1, offert: true }),
      ligne({ quantite: 1, sale_id: "v" }),
      ligne({ quantite: 1, prix_unit: 6000 }),
    ];
    const g = grouperLignes(lignes);
    expect(g.map((x) => [x.quantite, x.prix_unit, x.offert, x.payee])).toEqual([
      [5, 5000, false, false],
      [1, 5000, true, false],
      [1, 5000, false, true],
      [1, 6000, false, false],
    ]);
    expect(g[0].montant).toBe(25000);
  });
});

describe("la salle", () => {
  it("range les tables par zone, numéros dans l'ordre naturel", () => {
    const zones = [zone("vip", "VIP", 0, 2), zone("std", "Standard", 0, 1)];
    const tables = [
      table("a", "10", "std"),
      table("b", "2", "std"),
      table("c", "V1", "vip"),
      table("d", "X", null),
      { ...table("e", "3", "std"), active: false },
    ];
    const r = tablesParZone(tables, zones);
    expect(r.map((g) => [g.zone?.nom ?? null, g.tables.map((t) => t.numero)])).toEqual([
      ["Standard", ["2", "10"]],
      ["VIP", ["V1"]],
      [null, ["X"]],
    ]);
  });

  it("dit depuis quand une table est occupée", () => {
    const debut = "2026-11-19T20:00:00Z";
    const t = new Date(debut).getTime();
    expect(dureeDepuis(debut, t + 12 * 60000)).toBe("12 min");
    expect(dureeDepuis(debut, t + 125 * 60000)).toBe("2 h 05");
  });
});

describe("le nom d'une table", () => {
  it("ajoute « Table » à un simple numéro, jamais deux fois", () => {
    expect(nomDeTable("4")).toBe("Table 4");
    expect(nomDeTable("V2")).toBe("Table V2");
    expect(nomDeTable("Table4")).toBe("Table4");
    expect(nomDeTable("Comptoir")).toBe("Comptoir");
    expect(nomDeTable("Terrasse 1")).toBe("Terrasse 1");
  });
});
