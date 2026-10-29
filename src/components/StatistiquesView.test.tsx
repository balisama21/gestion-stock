import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatistiquesView } from "./StatistiquesView";
import type { Seller } from "../types";

/**
 * Un classement suppose des concurrents : seul, le responsable n'est
 * pas « premier sur un ». Avec une équipe, il y figure, marqué comme tel.
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
  totalVentesNombre: 2,
});
const HANTA = vendeur({
  nom: "Hanta",
  nature: "membre",
  role: "vendeur",
  totalVentesMontant: 15_000,
  totalVentesNombre: 3,
});

const afficher = (sellers: Seller[]) =>
  render(<StatistiquesView sales={[]} products={[]} sellers={sellers} expenses={[]} locale="FR" />);

describe("le classement des vendeurs", () => {
  it("seul, ne classe personne et dit quand il parlera", () => {
    afficher([MAMY]);
    expect(screen.getByText("Pas encore d'équipe")).toBeTruthy();
    expect(screen.queryByText("Mamy")).toBeNull();
  });

  it("avec une équipe, classe chacun avec son rôle", () => {
    afficher([MAMY, HANTA]);
    expect(screen.getByText("Mamy")).toBeTruthy();
    expect(screen.getByText("Responsable")).toBeTruthy();
    expect(screen.getByText("Hanta")).toBeTruthy();
    expect(screen.getByText("Vendeur")).toBeTruthy();
  });
});
