import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelecteurListe } from "./SelecteurListe";
import { SelecteurPersonne } from "./SelecteurPersonne";
import { SelecteurFournisseur } from "./SelecteurFournisseur";
import { Modal } from "./Modal";

/**
 * L'AJOUT RAPIDE, VU DU FORMULAIRE QUI LE CONTIENT.
 *
 * Chaque sélecteur sait créer une valeur sans quitter la fiche en
 * cours : une catégorie au milieu d'un produit, un fournisseur au milieu
 * d'un achat, une personne au milieu d'une vente. Ce qui est vérifié
 * ici, c'est que la fiche parente survit à l'ajout — elle ne s'envoie
 * pas, ne se referme pas — et que la valeur créée est aussitôt choisie,
 * une seule fois, même au double clic.
 */

afterEach(cleanup);

const ouvrirEtTaper = (label: RegExp, texte: string) => {
  fireEvent.click(screen.getByRole("button", { name: label }));
  const champ = screen.getByRole("textbox", { name: /Rechercher dans/ });
  fireEvent.change(champ, { target: { value: texte } });
  return champ;
};

describe("SelecteurListe — ajouter une valeur", () => {
  it("affiche la valeur créée avant que le parent ne la connaisse", async () => {
    const onChange = vi.fn();
    // Le parent ne met jamais ses options à jour : le cas le plus lent.
    const { rerender } = render(
      <SelecteurListe
        label="Catégorie"
        options={[]}
        valeur={null}
        onChange={onChange}
        onCreer={async () => ({ id: "cat-1", error: null })}
        libelleVide="Sans catégorie"
      />,
    );
    ouvrirEtTaper(/Catégorie/, "Quincaillerie");
    fireEvent.click(screen.getByText(/Ajouter « Quincaillerie »/));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("cat-1"));

    rerender(
      <SelecteurListe
        label="Catégorie"
        options={[]}
        valeur="cat-1"
        onChange={onChange}
        onCreer={async () => ({ id: "cat-1", error: null })}
        libelleVide="Sans catégorie"
      />,
    );
    expect(screen.getByRole("button", { name: /Catégorie/ }).textContent).toContain(
      "Quincaillerie",
    );
    expect(screen.getByRole("status").textContent).toContain("Ajout réussi");
  });

  it("ne crée qu'une fois, même avec Entrée frappée deux fois", async () => {
    let finir!: (v: { id: string; error: null }) => void;
    const onCreer = vi.fn(() => new Promise<{ id: string; error: null }>((r) => (finir = r)));
    render(
      <SelecteurListe
        label="Poste"
        options={[]}
        valeur={null}
        onChange={vi.fn()}
        onCreer={onCreer}
      />,
    );
    const champ = ouvrirEtTaper(/Poste/, "Transport");
    fireEvent.keyDown(champ, { key: "Enter" });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(onCreer).toHaveBeenCalledTimes(1);
    await act(async () => finir({ id: "p-1", error: null }));
  });

  it("dit l'erreur quand la connexion tombe, sans rien choisir", async () => {
    const onChange = vi.fn();
    render(
      <SelecteurListe
        label="Poste"
        options={[]}
        valeur={null}
        onChange={onChange}
        onCreer={() => Promise.reject(new Error("Failed to fetch"))}
      />,
    );
    ouvrirEtTaper(/Poste/, "Transport");
    fireEvent.click(screen.getByText(/Ajouter « Transport »/));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Connexion impossible/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Échap referme la liste sans refermer la fiche qui la contient", async () => {
    const fermerFiche = vi.fn();
    render(
      <Modal open onClose={fermerFiche} title="Nouveau produit">
        <SelecteurListe label="Catégorie" options={[]} valeur={null} onChange={vi.fn()} />
      </Modal>,
    );
    const champ = ouvrirEtTaper(/Catégorie/, "x");
    fireEvent.keyDown(champ, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: /Rechercher dans/ })).toBeNull();
    // La modale ne prévient son parent qu'au bout de son animation de
    // sortie : on laisse passer ce délai avant de conclure.
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.getByRole("dialog").getAttribute("data-etat")).not.toBe("sort");
    expect(fermerFiche).not.toHaveBeenCalled();
  });
});

