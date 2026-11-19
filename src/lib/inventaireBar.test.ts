import { describe, expect, it } from "vitest";
import { bilanInventaire, ecarts, inventairesPasses, noteInventaire } from "./inventaireBar";
import type { Product } from "../types";

const produit = (id: string, stock: number, prixAchat: number) =>
  ({ id, displayName: id, stockActuel: stock, prixAchat }) as Product;

describe("l'inventaire du soir", () => {
  const produits = [produit("thb", 48, 2500), produit("coca", 20, 1200), produit("rhum", 6, 15000)];

  it("compare le compté au stock et chiffre les écarts", () => {
    const l = ecarts(produits, { thb: 45, coca: 20, rhum: 7 });
    expect(l.map((x) => [x.produit.id, x.ecart, x.valeur])).toEqual([
      ["thb", -3, -7500],
      ["coca", 0, 0],
      ["rhum", 1, 15000],
    ]);
    expect(bilanInventaire(l)).toEqual({ comptes: 3, enEcart: 2, manquant: -3, valeur: 7500 });
  });

  it("ignore les articles qu'on n'a pas comptés", () => {
    expect(ecarts(produits, { coca: 18 }).map((x) => x.produit.id)).toEqual(["coca"]);
  });

  it("relit les inventaires passés dans les corrections de stock", () => {
    const note = noteInventaire("2026-11-19");
    expect(note).toBe("Inventaire du soir · 19/11/2026");
    const passes = inventairesPasses(
      [
        { product_id: "thb", stock_actuel_delta: -3, note, created_at: "2026-11-19T23:40:00Z" },
        { product_id: "rhum", stock_actuel_delta: 1, note, created_at: "2026-11-19T23:40:01Z" },
        {
          product_id: "thb",
          stock_actuel_delta: -5,
          note: "Casse",
          created_at: "2026-11-19T22:00:00Z",
        },
      ],
      new Map([
        ["thb", 2500],
        ["rhum", 15000],
      ]),
    );
    expect(passes).toEqual([
      { note, quand: "2026-11-19T23:40:01Z", articles: 2, manquant: -3, valeur: 7500 },
    ]);
  });
});
