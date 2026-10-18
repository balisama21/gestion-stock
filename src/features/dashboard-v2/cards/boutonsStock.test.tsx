import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteStock } from "./CarteStock";
import { CarteStockChiffres } from "./CarteStockChiffres";
import { PanneauDetail, type DonneesPanneau } from "../components/PanneauDetail";
import { chiffresStock, type SourcesChiffres } from "../lib/chiffres";
import { REGLAGES_PAR_DEFAUT } from "../../../lib/prealerteStock";
import type { Product } from "../../../types";

/**
 * CHAQUE BOUTON FAIT CE QU'IL DIT — le cas de l'enregistrement d'écran :
 * « Voir la liste » ouvrait le bon de commande, « Préparer la commande »
 * ouvrait une liste dont le pied menait aux Achats sans rien préparer,
 * et « Ruptures à venir » comptait des produits déjà à zéro.
 */
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

const stock = chiffresStock(
  {
    products: [produit("Valise", 0, 2), produit("Savon", 1, 3), produit("Carnet", 0, 0)],
    sales: [],
    purchases: [],
    mouvements: [],
  } as unknown as SourcesChiffres,
  { intervalle: { debut: "2026-10-01", fin: "2026-10-17" } } as never,
  "2026-10-17",
  REGLAGES_PAR_DEFAUT,
);

describe("les cartes du stock", () => {
  afterEach(cleanup);

  it("« Voir la liste » ouvre la liste, « Préparer la commande » le bon", () => {
    const voir = vi.fn();
    const commander = vi.fn();
    render(<CarteStock stock={stock} valeurVisible onVoirLaListe={voir} onCommander={commander} />);
    fireEvent.click(screen.getByRole("button", { name: /Voir la liste/ }));
    expect(voir).toHaveBeenCalledTimes(1);
    expect(commander).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Préparer la commande/ }));
    expect(commander).toHaveBeenCalledTimes(1);
  });

  it("à recommander et en rupture sont deux comptes distincts", () => {
    render(
      <CarteStockChiffres
        stock={stock}
        valeurVisible
        avecRuptures
        onVoirLaListe={vi.fn()}
        onVoirRuptures={vi.fn()}
      />,
    );
    // Valise et Savon ont un seuil ; Carnet n'en a pas.
    const recommander = screen.getByText("Produits à recommander").closest("article")!;
    expect(recommander.textContent).toContain("2");
    const rupture = screen.getByText("En rupture").closest("article")!;
    expect(rupture.textContent).toContain("2");
    expect(rupture.textContent).toContain("produits à zéro");
    expect(screen.queryByText("Ruptures à venir")).toBeNull();
  });
});

describe("le panneau « à recommander »", () => {
  afterEach(cleanup);

  const donnees = { stock } as unknown as DonneesPanneau;

  it("liste le bon de commande et son pied l'ouvre", () => {
    const bon = vi.fn();
    const naviguer = vi.fn();
    render(
      <PanneauDetail
        vue={{ cle: "recommander" }}
        donnees={donnees}
        onFermer={vi.fn()}
        onNaviguer={naviguer}
        onBonDeCommande={bon}
      />,
    );
    expect(screen.getByText("Valise")).toBeTruthy();
    expect(screen.getByText("Savon")).toBeTruthy();
    expect(screen.queryByText("Carnet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Préparer la commande" }));
    expect(bon).toHaveBeenCalledTimes(1);
    expect(naviguer).not.toHaveBeenCalled();
  });

  it("le panneau des ruptures nomme les produits sans seuil", () => {
    render(<PanneauDetail vue={{ cle: "ruptures" }} donnees={donnees} onFermer={vi.fn()} />);
    expect(screen.getByText("Carnet")).toBeTruthy();
    expect(screen.getByText("Sans seuil d'alerte")).toBeTruthy();
  });
});
