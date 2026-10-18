import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataList, type DataListItem } from "./DataList";

const ligne = (id: string, reste: string): DataListItem => ({
  id,
  primary: `Vente ${id}`,
  details: [{ label: "Reste à payer", value: reste }],
});

describe("la fiche ouverte suit la liste", () => {
  afterEach(cleanup);

  it("se met à jour quand la ligne change (un règlement, une modification)", () => {
    const { rerender } = render(<DataList items={[ligne("V002", "3 000 Ar")]} />);
    fireEvent.click(screen.getByText("Vente V002"));
    expect(screen.getByText("3 000 Ar")).toBeTruthy();

    rerender(<DataList items={[ligne("V002", "2 000 Ar")]} />);
    expect(screen.getByText("2 000 Ar")).toBeTruthy();
    expect(screen.queryByText("3 000 Ar")).toBeNull();
  });

  it("se ferme quand la ligne disparaît (une suppression)", () => {
    const { rerender } = render(
      <DataList items={[ligne("V001", "0 Ar"), ligne("V003", "1 500 Ar")]} />,
    );
    fireEvent.click(screen.getByText("Vente V003"));
    expect(screen.getByText("1 500 Ar")).toBeTruthy();

    rerender(<DataList items={[ligne("V001", "0 Ar")]} />);
    expect(screen.queryByText("1 500 Ar")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("une fiche visée hors de la liste filtrée reste ouverte", () => {
    render(<DataList items={[]} ouvrir={{ cle: 1, item: ligne("V009", "500 Ar") }} />);
    expect(screen.getByText("500 Ar")).toBeTruthy();
  });

  it("une fiche introuvable le dit", () => {
    render(<DataList items={[]} ouvrir={{ cle: 1, item: null }} />);
    expect(screen.getByText("Introuvable")).toBeTruthy();
  });
});
