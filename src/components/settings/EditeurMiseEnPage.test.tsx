import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditeurMiseEnPage } from "./EditeurMiseEnPage";
import {
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ReglagesDocuments,
} from "../../features/documents/lib/reglages";
import type { MisesEnPage } from "../../features/documents/lib/miseEnPage";

/**
 * L'ÉDITEUR DE MISE EN PAGE.
 *
 * Ce qu'il doit tenir : ne rien écrire tant qu'on ne l'a pas ouvert,
 * refuser de masquer une mention obligatoire, et tout retirer d'un
 * clic sans emporter la mise en page des autres documents.
 */

function afficher(reglages: ReglagesDocuments = REGLAGES_DOCUMENTS_PAR_DEFAUT) {
  const onChange = vi.fn();
  render(<EditeurMiseEnPage reglages={reglages} type="facture" onChange={onChange} />);
  return onChange;
}

const dernier = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)?.[0] as MisesEnPage;

const OUVERT: ReglagesDocuments = { ...REGLAGES_DOCUMENTS_PAR_DEFAUT, pages: { facture: {} } };

afterEach(cleanup);

describe("tant qu'on ne l'a pas ouvert", () => {
  it("ne montre aucun élément", () => {
    afficher();
    expect(screen.queryByLabelText(/Afficher Adresse — En-tête/)).toBeNull();
    expect(screen.getByRole("button", { name: /Personnaliser la mise en page/ })).toBeTruthy();
  });

  it("s'ouvre sans rien masquer ni renommer", () => {
    const onChange = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Personnaliser la mise en page/ }));
    expect(dernier(onChange)).toEqual({ facture: {} });
  });
});

describe("une fois ouvert", () => {
  it("masque un élément", () => {
    const onChange = afficher(OUVERT);
    fireEvent.click(screen.getByLabelText("Afficher Adresse — En-tête"));
    expect(dernier(onChange).facture).toEqual({ "entete.adresse": { visible: false } });
  });

  it("pose un cadenas sur une mention obligatoire, et refuse de l'éteindre", () => {
    afficher(OUVERT);
    const verrou = screen.getByLabelText(
      "Afficher Numéro — Informations du document",
    ) as HTMLButtonElement;
    expect(verrou.disabled).toBe(true);
    expect(screen.getAllByLabelText("Obligatoire").length).toBeGreaterThan(0);
  });

  it("descend un élément en écrivant le rang de toute la zone", () => {
    const onChange = afficher(OUVERT);
    fireEvent.click(screen.getByLabelText("Descendre Numéro — Informations du document"));
    const zone = dernier(onChange).facture!;
    expect(zone["infos.numero"]?.ordre).toBe(1);
    expect(zone["infos.date"]?.ordre).toBe(0);
    // Et aucune autre zone n'a été touchée au passage.
    expect(zone["entete.adresse"]).toBeUndefined();
  });

  it("retire tout d'un clic, sans toucher aux autres documents", () => {
    const onChange = afficher({
      ...OUVERT,
      pages: { facture: { "entete.adresse": { visible: false } }, devis: {} },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revenir au modèle par défaut/ }));
    expect(dernier(onChange)).toEqual({ devis: {} });
  });

  it("applique un préréglage", () => {
    const onChange = afficher(OUVERT);
    fireEvent.click(screen.getByRole("button", { name: /^Minimal$/ }));
    expect(dernier(onChange).facture?.["bas.conditions"]).toEqual({ visible: false });
  });
});
