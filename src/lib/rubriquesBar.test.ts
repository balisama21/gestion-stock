import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

import { planRubriquesBar, planVide, RUBRIQUES_BAR } from "./rubriquesBar";

const cat = (id: string, nom: string, usage = "produit", actif = true) => ({
  id,
  nom,
  usage,
  actif,
  ordre: 0,
});

describe("les rubriques d'un bar", () => {
  it("met de côté les catégories d'un commerce ordinaire et crée celles d'un bar", () => {
    const plan = planRubriquesBar(
      [
        cat("a", "Alimentation"),
        cat("h", "Hygiène et entretien"),
        cat("e", "Emballages"),
        cat("b", "Boissons"),
        cat("l", "Loyer", "depense"),
      ],
      new Map([["b", 3]]),
    );
    // « Boissons » range déjà 3 articles : elle reste.
    expect(plan.aMasquer).toEqual(["a", "h", "e"]);
    expect(plan.aCreer.map((r) => r.nom)).toEqual(RUBRIQUES_BAR);
    expect(plan.depensesACreer).toEqual([
      "Animation et DJ",
      "Matériel son et karaoké",
      "Glace et gaz",
    ]);
  });

  it("ne refait rien quand la carte est déjà celle d'un bar", () => {
    const deja = [
      ...RUBRIQUES_BAR.map((nom, i) => cat(`r${i}`, nom)),
      cat("x", "Animation et DJ", "depense"),
      cat("y", "Matériel son et karaoké", "depense"),
      cat("z", "Glace et gaz", "depense"),
      cat("old", "Équipements", "produit", false),
    ];
    expect(planVide(planRubriquesBar(deja, new Map()))).toBe(true);
  });

  it("reconnaît une rubrique malgré les accents et les majuscules", () => {
    const plan = planRubriquesBar([cat("b", "BIERES")], new Map());
    expect(plan.aMasquer).toEqual([]);
    expect(plan.aCreer.map((r) => r.nom)).not.toContain("Bières");
  });
});
