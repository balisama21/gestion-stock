import { describe, expect, it } from "vitest";
import {
  commissionParDefaut,
  erreurDeCommission,
  preparerModificationVente,
  statutDeReglement,
  totauxDesLignes,
} from "./ventes";

describe("le statut de règlement", () => {
  it("soldé, entamé, pas touché", () => {
    expect(statutDeReglement(0, 5000)).toBe("Payé");
    expect(statutDeReglement(2000, 3000)).toBe("Partiel");
    expect(statutDeReglement(5000, 0)).toBe("Impayé");
  });
});

describe("les totaux d'un ticket", () => {
  it("additionnent les lignes, et le reste vient de solde_du", () => {
    const t = totauxDesLignes([
      { totalVente: 6500, montantPaye: 3000, soldeDu: 3500, margeTotale: 1500 },
      { totalVente: 2000, montantPaye: 0, soldeDu: 2000, margeTotale: 500 },
    ]);
    expect(t).toEqual({ total: 8500, paye: 3000, du: 5500, marge: 2000, statut: "Partiel" });
  });
});

describe("la commission", () => {
  it("le taux de la boutique, arrondi à l'unité — la même valeur partout", () => {
    expect(commissionParDefaut(12_345, 5)).toBe(617);
  });

  it("jamais négative, jamais plus que le total", () => {
    expect(erreurDeCommission(-1, 1000)).toMatch(/négative/);
    expect(erreurDeCommission(1001, 1000)).toMatch(/dépasser/);
    expect(erreurDeCommission(0, 1000)).toBeNull();
    expect(erreurDeCommission(1000, 1000)).toBeNull();
  });
});

describe("modifier une vente", () => {
  const vente = { quantite: 3, prixVenteUnit: 1000, montantPaye: 2000 };

  it("le total suit la quantité, au prix d'origine", () => {
    expect(preparerModificationVente(vente, { quantite: 5 })).toEqual({
      quantite: 5,
      prixVenteUnit: 1000,
      totalVente: 5000,
    });
  });

  it("un prix corrigé change le total : quantité × nouveau prix", () => {
    expect(preparerModificationVente(vente, { quantite: 3, prixVenteUnit: 900 })).toEqual({
      quantite: 3,
      prixVenteUnit: 900,
      totalVente: 2700,
    });
  });

  it("refuse un prix négatif, ou un total sous le payé + avoiré", () => {
    expect(preparerModificationVente(vente, { quantite: 3, prixVenteUnit: -1 })).toHaveProperty(
      "erreur",
    );
    expect(
      preparerModificationVente(
        { ...vente, montantAvoire: 1000 },
        { quantite: 3, prixVenteUnit: 900 },
      ),
    ).toHaveProperty("erreur");
  });

  it("refuse un total sous ce qui a déjà été encaissé, comme la base", () => {
    expect(preparerModificationVente(vente, { quantite: 1 })).toHaveProperty("erreur");
  });

  it("refuse une quantité nulle ou décimale", () => {
    expect(preparerModificationVente(vente, { quantite: 0 })).toHaveProperty("erreur");
    expect(preparerModificationVente(vente, { quantite: 2.5 })).toHaveProperty("erreur");
  });
});
