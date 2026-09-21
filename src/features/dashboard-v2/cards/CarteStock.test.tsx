import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CarteStock } from "./CarteStock";
import { chiffresStock } from "../lib/chiffres";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../../lib/prealerteStock";
import type { SourcesChiffres } from "../lib/chiffres";
import type { Product } from "../../../types";

/**
 * L'ÉTAGÈRE, ET SES DEUX NIVEAUX.
 *
 * On part de `chiffresStock` plutôt que d'un objet fabriqué à la main :
 * ce qui est vérifié ici, c'est la chaîne complète — les réglages, le
 * calcul, et ce que la carte en fait.
 */

const ACTIVE: ReglagesAlertesStock = { ...REGLAGES_PAR_DEFAUT, prealerteActive: true, ecart: 2 };

const produit = (nom: string, stock: number, seuil: number): Product =>
  ({
    id: nom,
    designation: nom,
    displayName: nom,
    stockActuel: stock,
    stockDisponible: stock,
    seuilAlerte: seuil,
    prixAchat: 1000,
    typeProduit: "revendu",
    statut: "actif",
    unite: null,
  }) as unknown as Product;

const CATALOGUE = [
  produit("Ciment", 40, 10), // au-dessus de tout
  produit("Huile 1 L", 5, 3), // dans la bande : 3 < 5 <= 5
  produit("Savon", 2, 3), // sous le seuil
];

const sources = (produits: Product[]) =>
  ({
    products: produits,
    sales: [],
    purchases: [],
    expenses: [],
    payments: [],
    sellers: [],
    capital: {},
    orders: [],
    clients: [],
    quotes: [],
    deliveries: [],
    taches: [],
    mouvements: [],
  }) as unknown as SourcesChiffres;

const periode = { intervalle: { debut: "2026-09-01", fin: "2026-09-30" } } as never;

function afficher(produits = CATALOGUE, reglages = ACTIVE) {
  const stock = chiffresStock(sources(produits), periode, "2026-09-21", reglages);
  render(<CarteStock stock={stock} valeurVisible onTelecharger={vi.fn()} onCommander={vi.fn()} />);
  return stock;
}

/** La ligne de l'étagère qui parle de ce produit. */
const ligneDe = (nom: string) => screen.getByText(nom).closest(".item") as HTMLElement;

describe("l'étagère distingue deux niveaux", () => {
  afterEach(cleanup);

  it("sous le seuil : rouge, et le mot qui va avec", () => {
    afficher();
    const savon = ligneDe("Savon");
    expect(savon.className).toContain("low");
    expect(savon.textContent).toContain("stock faible");
  });

  it("dans la bande : orange, et « approche du seuil »", () => {
    afficher();
    const huile = ligneDe("Huile 1 L");
    expect(huile.className).toContain("prealerte");
    expect(huile.textContent).toContain("approche du seuil");
  });

  it("les deux états s'excluent", () => {
    // Un produit déjà sous son seuil n'« approche » plus de rien.
    afficher();
    expect(ligneDe("Savon").className).not.toContain("prealerte");
    expect(ligneDe("Huile 1 L").className).not.toContain("low");
  });

  it("au-dessus de tout : aucune couleur, aucun mot", () => {
    afficher();
    const ciment = ligneDe("Ciment");
    expect(ciment.className).not.toContain("low");
    expect(ciment.className).not.toContain("prealerte");
    expect(ciment.textContent).not.toContain("seuil");
  });

  it("le compte réunit les deux niveaux", () => {
    // Il doit correspondre au bon de commande que les boutons
    // produisent : Savon et Huile, donc deux.
    afficher();
    expect(screen.getByText("2 à recommander")).toBeTruthy();
  });
});

describe("préalerte éteinte, l'étagère est celle d'avant", () => {
  afterEach(cleanup);

  it("aucun produit ne passe en orange", () => {
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(ligneDe("Huile 1 L").className).not.toContain("prealerte");
    expect(ligneDe("Huile 1 L").textContent).not.toContain("approche");
  });

  it("le rouge, lui, ne change pas", () => {
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(ligneDe("Savon").className).toContain("low");
    expect(ligneDe("Savon").textContent).toContain("stock faible");
  });

  it("et le compte s'en tient au seuil", () => {
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(screen.getByText("1 à recommander")).toBeTruthy();
  });

  it("tout est au-dessus : la carte le dit", () => {
    afficher([produit("Ciment", 40, 10)], REGLAGES_PAR_DEFAUT);
    expect(screen.getByText("Tout est au-dessus du seuil")).toBeTruthy();
  });
});
