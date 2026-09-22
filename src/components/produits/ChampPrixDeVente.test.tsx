import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChampPrixDeVente } from "./ChampPrixDeVente";
import { PRIX_AUTO_DEFAUT, type ReglagesPrixAuto } from "../../lib/prixAuto";

/**
 * Les quatre promesses du champ : éteint il ne change rien, taper un
 * prix le passe en manuel, un prix d'achat qui bouge entraîne le prix
 * de vente, et vendre à perte se voit.
 */

const ACTIF: ReglagesPrixAuto = { actif: true, taux: 20, tauxRapides: [10, 20], arrondi: 0 };

const champ = (extra: Partial<React.ComponentProps<typeof ChampPrixDeVente>> = {}) => {
  const props = {
    prixAchat: 1000,
    prixVente: 1200,
    onPrixVente: vi.fn(),
    mode: "auto",
    onMode: vi.fn(),
    tauxProduit: null,
    onTauxProduit: vi.fn(),
    tauxCategorie: null,
    reglages: ACTIF,
    ...extra,
  };
  const rendu = render(<ChampPrixDeVente {...props} />);
  return { ...props, rendu };
};

afterEach(cleanup);

describe("quand la fonction est éteinte", () => {
  it("n'affiche ni taux ni mode : c'est un nombre à taper, comme avant", () => {
    champ({ reglages: PRIX_AUTO_DEFAUT });
    expect(screen.queryByText(/Calculé/)).toBeNull();
    expect(screen.queryByText("+10 %")).toBeNull();
    expect(screen.queryByText(/Revenir au calcul/)).toBeNull();
  });

  it("ne fait pas basculer le produit en manuel quand on tape", () => {
    const { onMode } = champ({ reglages: PRIX_AUTO_DEFAUT });
    fireEvent.change(screen.getByLabelText(/Prix de vente/), { target: { value: "1500" } });
    expect(onMode).not.toHaveBeenCalled();
  });
});

describe("quand elle est active", () => {
  it("dit d'où vient le prix calculé", () => {
    champ();
    expect(screen.getByText(/taux de la boutique/)).toBeTruthy();
  });

  it("passe en manuel dès qu'on tape un prix", () => {
    const { onMode, onPrixVente } = champ();
    fireEvent.change(screen.getByLabelText(/Prix de vente/), { target: { value: "1500" } });
    expect(onPrixVente).toHaveBeenCalledWith(1500);
    expect(onMode).toHaveBeenCalledWith("manuel");
  });

  it("applique un taux rapide et repasse en automatique", () => {
    const { onMode, onPrixVente } = champ({ mode: "manuel" });
    fireEvent.click(screen.getByText("+10 %"));
    expect(onMode).toHaveBeenCalledWith("auto");
    expect(onPrixVente).toHaveBeenCalledWith(1100);
  });

  it("propose de revenir au calcul quand le prix est fixé à la main", () => {
    const { onPrixVente } = champ({ mode: "manuel" });
    fireEvent.click(screen.getByText(/Revenir au calcul/));
    expect(onPrixVente).toHaveBeenCalledWith(1200);
  });

  it("suit le prix d'achat en automatique, et seulement en automatique", () => {
    const onPrixVente = vi.fn();
    const props = {
      prixAchat: 1000,
      prixVente: 1200,
      onPrixVente,
      mode: "auto",
      onMode: vi.fn(),
      tauxProduit: null,
      onTauxProduit: vi.fn(),
      tauxCategorie: null,
      reglages: ACTIF,
    };
    const { rerender } = render(<ChampPrixDeVente {...props} />);
    expect(onPrixVente).not.toHaveBeenCalled();
    rerender(<ChampPrixDeVente {...props} prixAchat={2000} />);
    expect(onPrixVente).toHaveBeenCalledWith(2400);
  });

  it("ne recalcule jamais un produit passé en manuel", () => {
    const onPrixVente = vi.fn();
    const props = {
      prixAchat: 1000,
      prixVente: 1200,
      onPrixVente,
      mode: "manuel",
      onMode: vi.fn(),
      tauxProduit: null,
      onTauxProduit: vi.fn(),
      tauxCategorie: null,
      reglages: ACTIF,
    };
    const { rerender } = render(<ChampPrixDeVente {...props} />);
    rerender(<ChampPrixDeVente {...props} prixAchat={2000} />);
    expect(onPrixVente).not.toHaveBeenCalled();
  });

  it("suit l'héritage : le taux de la catégorie l'emporte sur celui de la boutique", () => {
    champ({ tauxCategorie: 5 });
    expect(screen.getByText(/taux de la catégorie/)).toBeTruthy();
  });
});

describe("ce que la marge montre", () => {
  it("l'affiche en Ariary et en pourcentage du prix d'achat", () => {
    champ({ prixAchat: 1000, prixVente: 1200 });
    expect(screen.getByText(/Marge/).textContent).toContain("+20 %");
  });

  it("alerte quand on vendrait à perte", () => {
    champ({ prixAchat: 1000, prixVente: 900 });
    expect(screen.getByRole("alert").textContent).toContain("à perte");
  });

  it("ne dit rien quand le prix d'achat est inconnu", () => {
    champ({ prixAchat: 0, prixVente: 900 });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Marge/)).toBeNull();
  });
});
