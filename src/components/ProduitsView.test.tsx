import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProduitsView } from "./ProduitsView";
import { REGLAGES_PAR_DEFAUT } from "../lib/prealerteStock";
import type { Database } from "../lib/database.types";
import type { Product } from "../types";

/**
 * LE CATALOGUE : CATÉGORIES, UNITÉS ET CONDITIONNEMENTS
 *
 * La catégorie d'un produit sert à le retrouver ; son unité et ses
 * cartons, à lire son stock comme on le compte en rayon.
 */

const base: Product = {
  id: "p1",
  numero: "P001",
  designation: "Eau 1,5 L",
  variantSuffix: "",
  displayName: "Eau 1,5 L",
  prixAchat: 500,
  prixVenteDefaut: 650,
  fournisseur: "",
  stockInitial: 0,
  stockActuel: 30,
  stockReserve: 0,
  stockDisponible: 30,
  seuilAlerte: 6,
  sku: null,
  codeBarres: "111",
  categoryId: "boissons",
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
    { id: "c1", nom: "carton", quantite: 12, prixVente: 7000, prixAchat: null, codeBarres: "999" },
  ],
};
const RIZ: Product = {
  ...base,
  id: "p2",
  numero: "P002",
  designation: "Riz",
  displayName: "Riz",
  codeBarres: null,
  categoryId: "epicerie",
  unite: "kg",
  stockActuel: 120,
  stockDisponible: 120,
  conditionnements: [],
};

const categorie = (id: string, nom: string, parent_id: string | null = null) =>
  ({
    id,
    nom,
    parent_id,
    ordre: 0,
    actif: true,
    usage: "produit",
    taux_marge: null,
  }) as unknown as Database["public"]["Tables"]["categories"]["Row"];

const CATEGORIES = [
  categorie("alimentation", "Alimentation"),
  categorie("boissons", "Boissons", "alimentation"),
  categorie("epicerie", "Épicerie", "alimentation"),
  categorie("hygiene", "Hygiène"),
];

function afficher() {
  render(
    <ProduitsView
      products={[base, RIZ]}
      locale="FR"
      reglagesAlertes={REGLAGES_PAR_DEFAUT}
      onAddProduct={vi.fn().mockResolvedValue({ error: null, id: "n" })}
      categories={CATEGORIES}
    />,
  );
}

afterEach(cleanup);

describe("le catalogue", () => {
  it("se filtre par catégorie, une famille ramenant ses sous-catégories", () => {
    afficher();
    const filtre = screen.getByLabelText("Catégorie");
    fireEvent.change(filtre, { target: { value: "boissons" } });
    expect(screen.queryByText("Riz")).toBeNull();
    expect(screen.getByText("Eau 1,5 L")).toBeTruthy();

    fireEvent.change(filtre, { target: { value: "alimentation" } });
    expect(screen.getByText("Riz")).toBeTruthy();
    expect(screen.getByText("Eau 1,5 L")).toBeTruthy();

    fireEvent.change(filtre, { target: { value: "hygiene" } });
    expect(screen.queryByText("Riz")).toBeNull();
    expect(screen.queryByText("Eau 1,5 L")).toBeNull();
  });

  it("se cherche par le code-barres du carton, ou par le nom de la catégorie", () => {
    afficher();
    const recherche = screen.getByPlaceholderText(/Rechercher un produit/);
    fireEvent.change(recherche, { target: { value: "999" } });
    expect(screen.getByText("Eau 1,5 L")).toBeTruthy();
    expect(screen.queryByText("Riz")).toBeNull();

    fireEvent.change(recherche, { target: { value: "épicerie" } });
    expect(screen.getByText("Riz")).toBeTruthy();
    expect(screen.queryByText("Eau 1,5 L")).toBeNull();
  });

  it("dit le stock dans son unité, et la fiche le donne aussi en cartons", () => {
    afficher();
    expect(screen.getByText("30 bouteilles en stock")).toBeTruthy();
    expect(screen.getByText("120 kg en stock")).toBeTruthy();
    fireEvent.click(screen.getByText("Eau 1,5 L"));
    expect(screen.getByText("30 bouteilles (2 cartons + 6 bouteilles)")).toBeTruthy();
    expect(screen.getByText(/carton de 12 bouteilles · 7\s000/)).toBeTruthy();
  });
});

