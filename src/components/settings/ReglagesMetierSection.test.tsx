import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReglagesMetierSection } from "./ReglagesMetierSection";

const modifier = vi.fn(async () => ({ error: null }));

const devises = {
  catalogue: [
    {
      id: "d1",
      code: "MGA",
      nom: "Ariary malgache",
      symbole: "Ar",
      decimales: 0,
      store_id: null,
      region: "Afrique",
    },
    {
      id: "d2",
      code: "EUR",
      nom: "Euro",
      symbole: "€",
      decimales: 2,
      store_id: null,
      region: "Europe",
    },
    {
      id: "d3",
      code: "USD",
      nom: "Dollar américain",
      symbole: "$",
      decimales: 2,
      store_id: null,
      region: "Amérique du Nord",
    },
  ],
  devises: [
    {
      id: "b1",
      code: "MGA",
      principale: true,
      actif: true,
      taux: 1,
      mode_taux: "manuel",
      taux_source: "principale",
      taux_maj_le: "2026-09-26T08:00:00Z",
      derniere_erreur: null,
    },
    {
      id: "b2",
      code: "EUR",
      principale: false,
      actif: true,
      taux: 5013.3,
      mode_taux: "auto",
      taux_source: "auto",
      taux_maj_le: "2026-09-26T08:00:00Z",
      derniere_erreur: null,
    },
  ],
  historique: [],
  principale: "MGA",
  fichePrincipale: { symbole: "Ar", decimales: 0 },
  chargement: false,
  definirPrincipale: vi.fn(),
  ajouter: vi.fn(),
  modifier,
  retirer: vi.fn(),
  creerDevise: vi.fn(),
  supprimerDevise: vi.fn(),
  actualiser: vi.fn(async () => ({ error: null })),
} as unknown as React.ComponentProps<typeof ReglagesMetierSection>["devises"];

const afficher = (enregistrer = vi.fn(async () => ({ error: null as string | null }))) => {
  render(
    <ReglagesMetierSection
      devises={devises}
      parametres={{ commission_taux: 5 }}
      onSaveParametre={enregistrer}
    />,
  );
  return enregistrer;
};

describe("réglages métier", () => {
  afterEach(cleanup);

  it("enregistre un nouveau taux de commission", async () => {
    const enregistrer = afficher();
    const champ = screen.getByLabelText("Taux de commission") as HTMLInputElement;
    expect(champ.value).toBe("5");
    fireEvent.change(champ, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledWith("commission_taux", 10));
  });

  it("refuse un taux hors bornes sans rien écrire", () => {
    const enregistrer = afficher();
    fireEvent.change(screen.getByLabelText("Taux de commission"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(enregistrer).not.toHaveBeenCalled();
    expect(screen.getByText(/entre 0 et 100/)).toBeTruthy();
  });

  it("montre le taux d'une devise et bascule son mode", async () => {
    afficher();
    expect(screen.getByText(/1 EUR = 5.013,3 Ar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manuel" }));
    await waitFor(() => expect(modifier).toHaveBeenCalledWith("b2", { mode_taux: "manuel" }));
  });

  it("propose d'ajouter seulement les devises pas encore actives", () => {
    afficher();
    const choix = screen.getByLabelText("Devise à ajouter");
    expect(choix.textContent).toContain("USD");
    expect(choix.textContent).not.toContain("EUR —");
  });
});

describe("prix dans les autres devises", () => {
  afterEach(cleanup);

  it("choisir EUR pour l'écran enregistre la liste", async () => {
    const enregistrer = afficher();
    fireEvent.click(
      screen.getByRole("group", { name: "Devises affichées à l'écran" }).querySelector("button")!,
    );
    await waitFor(() => expect(enregistrer).toHaveBeenCalledWith("devises_affichees", ["EUR"]));
  });

  it("chaque type de document a son propre choix", async () => {
    const enregistrer = afficher();
    fireEvent.click(
      screen
        .getByRole("group", { name: "Devises imprimées sur : Facture proforma" })
        .querySelector("button")!,
    );
    await waitFor(() =>
      expect(enregistrer).toHaveBeenCalledWith("devises_documents", { proforma: ["EUR"] }),
    );
  });
});
