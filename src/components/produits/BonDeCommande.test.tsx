import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BonDeCommande } from "./BonDeCommande";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../lib/prealerteStock";
import type { ProduitARecommander } from "../../lib/bonDeCommande";
import type { StoreSettings } from "../../types";

/**
 * LE DOCUMENT QUI PART CHEZ LE FOURNISSEUR.
 *
 * Le PDF est une photographie de ce bloc : ce qui est vérifié ici est
 * donc exactement ce qui sera imprimé. Ce que le test ne peut pas voir,
 * en revanche, c'est l'allure du résultat — seul un œil le dira.
 */

const ACTIVE: ReglagesAlertesStock = { ...REGLAGES_PAR_DEFAUT, prealerteActive: true, ecart: 2 };

const BOUTIQUE = {
  storeName: "Épicerie Tiko",
  subtitle: "",
  suppliers: [],
} as unknown as StoreSettings;

const CATALOGUE: ProduitARecommander[] = [
  {
    id: "h",
    nom: "Huile 1 L",
    numero: "P001",
    stockActuel: 5,
    seuilAlerte: 3,
    fournisseur: "Tiko Import",
    prixAchat: 4000,
  },
  { id: "s", nom: "Savon", numero: "P002", stockActuel: 1, seuilAlerte: 3 },
  { id: "c", nom: "Ciment", numero: "P003", stockActuel: 40, seuilAlerte: 10 },
];

function afficher(produits = CATALOGUE, reglages = ACTIVE) {
  return render(
    <BonDeCommande
      ouvert
      onFermer={vi.fn()}
      produits={produits}
      reglages={reglages}
      settings={BOUTIQUE}
    />,
  );
}

/** La ligne du tableau qui parle de ce produit. */
const ligneDe = (nom: string) => screen.getByText(nom).closest("tr") as HTMLElement;

describe("le bon de commande", () => {
  afterEach(cleanup);

  it("porte le nom de la boutique et la date", () => {
    afficher();
    expect(screen.getByText("Épicerie Tiko")).toBeTruthy();
    expect(screen.getByText("Établi le")).toBeTruthy();
  });

  it("ne liste que ce qu'il faut racheter", () => {
    afficher();
    expect(screen.getByText("Huile 1 L")).toBeTruthy();
    expect(screen.getByText("Savon")).toBeTruthy();
    // Quarante unités pour un seuil de dix : rien à commander.
    expect(screen.queryByText("Ciment")).toBeNull();
  });

  it("dit combien commander", () => {
    afficher();
    // Stock 5, seuil 3 : le niveau normal est 6, il manque 1.
    const cellules = within(ligneDe("Huile 1 L")).getAllByRole("cell");
    expect(cellules[3].textContent).toBe("1");
    // Stock 1, seuil 3 : il manque 5.
    expect(within(ligneDe("Savon")).getAllByRole("cell")[3].textContent).toBe("5");
  });

  it("laisse vide ce qu'il ignore, plutôt que d'écrire zéro", () => {
    // Un prix inventé sur un bon de commande devient une erreur qu'on
    // ne rattrape plus.
    afficher();
    const cellules = within(ligneDe("Savon")).getAllByRole("cell");
    expect(cellules[4].textContent).toBe("");
    expect(cellules[5].textContent).toBe("");
  });

  it("annonce ce que son total ne compte pas", () => {
    afficher();
    expect(screen.getByText(/1 ligne sans prix d'achat n'y est pas comptée/)).toBeTruthy();
  });

  it("n'affiche pas de total quand aucun prix n'est connu", () => {
    // « 0 Ar » se lirait comme une commande gratuite.
    afficher([{ id: "s", nom: "Savon", stockActuel: 1, seuilAlerte: 3 }]);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("le dit, et ne propose rien, quand il n'y a rien à commander", () => {
    afficher([CATALOGUE[2]]);
    expect(screen.getByText(/Il n'y a rien à commander/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excel/ })).toBeNull();
  });

  it("préalerte éteinte, il s'en tient au seuil", () => {
    // La garantie « rien ne change pour qui n'active pas ».
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(screen.getByText("Savon")).toBeTruthy();
    expect(screen.queryByText("Huile 1 L")).toBeNull();
  });

  it("propose les trois sorties", () => {
    afficher();
    expect(screen.getByRole("button", { name: /PDF/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /CSV/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Excel/ })).toBeTruthy();
  });
});
