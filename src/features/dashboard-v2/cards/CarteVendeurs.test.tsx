import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteVendeurs } from "./CarteVendeurs";
import type { Seller } from "../../../types";

/**
 * Le classement ne montre que l'équipe : seul, le responsable n'y est
 * pas classé, et la carte invite à former une équipe.
 */
afterEach(cleanup);

const vendeur = (p: Partial<Seller>): Seller => ({
  id: p.nom ?? "x",
  nom: "x",
  statut: "Actif",
  totalVentesMontant: 0,
  totalVentesNombre: 0,
  totalDepenses: 0,
  totalRemis: 0,
  totalAvancesSurCaisse: 0,
  soldeNetEnPoche: 0,
  ...p,
});

const MAMY = vendeur({
  nom: "Mamy",
  nature: "responsable",
  totalVentesMontant: 28_800,
  soldeNetEnPoche: 27_800,
});
const HANTA = vendeur({
  nom: "Hanta",
  nature: "membre",
  role: "vendeur",
  totalVentesMontant: 15_000,
  soldeNetEnPoche: 12_000,
});

describe("CarteVendeurs", () => {
  it("seul, le responsable n'est pas classé : la carte invite à former une équipe", () => {
    const onGerer = vi.fn();
    render(<CarteVendeurs vendeurs={[MAMY]} montantsVisibles onGerer={onGerer} />);
    expect(screen.queryByText("Mamy")).toBeNull();
    expect(screen.getByText("Pas encore d'équipe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inviter un vendeur" }));
    expect(onGerer).toHaveBeenCalled();
  });

  it("avec une équipe, ne classe que les collaborateurs", () => {
    render(<CarteVendeurs vendeurs={[MAMY, HANTA]} montantsVisibles />);
    expect(screen.getByText("Hanta")).toBeTruthy();
    expect(screen.queryByText("Mamy")).toBeNull();
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
