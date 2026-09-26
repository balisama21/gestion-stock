import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CachetsSection } from "./CachetsSection";
import type { Cachet } from "../../features/documents/lib/cachets";

vi.mock("../../features/documents/lib/traiterCachet", () => ({
  useImageCachet: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cachet: Cachet = {
  id: "a1",
  nom: "Cachet officiel",
  chemin: "43fc454f-ae66-48cd-af23-a46c0857a527/a1.png",
  largeur: 1200,
  hauteur: 1180,
  opacite: 1,
  creeLe: "",
};

describe("la liste des cachets", () => {
  it("se renomme et se retire de la liste", () => {
    const onChange = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CachetsSection cachets={[cachet]} storeId="x" onChange={onChange} onEnregistrer={vi.fn()} />,
    );
    expect(screen.getByText(/net jusqu'à 102 mm/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nom du cachet"), { target: { value: "Tampon" } });
    expect(onChange.mock.calls[0][0][0].nom).toBe("Tampon");
    fireEvent.click(screen.getByRole("button", { name: "Retirer Cachet officiel" }));
    expect(onChange.mock.calls[1][0]).toEqual([]);
  });

  it("ne propose pas l'ajout sans boutique active", () => {
    render(<CachetsSection cachets={[]} onChange={vi.fn()} onEnregistrer={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: /Ajouter un cachet/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
