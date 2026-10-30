import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
