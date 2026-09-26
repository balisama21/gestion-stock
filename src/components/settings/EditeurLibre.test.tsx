import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditeurLibre } from "./EditeurLibre";
import {
  blocsResolus,
  creerDisposition,
  type Disposition,
} from "../../features/documents/lib/disposition";

afterEach(cleanup);

function ouvrir() {
  const disposition = creerDisposition("facture", "classique", "Essai");
  const onEnregistrer = vi.fn();
  const onFermer = vi.fn();
  render(
    <EditeurLibre
      disposition={disposition}
      document={null}
      couleur="#0E7C5A"
      enCours={false}
      onEnregistrer={onEnregistrer}
      onFermer={onFermer}
    />,
  );
  const enregistre = () => onEnregistrer.mock.calls.at(-1)?.[0] as Disposition;
  return { disposition, enregistre, onFermer };
}

describe("l'éditeur libre", () => {
  it("déplace le bloc choisi au clavier, au millimètre", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    const logo = blocsResolus(enregistre()).logo;
    expect(logo.x).toBe(16);
    expect(logo.y).toBe(19);
  });

  it("n'offre pas de masquer une mention obligatoire", () => {
    ouvrir();
    expect(screen.queryByRole("button", { name: /Masquer Totaux/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Masquer Numéro et date/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Masquer Logo/ })).toBeTruthy();
  });

  it("masque un bloc facultatif et le retire de la feuille", () => {
    const { enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: /Masquer Mot de fin/ }));
    expect(document.querySelector('[data-cadre="motDeFin"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre()).motDeFin.masque).toBe(true);
  });

  it("revient au modèle d'origine", () => {
    const { disposition, enregistre } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Revenir au modèle d'origine/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(blocsResolus(enregistre())).toEqual(blocsResolus(disposition));
  });

  it("rend la disposition modifiée en revenant aux réglages", () => {
    const { onFermer } = ouvrir();
    fireEvent.change(screen.getByLabelText("Nom de la disposition"), {
      target: { value: "Factures pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux réglages" }));
    expect(onFermer.mock.calls[0][0].nom).toBe("Factures pro");
  });
});
