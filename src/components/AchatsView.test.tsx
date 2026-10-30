import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AchatsView } from "./AchatsView";
import type { Product } from "../types";

/**
 * LE FORMULAIRE D'ACHAT
 *
 *  - Recharger un produit l'achète LUI, même à un autre prix : avant,
 *    un prix différent créait en silence un second produit du même nom.
 *  - Un nouveau produit naît avec sa fiche complète — prix de vente,
 *    seuil, unité, conditionnements —, puis l'achat le recharge.
 *  - Acheter au carton fait entrer le carton en unités de base.
 */

const EAU: Product = {
  id: "p1",
  numero: "P001",
  designation: "Eau 1,5 L",
  variantSuffix: "",
  displayName: "Eau 1,5 L",
  prixAchat: 500,
  prixVenteDefaut: 650,
  fournisseur: "Star",
  stockInitial: 0,
  stockActuel: 30,
  stockReserve: 0,
  stockDisponible: 30,
  seuilAlerte: 6,
  sku: null,
  codeBarres: "111",
  categoryId: null,
  supplierId: null,
  description: null,
  unite: "bouteille",
  tvaRate: null,
  stockMax: null,
  typeProduit: "revendu",
  statut: "actif",
  modePrix: "manuel",
  tauxMarge: null,
  conditionnements: [
    { id: "c1", nom: "carton", quantite: 12, prixVente: 7000, prixAchat: 6000, codeBarres: null },
  ],
};

function afficher(products: Product[] = [EAU]) {
  const onAddPurchase = vi.fn().mockResolvedValue({ error: null, productId: "p1" });
  const onCreerProduit = vi.fn().mockResolvedValue({ error: null, id: "nouveau" });
  const onEditProductDetails = vi.fn().mockResolvedValue({ error: null });
  render(
    <AchatsView
      purchases={[]}
      products={products}
      locale="FR"
      onAddPurchase={onAddPurchase}
      onCreerProduit={onCreerProduit}
      onEditProductDetails={onEditProductDetails}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Nouvel achat/ }));
  return { onAddPurchase, onCreerProduit, onEditProductDetails };
}

/** Choisit un produit dans le sélecteur du catalogue. */
function recharger(nom: string) {
  fireEvent.click(screen.getByRole("button", { name: /Produit à recharger/ }));
  fireEvent.click(within(screen.getByRole("listbox")).getByText(nom));
}

const saisir = (label: RegExp | string, valeur: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valeur } });

/** Le prix de vente du produit — pas celui d'un carton, qui porte le même intitulé. */
const prixDeVente = (valeur: string) =>
  fireEvent.change(screen.getByLabelText(/Prix de vente/, { selector: "#achat-prix-vente" }), {
    target: { value: valeur },
  });

/** Le message du formulaire, parmi les alertes (« vendre à perte » en est une autre). */
const messageDuFormulaire = () =>
  screen
    .getAllByRole("alert")
    .map((a) => a.textContent ?? "")
    .join(" | ");

afterEach(cleanup);

