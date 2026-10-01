import { describe, expect, it } from "vitest";
import { ACCES_SANS_MARQUE, boutiquesDuDomaine, peutCreerUneBoutique } from "./marquesBoutiques";
import { boutiqueEstVerrouillee } from "./verrouillage";

type Ligne = { id: string; marque_id?: string | null };
const toutes: Ligne[] = [
  { id: "t", marque_id: null },
  { id: "a" }, // ligne lue avant la migration : pas de colonne
  { id: "k", marque_id: "m-kinvest" },
  { id: "o", marque_id: "m-autre" },
];

describe("boutiquesDuDomaine", () => {
  it("sur Tantana, seulement les boutiques sans étiquette", () => {
    expect(boutiquesDuDomaine(toutes, null, false).map((b) => b.id)).toEqual(["t", "a"]);
  });

  it("sur un domaine client, seulement celles de sa marque", () => {
    expect(boutiquesDuDomaine(toutes, "m-kinvest", false).map((b) => b.id)).toEqual(["k"]);
  });

  it("l'admin plateforme voit tout", () => {
    expect(boutiquesDuDomaine(toutes, "m-kinvest", true)).toHaveLength(4);
  });
});

describe("peutCreerUneBoutique", () => {
  it("toujours sur Tantana, seulement pour un propriétaire listé ailleurs", () => {
    expect(peutCreerUneBoutique(ACCES_SANS_MARQUE)).toBe(true);
    expect(peutCreerUneBoutique({ marqueId: "m", proprietaire: false })).toBe(false);
    expect(peutCreerUneBoutique({ marqueId: "m", proprietaire: true })).toBe(true);
  });
});

describe("verrou d'une boutique de marque", () => {
  it("jamais fermée, même essai dépassé", () => {
    const passe = new Date(Date.now() - 86_400_000).toISOString();
    const essaiFini = {
      activation_status: "trial",
      trial_ends_at: passe,
      abonnement_jusqu_au: null,
    };
    expect(boutiqueEstVerrouillee(essaiFini)).toBe(true);
    expect(boutiqueEstVerrouillee({ ...essaiFini, marque_id: "m-kinvest" })).toBe(false);
    expect(
      boutiqueEstVerrouillee({ ...essaiFini, activation_status: "locked", marque_id: "m" }),
    ).toBe(false);
  });
});
