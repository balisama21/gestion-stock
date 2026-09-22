import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListesSection } from "./ListesSection";
import type { ValeurDeListe } from "../../lib/listes";

/**
 * L'écran de gestion des listes. Ce qui est vérifié : on n'y supprime
 * rien, renommer ne crée pas de doublon, chaque liste ne montre que
 * les siennes, et le réglage « qui peut ajouter » s'enregistre sans
 * écraser les réglages voisins de la même colonne JSON.
 */

const valeur = (p: Partial<ValeurDeListe> & { id: string; nom: string }): ValeurDeListe =>
  ({
    actif: true,
    created_at: "",
    created_by: null,
    ordre: 0,
    parent_id: null,
    store_id: "b",
    taux_marge: null,
    updated_at: "",
    usage: "produit",
    ...p,
  }) as ValeurDeListe;

const VALEURS = [
  valeur({ id: "1", nom: "Alimentation", ordre: 10 }),
  valeur({ id: "2", nom: "Emballages", ordre: 20 }),
  valeur({ id: "3", nom: "Ancienne famille", ordre: 30, actif: false }),
  valeur({ id: "4", nom: "Loyer", usage: "depense" }),
  valeur({ id: "5", nom: "Grossiste", usage: "type_fournisseur" }),
];

const monter = (extra: Partial<React.ComponentProps<typeof ListesSection>> = {}) => {
  const props = {
    valeurs: VALEURS,
    compteParValeur: { "1": 7, "3": 2 },
    onAdd: vi.fn(async () => ({ categorie: null, error: null })),
    onUpdate: vi.fn(async () => ({ error: null })),
    personnalisation: {},
    onSavePersonnalisation: vi.fn(),
    ...extra,
  };
  render(<ListesSection {...props} />);
  return props;
};

afterEach(cleanup);

describe("chaque liste ne montre que les siennes", () => {
  /** « Alimentation » figure aussi dans le menu « Rangée sous ». */
  const dansLaListe = (nom: string) => screen.queryByRole("button", { name: `Renommer ${nom}` });

  it("ouvre sur les catégories de produits", () => {
    monter();
    expect(dansLaListe("Alimentation")).toBeTruthy();
    expect(dansLaListe("Loyer")).toBeNull();
    expect(dansLaListe("Grossiste")).toBeNull();
  });

  it("bascule sur les postes de dépenses", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Postes de dépenses" }));
    expect(dansLaListe("Loyer")).toBeTruthy();
    expect(dansLaListe("Alimentation")).toBeNull();
  });
});

describe("on archive, on ne supprime pas", () => {
  it("n'offre aucun bouton de suppression", () => {
    monter();
    expect(screen.queryByRole("button", { name: /Supprimer/ })).toBeNull();
  });

  it("archive en écrivant `actif: false`", async () => {
    const { onUpdate } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Archiver Alimentation" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("1", { actif: false }));
  });

  it("dit combien d'enregistrements portent encore une valeur archivée", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: /1 valeur archivée/ }));
    expect(screen.getByText(/Toujours lisible sur 2 enregistrements/)).toBeTruthy();
  });

  it("remet une archivée en service", async () => {
    const { onUpdate } = monter();
    fireEvent.click(screen.getByRole("button", { name: /1 valeur archivée/ }));
    fireEvent.click(screen.getByRole("button", { name: /Remettre Ancienne famille/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("3", { actif: true }));
  });
});

describe("l'anti-doublon de l'écran", () => {
  it("refuse d'ajouter une valeur qui existe sous une autre graphie", () => {
    const { onAdd } = monter();
    fireEvent.change(screen.getByLabelText("Nouvelle valeur"), {
      target: { value: "  ALIMENTATION " },
    });
    expect(screen.getByText(/existe déjà/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Ajouter/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("laisse passer une valeur nouvelle, posée en fin de liste", async () => {
    const { onAdd } = monter();
    fireEvent.change(screen.getByLabelText("Nouvelle valeur"), { target: { value: "Doypacks" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        nom: "Doypacks",
        parent_id: null,
        usage: "produit",
        ordre: 40,
      }),
    );
  });
});

describe("le renommage", () => {
  it("écrit le nouveau nom sur l'identifiant existant", async () => {
    const { onUpdate } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Renommer Alimentation" }));
    fireEvent.change(screen.getByLabelText(/^Renommer « Alimentation »/), {
      target: { value: "Alimentaire" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Enregistrer/ })[0]);
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith("1", { nom: "Alimentaire", taux_marge: null }),
    );
  });

  it("refuse un nom déjà pris par une autre valeur de la même liste", async () => {
    const { onUpdate } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Renommer Alimentation" }));
    fireEvent.change(screen.getByLabelText(/^Renommer « Alimentation »/), {
      target: { value: "emballages" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Enregistrer/ })[0]);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("porte déjà"));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("le réordonnancement", () => {
  it("échange les rangs avec le voisin", async () => {
    const { onUpdate } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Descendre Alimentation" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("1", { ordre: 20 }));
    expect(onUpdate).toHaveBeenCalledWith("2", { ordre: 10 });
  });
});

describe("les réglages voisins ne sont jamais écrasés", () => {
  it("recopie le reste de la colonne JSON en changeant « qui peut ajouter »", async () => {
    const onSavePersonnalisation = vi.fn();
    monter({
      personnalisation: { rappels: { veilleHeure: 18 }, modules: { ventes: { masque: true } } },
      onSavePersonnalisation,
    });
    fireEvent.click(screen.getByLabelText(/Administrateurs et managers/));
    await waitFor(() => expect(onSavePersonnalisation).toHaveBeenCalled());
    const ecrit = onSavePersonnalisation.mock.calls[0][0];
    expect(ecrit.listes).toEqual({ ajoutDepuisFormulaire: "responsables" });
    expect(ecrit.rappels).toEqual({ veilleHeure: 18 });
    expect(ecrit.modules).toEqual({ ventes: { masque: true } });
  });

  it("n'enregistre pas un libellé « Effectué par » égal au défaut", async () => {
    const onSavePersonnalisation = vi.fn();
    monter({
      personnalisation: { libelles: { effectuePar: "Exécutant" } },
      onSavePersonnalisation,
    });
    const champ = screen.getByPlaceholderText("Effectué par");
    fireEvent.change(champ, { target: { value: "Effectué par" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Enregistrer/ })[0]);
    await waitFor(() => expect(onSavePersonnalisation).toHaveBeenCalled());
    expect(onSavePersonnalisation.mock.calls[0][0].libelles).toEqual({});
  });
});
