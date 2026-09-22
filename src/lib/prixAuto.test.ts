import { describe, expect, it } from "vitest";
import {
  PRIX_AUTO_DEFAUT,
  arrondirSuperieur,
  calculerLaMarge,
  formaterTaux,
  lirePrixAuto,
  prixDepuisAchat,
  recalculerLesPrix,
  tauxApplicable,
} from "./prixAuto";

describe("les réglages de la boutique", () => {
  it("partent désactivés quand rien n'est réglé", () => {
    expect(lirePrixAuto({})).toEqual(PRIX_AUTO_DEFAUT);
    expect(lirePrixAuto({}).actif).toBe(false);
  });

  it("ne s'activent que sur un vrai booléen", () => {
    expect(lirePrixAuto({ prixAuto: { actif: "oui" } }).actif).toBe(false);
    expect(lirePrixAuto({ prixAuto: { actif: true } }).actif).toBe(true);
  });

  it("bornent un taux aberrant au lieu de le recopier", () => {
    expect(lirePrixAuto({ prixAuto: { taux: -50 } }).taux).toBe(0);
    expect(lirePrixAuto({ prixAuto: { taux: 99999 } }).taux).toBe(1000);
    expect(lirePrixAuto({ prixAuto: { taux: "abc" } }).taux).toBe(10);
  });

  it("trient les taux rapides et en retirent les doublons", () => {
    expect(lirePrixAuto({ prixAuto: { tauxRapides: [30, 5, 5, 10] } }).tauxRapides).toEqual([
      5, 10, 30,
    ]);
  });

  it("retombent sur les taux du logiciel si la liste est vide", () => {
    expect(lirePrixAuto({ prixAuto: { tauxRapides: [] } }).tauxRapides).toEqual([5, 10, 20, 30]);
  });

  it("refusent un arrondi qui n'est pas un des paliers proposés", () => {
    expect(lirePrixAuto({ prixAuto: { arrondi: 37 } }).arrondi).toBe(0);
    expect(lirePrixAuto({ prixAuto: { arrondi: 500 } }).arrondi).toBe(500);
  });
});

/**
 * L'HÉRITAGE EST LE CŒUR DE LA FONCTION.
 *
 * « 10 % pour toute la boutique, mais 5 % pour la catégorie PPN » est
 * l'exemple du cahier des charges, et c'est exactement ce que ces
 * épreuves vérifient.
 */
describe("le taux qui s'applique", () => {
  it("prend celui du produit quand il en a un", () => {
    expect(tauxApplicable(3, 5, 10)).toEqual({ taux: 3, origine: "produit" });
  });

  it("descend à la catégorie quand le produit n'en a pas", () => {
    expect(tauxApplicable(null, 5, 10)).toEqual({ taux: 5, origine: "categorie" });
  });

  it("finit sur la boutique quand ni l'un ni l'autre n'en a", () => {
    expect(tauxApplicable(null, null, 10)).toEqual({ taux: 10, origine: "boutique" });
  });

  /**
   * Le zéro est une décision, pas une absence. Un commerçant qui veut
   * écouler une catégorie à prix coûtant écrit zéro : faire remonter la
   * question d'un cran lui remettrait la marge de la boutique.
   */
  it("respecte un zéro au lieu de le prendre pour une absence", () => {
    expect(tauxApplicable(0, 5, 10)).toEqual({ taux: 0, origine: "produit" });
    expect(tauxApplicable(null, 0, 10)).toEqual({ taux: 0, origine: "categorie" });
  });

  it("traite `undefined` comme `null`", () => {
    expect(tauxApplicable(undefined, undefined, 10).origine).toBe("boutique");
  });
});

describe("l'arrondi", () => {
  it("monte au palier supérieur", () => {
    expect(arrondirSuperieur(1010, 100)).toBe(1100);
    expect(arrondirSuperieur(1010, 500)).toBe(1500);
  });

  it("laisse tranquille un prix déjà sur un palier", () => {
    expect(arrondirSuperieur(1000, 100)).toBe(1000);
  });

  it("ne fait rien quand il n'y a pas d'arrondi", () => {
    expect(arrondirSuperieur(1010, 0)).toBe(1010);
  });
});

