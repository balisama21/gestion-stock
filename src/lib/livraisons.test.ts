import { describe, expect, it } from "vitest";
import { argentChezLesLivreurs, estEnCours, type Livraison } from "./livraisons";

const course = (p: Partial<Livraison> & { id: string }): Livraison =>
  ({
    statut: "livree",
    montant_a_encaisser: 10_000,
    montant_encaisse: 10_000,
    argent_remis_le: null,
    livreur_id: null,
    confie_a: null,
    ...p,
  }) as Livraison;

const nomDuMembre = (id: string) => (id === "u1" ? "Hery (équipe)" : "?");

describe("l'argent encore chez les livreurs", () => {
  it("sépare les personnes hors équipe au lieu de les fondre en « Non assignée »", () => {
    const groupes = argentChezLesLivreurs(
      [
        course({ id: "a", confie_a: "Jean" }),
        course({ id: "b", confie_a: "Paul", montant_encaisse: 5_000 }),
        course({ id: "c", confie_a: "jean " }),
        course({ id: "d", livreur_id: "u1" }),
      ],
      nomDuMembre,
    );
    expect(groupes.map((g) => [g.qui, g.montant, g.ids])).toEqual([
      ["Jean", 20_000, ["a", "c"]],
      ["Paul", 5_000, ["b"]],
      ["Hery (équipe)", 10_000, ["d"]],
    ]);
  });

  it("ne garde que l'argent livré, encaissé et pas encore rendu", () => {
    const groupes = argentChezLesLivreurs(
      [
        course({ id: "rendu", confie_a: "Jean", argent_remis_le: "2026-10-18T10:00:00Z" }),
        course({ id: "rien", confie_a: "Jean", montant_encaisse: 0 }),
        course({ id: "route", confie_a: "Jean", statut: "en_cours" }),
      ],
      nomDuMembre,
    );
    expect(groupes).toEqual([]);
  });

  it("une course sans personne reste à part, sous « Non assignée »", () => {
    const [g] = argentChezLesLivreurs([course({ id: "x" })], nomDuMembre);
    expect(g.qui).toBe("Non assignée");
  });
});

describe("une course en cours", () => {
  it("une course échouée est close, comme sur la page Livraisons", () => {
    expect(estEnCours({ statut: "a_faire" })).toBe(true);
    expect(estEnCours({ statut: "en_cours" })).toBe(true);
    expect(estEnCours({ statut: "echouee" })).toBe(false);
    expect(estEnCours({ statut: "livree" })).toBe(false);
  });
});
