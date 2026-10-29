import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DataList, type DataListItem } from "./DataList";

/**
 * LA LISTE DEVIENT UN TABLEAU SUR PC
 *
 * Sur grand écran, chaque information a sa colonne ; sur téléphone, la
 * liste ne change pas. Le clic sur la ligne ouvre la même fiche.
 */

let large = true;
beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: large && q.includes("min-width"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  large = true;
});

const ITEMS: DataListItem[] = [
  {
    id: "v1",
    primary: "Ciment",
    sousTitre: "3 sacs",
    meta: ["3 sacs", "22/09/2026", "Tsiry"],
    amount: "90 000 Ar",
    cellules: { date: "22/09/2026", client: "Tsiry", total: "90 000 Ar" },
    details: [{ label: "Référence", value: "V001" }],
  },
  {
    id: "v2",
    primary: "Tôle",
    cellules: { date: "23/09/2026", total: "12 000 Ar" },
    details: [{ label: "Référence", value: "V002" }],
  },
];

const COLONNES = [
  { cle: "date", titre: "Date" },
  { cle: "client", titre: "Client" },
  { cle: "total", titre: "Total", align: "droite" as const },
];

describe("DataList en tableau", () => {
  it("sur PC, pose une colonne par information, et « — » quand elle manque", () => {
    render(<DataList items={ITEMS} colonnes={COLONNES} titrePrincipal="Produit" />);
    const table = screen.getByRole("table");
    const entetes = within(table)
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    // La colonne du chevron est cachée aux lecteurs d'écran.
    expect(entetes).toEqual(["Produit", "Date", "Client", "Total"]);
    const lignes = within(table).getAllByRole("row").slice(1);
    expect(within(lignes[0]).getByText("Tsiry")).toBeTruthy();
    expect(within(lignes[0]).getByText("3 sacs")).toBeTruthy();
    expect(within(lignes[1]).getByText("—")).toBeTruthy();
  });

  it("le clic sur la ligne ouvre la fiche, comme en liste", () => {
    render(<DataList items={ITEMS} colonnes={COLONNES} />);
    fireEvent.click(screen.getByText("12 000 Ar"));
    expect(screen.getByRole("dialog", { name: "Tôle" })).toBeTruthy();
  });

  it("le nom reste un bouton, atteignable au clavier", () => {
    render(<DataList items={ITEMS} colonnes={COLONNES} />);
    fireEvent.click(screen.getByRole("button", { name: "Ciment" }));
    expect(screen.getByRole("dialog", { name: "Ciment" })).toBeTruthy();
  });

  it("sur téléphone, la liste ne change pas", () => {
    large = false;
    render(<DataList items={ITEMS} colonnes={COLONNES} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("3 sacs · 22/09/2026 · Tsiry")).toBeTruthy();
  });

  it("sans colonnes, la liste reste une liste même sur PC", () => {
    render(<DataList items={ITEMS} />);
    expect(screen.queryByRole("table")).toBeNull();
  });
});