describe("le prix calculé", () => {
  it("applique le taux au prix d'achat, pas au prix de vente", () => {
    // 1 000 + 10 % du PRIX D'ACHAT = 1 100. Si c'était une marge sur le
    // prix de vente, il faudrait vendre 1 111.
    expect(prixDepuisAchat(1000, 10, 0)).toBe(1100);
  });

  it("combine taux et arrondi", () => {
    expect(prixDepuisAchat(1234, 20, 100)).toBe(1500);
    expect(prixDepuisAchat(1234, 20, 0)).toBe(1481);
  });

  it("rend zéro pour un prix d'achat absent", () => {
    expect(prixDepuisAchat(0, 20, 100)).toBe(0);
  });

  it("rend le prix d'achat tel quel à taux nul", () => {
    expect(prixDepuisAchat(1000, 0, 0)).toBe(1000);
  });
});

describe("la marge affichée", () => {
  it("donne les Ariary et le pourcentage du prix d'achat", () => {
    const m = calculerLaMarge(1200, 1000);
    expect(m.ariary).toBe(200);
    expect(m.pourcentDeLAchat).toBeCloseTo(20);
    expect(m.aPerte).toBe(false);
  });

  it("signale la vente à perte", () => {
    expect(calculerLaMarge(900, 1000).aPerte).toBe(true);
    expect(calculerLaMarge(900, 1000).ariary).toBe(-100);
  });

  it("ne divise pas par un prix d'achat nul", () => {
    expect(calculerLaMarge(900, 0).pourcentDeLAchat).toBeNull();
    expect(calculerLaMarge(900, 0).aPerte).toBe(false);
  });
});

describe("l'écriture du taux", () => {
  it("met un signe et pas de décimale inutile", () => {
    expect(formaterTaux(20)).toBe("+20 %");
    expect(formaterTaux(16.666)).toBe("+16,7 %");
    expect(formaterTaux(-5)).toBe("−5 %");
    expect(formaterTaux(0)).toBe("0 %");
  });
});

/* ── Le recalcul après un achat ── */

const produit = (p: Partial<Parameters<typeof recalculerLesPrix>[0][number]> = {}) => ({
  id: "p1",
  displayName: "Savon",
  prixAchat: 1000,
  prixVenteDefaut: 1100,
  modePrix: "auto",
  tauxProduit: null,
  tauxCategorie: null,
  ...p,
});

const reglages = { actif: true, taux: 20, tauxRapides: [20], arrondi: 0 as const };

describe("ce qu'un nouveau prix d'achat change", () => {
  it("recalcule un produit automatique et dit ce qui bouge", () => {
    expect(recalculerLesPrix([produit()], reglages)).toEqual([
      { id: "p1", displayName: "Savon", avant: 1100, apres: 1200 },
    ]);
  });

  /**
   * La promesse faite au commerçant : « dès qu'il modifie le prix à la
   * main, le produit passe en manuel et n'est plus jamais recalculé ».
   */
  it("ne touche jamais à un produit passé en manuel", () => {
    expect(recalculerLesPrix([produit({ modePrix: "manuel" })], reglages)).toEqual([]);
  });

  it("ne fait rien quand la fonction est désactivée", () => {
    expect(recalculerLesPrix([produit()], { ...reglages, actif: false })).toEqual([]);
  });

  it("ne liste pas un prix qui ne change pas", () => {
    expect(recalculerLesPrix([produit({ prixVenteDefaut: 1200 })], reglages)).toEqual([]);
  });

  it("suit l'héritage produit puis catégorie puis boutique", () => {
    const [avecProduit] = recalculerLesPrix(
      [produit({ tauxProduit: 5, tauxCategorie: 50 })],
      reglages,
    );
    expect(avecProduit.apres).toBe(1050);
    const [avecCategorie] = recalculerLesPrix([produit({ tauxCategorie: 50 })], reglages);
    expect(avecCategorie.apres).toBe(1500);
  });

  it("laisse tranquille un produit sans prix d'achat", () => {
    expect(recalculerLesPrix([produit({ prixAchat: 0 })], reglages)).toEqual([]);
  });
});
