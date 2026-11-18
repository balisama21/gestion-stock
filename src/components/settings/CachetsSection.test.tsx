import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  role: "cachet",
};

const signature: Cachet = {
  ...cachet,
  id: "s1",
  nom: "Signature du gérant",
  chemin: "43fc454f-ae66-48cd-af23-a46c0857a527/s1.png",
  role: "signature",
};

describe("le cachet et la signature", () => {
  it("ont chacun leur emplacement", () => {
    render(
      <CachetsSection cachets={[cachet]} storeId="x" onChange={vi.fn()} onEnregistrer={vi.fn()} />,
    );
    expect(screen.getByText("Cachet de l'entreprise")).toBeTruthy();
    expect(screen.getByText(/jusqu'à 102 mm/)).toBeTruthy();
    // Le cachet est là : la signature, elle, attend encore la sienne.
    expect(screen.getByRole("button", { name: "Ajouter la signature" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter le cachet" })).toBeNull();
  });

  it("se retirent un à un, après confirmation", async () => {
    const onChange = vi.fn();
    render(
      <CachetsSection
        cachets={[cachet, signature]}
        storeId="x"
        onChange={onChange}
        onEnregistrer={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirer signature" }));
    const confirmation = await screen.findByRole("dialog", { name: "Confirmation" });
    expect(
      within(confirmation).getByText(
        "Retirer « Signature du gérant » ? Les documents déjà émis le gardent.",
      ),
    ).toBeTruthy();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Retirer" }));
    await waitFor(() => expect(onChange.mock.calls[0][0]).toEqual([cachet]));
  });

  it("passent d'une case à l'autre quand l'image a été mal rangée", () => {
    const onChange = vi.fn();
    render(
      <CachetsSection cachets={[cachet]} storeId="x" onChange={onChange} onEnregistrer={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /La ranger en signature/ }));
    expect(onChange.mock.calls[0][0]).toEqual([{ ...cachet, role: "signature" }]);
  });

  it("rangent les images en trop à part, renommables", () => {
    const onChange = vi.fn();
    const second = { ...cachet, id: "a2", nom: "Ancien tampon" };
    render(
      <CachetsSection
        cachets={[cachet, second]}
        storeId="x"
        onChange={onChange}
        onEnregistrer={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nom de l'image"), { target: { value: "Tampon 2" } });
    expect(onChange.mock.calls[0][0][1].nom).toBe("Tampon 2");
  });

  it("ne proposent pas l'ajout sans boutique active", () => {
    render(<CachetsSection cachets={[]} onChange={vi.fn()} onEnregistrer={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "Ajouter le cachet" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Ajouter la signature" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
