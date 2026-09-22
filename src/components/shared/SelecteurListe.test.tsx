import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelecteurListe } from "./SelecteurListe";

/**
 * Le sélecteur est la pièce que tous les écrans partagent : catégories,
 * postes, types, fournisseurs, personnes. Ce qui est vérifié ici, ce
 * sont les promesses faites au commerçant — chercher sans accent,
 * ne jamais se voir proposer un doublon, et pouvoir tout faire au
 * clavier.
 */

const OPTIONS = [
  { id: "1", nom: "Électricité et eau" },
  { id: "2", nom: "Grossiste" },
  { id: "3", nom: "Transport" },
];

const ouvrir = (label = "Poste") => {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
  return screen.getByRole("textbox");
};

afterEach(cleanup);

describe("la recherche", () => {
  it("trouve sans accent ni majuscule", () => {
    render(<SelecteurListe label="Poste" options={OPTIONS} valeur={null} onChange={vi.fn()} />);
    fireEvent.change(ouvrir(), { target: { value: "ELECTRI" } });
    expect(screen.getByText("Électricité et eau")).toBeTruthy();
    expect(screen.queryByText("Transport")).toBeNull();
  });

  it("montre tout tant qu'on n'a rien tapé", () => {
    render(<SelecteurListe label="Poste" options={OPTIONS} valeur={null} onChange={vi.fn()} />);
    ouvrir();
    expect(screen.getByText("Transport")).toBeTruthy();
    expect(screen.getByText("Grossiste")).toBeTruthy();
  });
});

describe("l'anti-doublon", () => {
  it("ne propose pas d'ajouter une valeur qui existe sous une autre graphie", () => {
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={vi.fn()}
        onCreer={vi.fn()}
      />,
    );
    fireEvent.change(ouvrir(), { target: { value: "  grossiste " } });
    expect(screen.queryByText(/Ajouter/)).toBeNull();
    expect(screen.getByText("Grossiste")).toBeTruthy();
  });

  it("le dit, quand la graphie diffère", () => {
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={vi.fn()}
        onCreer={vi.fn()}
      />,
    );
    fireEvent.change(ouvrir(), { target: { value: "GROSSISTE" } });
    expect(screen.getByText(/existe déjà/)).toBeTruthy();
  });

  it("propose bien d'ajouter une valeur réellement nouvelle", () => {
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={vi.fn()}
        onCreer={vi.fn()}
      />,
    );
    fireEvent.change(ouvrir(), { target: { value: "Carburant" } });
    expect(screen.getByText(/Ajouter .*Carburant/)).toBeTruthy();
  });

  it("ne propose rien à ajouter quand l'écran n'en a pas le droit", () => {
    render(<SelecteurListe label="Poste" options={OPTIONS} valeur={null} onChange={vi.fn()} />);
    fireEvent.change(ouvrir(), { target: { value: "Carburant" } });
    expect(screen.queryByText(/Ajouter/)).toBeNull();
  });
});

describe("la création depuis le formulaire", () => {
  it("crée puis sélectionne, sans refermer sur du vide", async () => {
    const onCreer = vi.fn(async () => ({ id: "9", error: null }));
    const onChange = vi.fn();
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={onChange}
        onCreer={onCreer}
      />,
    );
    fireEvent.change(ouvrir(), { target: { value: "Carburant" } });
    fireEvent.click(screen.getByText(/Ajouter .*Carburant/));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("9"));
    expect(onCreer).toHaveBeenCalledWith("Carburant");
  });

  it("montre le refus de la base au lieu de fermer en silence", async () => {
    const onCreer = vi.fn(async () => ({ id: null, error: "Boutique verrouillée." }));
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={vi.fn()}
        onCreer={onCreer}
      />,
    );
    fireEvent.change(ouvrir(), { target: { value: "Carburant" } });
    fireEvent.click(screen.getByText(/Ajouter .*Carburant/));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("verrouillée"));
  });

  it("laisse l'écran ouvrir son propre formulaire quand une fiche demande plus qu'un nom", () => {
    const onDemanderCreation = vi.fn();
    render(
      <SelecteurListe
        label="Personne"
        options={OPTIONS}
        valeur={null}
        onChange={vi.fn()}
        onDemanderCreation={onDemanderCreation}
      />,
    );
    fireEvent.change(ouvrir("Personne"), { target: { value: "Rakoto" } });
    fireEvent.click(screen.getByText(/Ajouter .*Rakoto/));
    expect(onDemanderCreation).toHaveBeenCalledWith("Rakoto");
  });
});

describe("au clavier", () => {
  it("descend aux flèches et choisit à Entrée", () => {
    const onChange = vi.fn();
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur={null}
        onChange={onChange}
        libelleVide="Non classée"
      />,
    );
    const recherche = ouvrir();
    // Ligne 0 = « Non classée », ligne 1 = la première option.
    fireEvent.keyDown(recherche, { key: "ArrowDown" });
    fireEvent.keyDown(recherche, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("choisit le vide quand on valide la première ligne", () => {
    const onChange = vi.fn();
    render(
      <SelecteurListe
        label="Poste"
        options={OPTIONS}
        valeur="2"
        onChange={onChange}
        libelleVide="Non classée"
      />,
    );
    fireEvent.keyDown(ouvrir(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("referme à Échap sans rien changer", () => {
    const onChange = vi.fn();
    render(<SelecteurListe label="Poste" options={OPTIONS} valeur={null} onChange={onChange} />);
    fireEvent.keyDown(ouvrir(), { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ne descend pas plus bas que la dernière ligne", () => {
    const onChange = vi.fn();
    render(<SelecteurListe label="Poste" options={OPTIONS} valeur={null} onChange={onChange} />);
    const recherche = ouvrir();
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(recherche, { key: "ArrowDown" });
    fireEvent.keyDown(recherche, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("3");
  });
});

describe("une valeur archivée que l'enregistrement porte encore", () => {
  it("reste choisie et se signale", () => {
    render(
      <SelecteurListe
        label="Poste"
        options={[...OPTIONS, { id: "4", nom: "Ancien poste", archive: true }]}
        valeur="4"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/est archivée/)).toBeTruthy();
  });
});
