import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PanneauAide } from "./PanneauAide";
import { ficheAide } from "../../lib/aide";

describe("aide contextuelle", () => {
  afterEach(cleanup);

  it("affiche la fiche de l'écran courant", () => {
    render(<PanneauAide ouvert onFermer={() => {}} ecran="notes_frais" />);
    expect(screen.getByRole("heading", { name: "Notes de frais" })).toBeTruthy();
    expect(screen.getByText("Comment faire")).toBeTruthy();
  });

  it("un écran sans fiche retombe sur l'aide générale", () => {
    expect(ficheAide("ecran_inconnu").titre).toBe("Bienvenue");
  });

  it("une langue sans traduction retombe sur le français", () => {
    expect(ficheAide("ventes", "mg").titre).toBe("Ventes");
  });
});