describe("recharger un produit du catalogue", () => {
  it("à un autre prix, c'est le même produit qui est rechargé — jamais un doublon", async () => {
    const { onAddPurchase, onCreerProduit } = afficher();
    recharger("Eau 1,5 L");
    saisir(/^Quantité/, "10");
    saisir(/Prix d'achat unitaire/, "550");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));
    await waitFor(() => expect(onAddPurchase).toHaveBeenCalledTimes(1));
    expect(onCreerProduit).not.toHaveBeenCalled();
    expect(onAddPurchase.mock.calls[0][0]).toMatchObject({
      productId: "p1",
      quantite: 10,
      prixAchatUnit: 550,
      conditionnement: null,
    });
  });

  it("au carton : 2 cartons de 12 font entrer 24 bouteilles", async () => {
    const { onAddPurchase } = afficher();
    recharger("Eau 1,5 L");
    fireEvent.click(screen.getByRole("radio", { name: /^Carton · 12 bouteilles/ }));
    // Le prix habituel du carton est proposé.
    expect((screen.getByLabelText(/Prix d'achat par carton/) as HTMLInputElement).value).toBe(
      "6000",
    );
    saisir(/Nombre de cartons/, "2");
    expect(screen.getByText(/= 24 bouteilles en stock/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));
    await waitFor(() => expect(onAddPurchase).toHaveBeenCalledTimes(1));
    expect(onAddPurchase.mock.calls[0][0]).toMatchObject({
      productId: "p1",
      quantite: 24,
      prixAchatUnit: 500,
      conditionnement: { id: "c1", nombre: 2, prix: 6000 },
    });
  });
});

describe("acheter un produit qui n'existe pas encore", () => {
  it("un nom déjà pris est signalé, et l'on peut recharger l'existant d'un clic", () => {
    afficher();
    fireEvent.click(screen.getByRole("radio", { name: "Nouveau produit" }));
    saisir("Désignation", "eau 1,5 l");
    expect(screen.getByText("Ce produit existe déjà au catalogue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recharger celui-ci" }));
    expect(
      screen.getByRole("radio", { name: "Produit du catalogue" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("un doublon n'est créé que si on le demande", async () => {
    const { onCreerProduit } = afficher();
    fireEvent.click(screen.getByRole("radio", { name: "Nouveau produit" }));
    saisir("Désignation", "Eau 1,5 L");
    saisir(/^Quantité/, "5");
    saisir(/Prix d'achat unitaire/, "480");
    prixDeVente("650");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));
    expect(messageDuFormulaire()).toMatch(/existe déjà/);
    expect(onCreerProduit).not.toHaveBeenCalled();
  });

  it("crée le produit avec son prix de vente, son seuil et son carton, puis l'achète au carton", async () => {
    const { onAddPurchase, onCreerProduit, onEditProductDetails } = afficher([]);
    // Sans catalogue, le formulaire part directement sur la création.
    saisir("Désignation", "Jus de mangue");
    fireEvent.click(screen.getByRole("button", { name: /^Carton$/ }));
    const carton = screen.getAllByTestId("conditionnement")[0];
    fireEvent.change(within(carton).getByLabelText("Contient"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Carton · 24/ }));
    saisir(/Nombre de cartons/, "3");
    saisir(/Prix d'achat par carton/, "24000");
    prixDeVente("1500");
    saisir(/Seuil d'alerte/, "12");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));

    await waitFor(() => expect(onAddPurchase).toHaveBeenCalledTimes(1));
    expect(onCreerProduit.mock.calls[0][0]).toMatchObject({
      designation: "Jus de mangue",
      prixAchat: 1000,
      prixVenteDefaut: 1500,
      seuilAlerte: 12,
      stockInitial: 0,
    });
    // La fiche — et le carton — avant l'achat, qui en a besoin.
    const fiche = onEditProductDetails.mock.calls[0][1];
    expect(fiche.conditionnements).toEqual([
      expect.objectContaining({ nom: "carton", quantite: 24 }),
    ]);
    expect(onAddPurchase.mock.calls[0][0]).toMatchObject({
      productId: "nouveau",
      quantite: 72,
      conditionnement: { nombre: 3, prix: 24000 },
    });
    expect(onEditProductDetails.mock.invocationCallOrder[0]).toBeLessThan(
      onAddPurchase.mock.invocationCallOrder[0],
    );
  });

  it("un achat refusé après la création bascule sur le produit créé : réessayer ne le recrée pas", async () => {
    const { onAddPurchase, onCreerProduit } = afficher([]);
    onAddPurchase.mockResolvedValueOnce({ error: "Réseau perdu." });
    saisir("Désignation", "Jus de mangue");
    saisir(/^Quantité/, "5");
    saisir(/Prix d'achat unitaire/, "1000");
    prixDeVente("1500");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));
    await waitFor(() => expect(messageDuFormulaire()).toMatch(/pas recréé/));
    expect(onCreerProduit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("radio", { name: "Produit du catalogue" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("refuse de créer sans prix de vente", () => {
    const { onCreerProduit } = afficher([]);
    saisir("Désignation", "Jus de mangue");
    saisir(/^Quantité/, "5");
    saisir(/Prix d'achat unitaire/, "1000");
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer l'achat/ }));
    expect(messageDuFormulaire()).toMatch(/Indiquez son prix de vente/);
    expect(onCreerProduit).not.toHaveBeenCalled();
  });
});
