import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HistoriqueView } from "./HistoriqueView";
import type { Expense } from "../types";
import type { Database } from "../lib/database.types";

type Note = Database["public"]["Tables"]["notes_de_frais"]["Row"];

const depense = (id: string, date: string, montant: number) =>
  ({
    id,
    numero: id,
    date,
    type: "Loyer",
    note: null,
    vendeur: "Moi",
    montant,
  }) as unknown as Expense;

const noteEnAttente = {
  id: "n1",
  numero: "NDF001",
  date: "2026-09-10",
  beneficiaire: "Lanto",
  motif: "Taxi",
  montant_converti: 7000,
  statut: "a_valider",
  depense_id: null,
} as unknown as Note;

const afficher = () =>
  render(
    <HistoriqueView
      purchases={[]}
      sales={[]}
      expenses={[depense("DEP1", "2026-09-05", 20000), depense("DEP2", "2025-01-05", 3000)]}
      notesDeFrais={[noteEnAttente]}
      locale="FR"
      products={[]}
    />,
  );

describe("journal de compte", () => {
  afterEach(cleanup);

  it("une note non remboursée est affichée hors solde", () => {
    afficher();
    expect(screen.getByText(/Note de frais à valider : Taxi/)).toBeTruthy();
    expect(screen.getByText(/hors solde/)).toBeTruthy();
    expect(screen.getByText("Notes à rembourser")).toBeTruthy();
  });

  it("filtre par dates", () => {
    afficher();
    fireEvent.change(screen.getByLabelText("Du"), { target: { value: "2026-01-01" } });
    expect(screen.queryByText(/DEP2/)).toBeNull();
    expect(screen.getByText(/DEP1/)).toBeTruthy();
  });

  it("filtre par type", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Dépense" }));
    expect(screen.queryByText(/DEP1/)).toBeNull();
  });
});