describe("SelecteurPersonne — créer une fiche au milieu d'une vente", () => {
  const monter = (
    onCreer = vi.fn(async () => ({ personne: { id: "pe-1", nom: "Lanto" }, error: null })),
  ) => {
    const envoyerVente = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={envoyerVente}>
        <input aria-label="Montant" defaultValue="15000" />
        <SelecteurPersonne
          label="Vendeur"
          personnes={[]}
          valeur=""
          onChange={onChange}
          onCreer={onCreer}
        />
        <button type="submit">Enregistrer la vente</button>
      </form>,
    );
    ouvrirEtTaper(/Vendeur/, "Lanto");
    fireEvent.click(screen.getByText(/Ajouter « Lanto »/));
    return { envoyerVente, onChange, onCreer };
  };

  it("n'envoie pas le formulaire parent", async () => {
    const { envoyerVente, onChange } = monter();
    fireEvent.change(screen.getByPlaceholderText("03X XX XXX XX"), {
      target: { value: "034 00 000 00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Créer la fiche/ }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ nom: "Lanto", membreId: null, personneId: "pe-1" }),
    );
    expect(envoyerVente).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Montant") as HTMLInputElement).value).toBe("15000");
  });

  it("Entrée dans le téléphone crée la fiche, pas la vente", async () => {
    const { envoyerVente, onCreer } = monter();
    const tel = screen.getByPlaceholderText("03X XX XXX XX");
    fireEvent.change(tel, { target: { value: "034 00 000 00" } });
    fireEvent.keyDown(tel, { key: "Enter" });
    await waitFor(() => expect(onCreer).toHaveBeenCalledTimes(1));
    expect(envoyerVente).not.toHaveBeenCalled();
  });

  it("ne bloque pas l'envoi de la vente tant que le panneau est ouvert", () => {
    const { envoyerVente } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la vente" }));
    // `required` sur le téléphone aurait empêché l'envoi en navigateur ;
    // jsdom ne l'applique pas, d'où la vérification de l'attribut.
    expect(screen.getByPlaceholderText("03X XX XXX XX").hasAttribute("required")).toBe(false);
    expect(envoyerVente).toHaveBeenCalledTimes(1);
  });
});

describe("SelecteurFournisseur — créer une fiche au milieu d'un achat", () => {
  const fiche = {
    id: "f-1",
    nom: "Grossiste Analakely",
    statut: "actif",
    entreprise: null,
    telephone: null,
    ville: null,
  } as never;

  it("transmet le nom de la fiche créée, même avant que la liste ne la contienne", async () => {
    const onChange = vi.fn();
    render(
      <SelecteurFournisseur
        fournisseurs={[]}
        valeur={null}
        onChange={onChange}
        onCreer={async () => ({ supplier: fiche, error: null })}
      />,
    );
    ouvrirEtTaper(/Fournisseur/, "Grossiste Analakely");
    fireEvent.click(screen.getByText(/Ajouter « Grossiste Analakely »/));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // Le dernier appel fait foi : il ne doit pas effacer le nom.
    expect(onChange).toHaveBeenLastCalledWith("f-1", "Grossiste Analakely");
  });

  it("Entrée dans le téléphone n'envoie pas l'achat", async () => {
    const envoyerAchat = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onCompleter = vi.fn(async () => ({ error: null }));
    render(
      <form onSubmit={envoyerAchat}>
        <SelecteurFournisseur
          fournisseurs={[]}
          valeur={null}
          onChange={vi.fn()}
          onCreer={async () => ({ supplier: fiche, error: null })}
          onCompleter={onCompleter}
        />
      </form>,
    );
    ouvrirEtTaper(/Fournisseur/, "Grossiste Analakely");
    fireEvent.click(screen.getByText(/Ajouter « Grossiste Analakely »/));
    const tel = await screen.findByPlaceholderText("03X XX XXX XX");
    fireEvent.change(tel, { target: { value: "034 11 222 33" } });
    fireEvent.keyDown(tel, { key: "Enter" });
    await waitFor(() =>
      expect(onCompleter).toHaveBeenCalledWith("f-1", { telephone: "034 11 222 33" }),
    );
    expect(envoyerAchat).not.toHaveBeenCalled();
  });

  it("garde le téléphone tapé quand l'enregistrement échoue", async () => {
    render(
      <SelecteurFournisseur
        fournisseurs={[]}
        valeur={null}
        onChange={vi.fn()}
        onCreer={async () => ({ supplier: fiche, error: null })}
        onCompleter={async () => ({ error: "Refusé par la base." })}
      />,
    );
    ouvrirEtTaper(/Fournisseur/, "Grossiste Analakely");
    fireEvent.click(screen.getByText(/Ajouter « Grossiste Analakely »/));
    const tel = await screen.findByPlaceholderText("03X XX XXX XX");
    fireEvent.change(tel, { target: { value: "034 11 222 33" } });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("Refusé par la base.");
    expect((screen.getByPlaceholderText("03X XX XXX XX") as HTMLInputElement).value).toBe(
      "034 11 222 33",
    );
  });
});
