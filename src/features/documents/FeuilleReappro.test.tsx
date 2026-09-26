import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FeuilleReappro } from "./FeuilleReappro";
import { lignesDeReappro } from "../../lib/reapprovisionnement";
import { REGLAGES_PAR_DEFAUT } from "../../lib/prealerteStock";
import type { ProduitARecommander } from "../../lib/bonDeCommande";
import type { StoreSettings } from "../../types";

const REGLAGES = { ...REGLAGES_PAR_DEFAUT, reapproActive: true, prealerteActive: true, ecart: 5 };

const CATALOGUE: ProduitARecommander[] = [
  {
    id: "h",
    nom: "Huile 1 L",
    numero: "P001",
    stockActuel: 4,
    seuilAlerte: 10,
    niveauCible: 20,
    fournisseur: "Tiko Import",
  },
  { id: "s", nom: "Savon", stockActuel: 0, seuilAlerte: 5, fournisseur: "Grossiste Be" },
  { id: "r", nom: "Riz 5 kg", stockActuel: 2, seuilAlerte: 3 },
  { id: "p", nom: "Pâtes", stockActuel: 12, seuilAlerte: 10, fournisseur: "Tiko Import" },
  { id: "c", nom: "Ciment", stockActuel: 40, seuilAlerte: 10 },
];

const BOUTIQUE = { storeName: "Épicerie Tiko" } as unknown as StoreSettings;

function afficher(grouper: boolean) {
  render(
    <FeuilleReappro
      lignes={lignesDeReappro(CATALOGUE, REGLAGES)}
      grouper={grouper}
      montrerFournisseur
      date="2026-09-26"
      settings={BOUTIQUE}
      couleur="#0E7C5A"
    />,
  );
  return screen.findByRole("table");
}

afterEach(cleanup);

describe("la feuille A4", () => {
  it("liste exactement les produits sous leur seuil", async () => {
    const table = await afficher(false);
    const noms = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector(".rp-nom")?.textContent);
    expect(noms.sort()).toEqual(["Huile 1 L", "Riz 5 kg", "Savon"]);
    expect(screen.queryByText("Pâtes")).toBeNull();
    expect(screen.queryByText("Ciment")).toBeNull();
  });

  it("porte titre, boutique, date et une case à cocher par produit", async () => {
    const table = await afficher(false);
    expect(screen.getByText("Feuille de réapprovisionnement")).toBeTruthy();
    expect(screen.getByText("Épicerie Tiko")).toBeTruthy();
    expect(table.querySelectorAll("tbody .rp-case span")).toHaveLength(3);
  });

  it("stock, seuil, cible et quantité à commander sur la ligne", async () => {
    await afficher(false);
    const ligne = screen.getByText("Huile 1 L").closest("tr") as HTMLElement;
    const cellules = within(ligne)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cellules.slice(2, 6)).toEqual(["4", "10", "20", "16"]);
    expect(cellules).toContain("Tiko Import");
  });

  it("regroupée par fournisseur quand on le demande", async () => {
    const table = await afficher(true);
    const groupes = [...table.querySelectorAll("tbody tr.rp-groupe")].map((g) =>
      g.firstElementChild?.firstChild?.textContent?.trim(),
    );
    expect(groupes).toEqual(["Grossiste Be", "Tiko Import", "Sans fournisseur"]);
    expect(within(table).queryByRole("columnheader", { name: "Fournisseur" })).toBeNull();
  });
});