/**
 * L'UNITÉ À LA CRÉATION ET À LA MODIFICATION
 *
 * Une pièce n'ouvre rien ; un paquet demande ce qu'il contient, son
 * prix d'achat, et un prix de vente saisi au paquet OU à la pièce.
 */
function creer() {
  const onAddProduct = vi.fn().mockResolvedValue({ error: null, id: "n" });
  const onEditProductDetails = vi.fn().mockResolvedValue({ error: null });
  render(
    <ProduitsView
      products={[base, RIZ]}
      locale="FR"
      reglagesAlertes={REGLAGES_PAR_DEFAUT}
      onAddProduct={onAddProduct}
      onEditProduct={vi.fn().mockResolvedValue({ error: null })}
      onEditProductDetails={onEditProductDetails}
      categories={CATEGORIES}
    />,
  );
  return { onAddProduct, onEditProductDetails };
}

const ecrire = (label: RegExp | string, valeur: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valeur } });

describe("l'unité d'un nouveau produit", () => {
  it("à la pièce ou au kg, aucun champ de plus", () => {
    creer();
    fireEvent.click(screen.getByRole("button", { name: /Nouveau produit/ }));
    expect(screen.getByRole("radio", { name: "Pièce" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByLabelText(/Combien de/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Kg" }));
    expect(screen.queryByLabelText(/Combien de/)).toBeNull();
    expect(screen.getByLabelText(/Prix d'achat \(par kg\)/)).toBeTruthy();
  });

  it("un paquet de 12 acheté 12 000 et vendu 15 000 : 1 000 et 1 250 la pièce, et inversement", async () => {
    const { onAddProduct, onEditProductDetails } = creer();
    fireEvent.click(screen.getByRole("button", { name: /Nouveau produit/ }));
    ecrire(/Désignation/, "Cahier");
    fireEvent.click(screen.getByRole("radio", { name: "Paquet" }));
    ecrire(/Combien de pièces contient un paquet/, "12");
    ecrire(/Prix d'achat du paquet/, "12000");
    expect(screen.getByText(/Soit 1\s000.*par pièce/)).toBeTruthy();

    ecrire(/Prix de vente du paquet/, "15000");
    expect(screen.getByText(/Soit 1\s250.*la pièce/)).toBeTruthy();

    // L'autre référence : le prix affiché est converti, un seul champ reste.
    fireEvent.click(screen.getByRole("radio", { name: "De la pièce" }));
    expect((screen.getByLabelText(/Prix de vente de la pièce/) as HTMLInputElement).value).toBe(
      "1250",
    );
    expect(screen.queryByLabelText(/Prix de vente du paquet/)).toBeNull();
    ecrire(/Prix de vente de la pièce/, "1300");
    expect(screen.getByText(/Soit 15\s600.*le paquet/)).toBeTruthy();

    ecrire(/Stock initial \(pièces\)/, "30");
    expect(screen.getByText("2 paquets + 6 pièces")).toBeTruthy();

    fireEvent.submit(document.getElementById("product-add-form")!);
    await waitFor(() => expect(onEditProductDetails).toHaveBeenCalledTimes(1));
    expect(onAddProduct.mock.calls[0][0]).toMatchObject({
      designation: "Cahier",
      prixAchat: 1000,
      prixVenteDefaut: 1300,
      stockInitial: 30,
    });
    expect(onEditProductDetails.mock.calls[0][1]).toMatchObject({
      unite: "pièce",
      conditionnements: [
        expect.objectContaining({
          nom: "paquet",
          quantite: 12,
          prix_achat: 12000,
          prix_vente: null,
        }),
      ],
    });
  });
});

describe("modifier un produit au carton", () => {
  it("relit son carton comme l'unité choisie, et prévient si l'unité du stock change", () => {
    creer();
    fireEvent.click(screen.getByText("Eau 1,5 L"));
    fireEvent.click(screen.getByRole("button", { name: /Modifier/ }));
    expect(screen.getByRole("radio", { name: "Carton" }).getAttribute("aria-checked")).toBe("true");
    expect(
      (screen.getByLabelText(/Combien de bouteilles contient un carton/) as HTMLInputElement).value,
    ).toBe("12");
    expect(screen.queryByText(/n'est pas converti/)).toBeNull();
    // Vider le contenu : le carton se vendrait entier, et 30 bouteilles se liraient 30 cartons.
    ecrire(/Combien de bouteilles contient un carton/, "");
    expect(screen.getByText(/n'est pas converti/).textContent).toMatch(/30 cartons/);
  });
});
