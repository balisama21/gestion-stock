import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SelecteurProduit, type ProduitAChoisir } from "./SelecteurProduit";

/**
 * LE SÉLECTEUR DE PRODUIT
 *
 * Le nom seul sur la ligne, la référence et le prix dessous, le stock en
 * pastille ; on retrouve un produit par son nom, sa référence ou son
 * code-barres.
 */
afterEach(cleanup);

const PRODUITS: ProduitAChoisir[] = [
  { id: "p1", nom: "Sac kraft 25 kg", numero: "P087", prix: 1800, stock: 40, seuil: 5 },
  { id: "p2", nom: "Film étirable", numero: "P088", prix: 12000, stock: 0, seuil: 5 },
  {
    id: "p3",
    nom: "Carton 40x30",
    numero: "P089",
    prix: 1300,
    stock: 3,
    seuil: 5,
    codes: ["3700123"],
  },
];

function afficher(valeur = "") {
  const onChange = vi.fn();
  render(
    <SelecteurProduit label="Produit" produits={PRODUITS} valeur={valeur} onChange={onChange} />,
  );
  fireEvent.click(screen.getByLabelText("Produit"));
  return onChange;
}

const option = (nom: RegExp) => screen.getByRole("option", { name: nom });

describe("SelecteurProduit", () => {
  it("dit le stock en pastille : en stock, bientôt épuisé, en rupture", () => {
    afficher();
    expect(within(option(/Sac kraft/)).getByText("40 en stock").className).toMatch(/success/);
    expect(within(option(/Carton/)).getByText("3 en stock").className).toMatch(/warning/);
    expect(within(option(/Film/)).getByText("Rupture").className).toMatch(/danger/);
  });

  it("met la référence et le prix sous le nom, pas dans le nom", () => {
    afficher();
    const ligne = option(/Sac kraft/);
    expect(within(ligne).getByText("Sac kraft 25 kg")).toBeTruthy();
    expect(within(ligne).getByText(/^P087 · /)).toBeTruthy();
  });

  it("retrouve un produit par sa référence ou son code-barres", () => {
    afficher();
    const recherche = screen.getByLabelText("Rechercher dans produit");
    fireEvent.change(recherche, { target: { value: "p088" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(option(/Film/)).toBeTruthy();
    fireEvent.change(recherche, { target: { value: "3700123" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(option(/Carton/)).toBeTruthy();
  });

  it("rend l'identifiant choisi, et le montre avec sa pastille", () => {
    const onChange = afficher();
    fireEvent.click(within(option(/Carton/)).getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("p3");
    cleanup();
    render(<SelecteurProduit label="Produit" produits={PRODUITS} valeur="p3" onChange={vi.fn()} />);
    const champ = screen.getByLabelText("Produit");
    expect(champ.textContent).toContain("Carton 40x30");
    expect(champ.textContent).toContain("3 en stock");
  });
});
