import { describe, expect, it } from "vitest";
import { cibleDeLAchat } from "./cibleAchat";

const EAU = { id: "p1", designation: "Eau", prixAchat: 500, fournisseur: "Star" };
const achat = (productId: string | null, prixAchatUnit = 500) => ({
  productId,
  designation: "Eau",
  prixAchatUnit,
  fournisseur: "Star",
});

describe("le produit qu'un achat recharge", () => {
  it("un produit créé à l'instant, pas encore dans la liste, est quand même rechargé", () => {
    // Le cas de « crisataline » : créé par « Nouveau produit », puis acheté
    // avant que la liste ne se rafraîchisse. Avant, l'achat était refusé.
    expect(cibleDeLAchat(achat("tout-neuf"), [EAU])).toEqual({
      productId: "tout-neuf",
      produit: null,
    });
  });

  it("un produit désigné et connu est celui-là, même à un autre prix", () => {
    expect(cibleDeLAchat(achat("p1", 550), [EAU])).toEqual({ productId: "p1", produit: EAU });
  });

  it("sans identifiant : le nom, le prix et le fournisseur, sinon un nouveau produit", () => {
    expect(cibleDeLAchat(achat(null), [EAU]).productId).toBe("p1");
    expect(cibleDeLAchat(achat(null, 600), [EAU])).toEqual({ productId: null, produit: null });
  });
});
