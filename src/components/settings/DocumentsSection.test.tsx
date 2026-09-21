import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentsSection } from "./DocumentsSection";
import type { Personnalisation } from "../../lib/personnalisation";
import { lirePersonnalisation } from "../../lib/personnalisation";
import type { StoreSettings } from "../../types";

/**
 * L'ÉCRAN QUI PORTE LA SEULE ÉCRITURE DE TOUTE LA FONCTIONNALITÉ.
 *
 * C'est ce qui rend ces tests importants : tout le reste des documents
 * ne fait que lire. Ici, un enregistrement maladroit effacerait le
 * vocabulaire ou les rappels d'une boutique en production, sans
 * message et sans retour possible.
 */

const BOUTIQUE = {
  storeName: "Boutique d'essai",
  subtitle: "",
  suppliers: [],
  currencySymbol: "Ar",
  tvaRate: 0,
} as unknown as StoreSettings;

/** Une personnalisation qui porte DÉJÀ les réglages d'autres écrans. */
const PERSO: Personnalisation = {
  modules: { achats: { masque: true } },
  rappels: { veilleHeure: 7, memeJourMinutes: 30 },
};

function afficher(personnalisation: Personnalisation = PERSO) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <DocumentsSection
      personnalisation={lirePersonnalisation(personnalisation)}
      onSave={onSave}
      settings={BOUTIQUE}
      sales={[]}
      products={[]}
    />,
  );
  return onSave;
}

/** Le contenu réellement envoyé au dernier appel. */
const envoye = (onSave: ReturnType<typeof vi.fn>) =>
  onSave.mock.calls.at(-1)?.[0] as Personnalisation;

describe("l'enregistrement ne détruit rien", () => {
  afterEach(cleanup);

  it("recopie le vocabulaire et les rappels des autres écrans", async () => {
    const onSave = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Bandeau/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const p = envoye(onSave);
    expect(p.modules).toEqual({ achats: { masque: true } });
    expect(p.rappels).toEqual({ veilleHeure: 7, memeJourMinutes: 30 });
  });

  it("range ses réglages sous la clé « documents », et nulle part ailleurs", async () => {
    const onSave = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Épuré/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const p = envoye(onSave) as Personnalisation & { documents?: { modele?: string } };
    expect(p.documents?.modele).toBe("epure");
  });

  it("préserve la clé d'un écran qui n'existe pas encore", async () => {
    // Le cas qui a motivé la correction de `lirePersonnalisation` :
    // un autre écran range sa propre clé, et cet écran-ci ne doit pas
    // l'emporter au passage.
    const onSave = afficher({ ...PERSO, unEcranFutur: { quelqueChose: 1 } } as Personnalisation);
    fireEvent.click(screen.getByRole("button", { name: /Compact/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(envoye(onSave).unEcranFutur).toEqual({ quelqueChose: 1 });
  });

  it("RETIRE la clé plutôt que d'écrire les valeurs par défaut", async () => {
    /*
     * Une clé absente veut dire « comme prévu par le logiciel », et
     * suivra donc une évolution future des défauts. Un choix figé un
     * jour donné ne le ferait pas.
     */
    const avecReglages = { ...PERSO, documents: { modele: "bandeau" } } as Personnalisation;
    const onSave = afficher(avecReglages);
    fireEvent.click(screen.getByRole("button", { name: /Valeurs d'origine/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(envoye(onSave)).not.toHaveProperty("documents");
    expect(envoye(onSave).modules).toEqual({ achats: { masque: true } });
  });
});

describe("l'interrupteur des nouveaux documents", () => {
  afterEach(cleanup);

  it("est en tête, parce qu'on vient le chercher en urgence", () => {
    afficher();
    const libelles = screen.getAllByText(/Nouveaux documents|Modèle|Couleur du document/);
    expect(libelles[0].textContent).toBe("Nouveaux documents");
  });

  it("s'enregistre à faux quand on le coupe", async () => {
    const onSave = afficher();
    fireEvent.click(screen.getByRole("switch", { name: /Utiliser les nouveaux documents/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const p = envoye(onSave) as Personnalisation & { documents?: { actif?: boolean } };
    expect(p.documents?.actif).toBe(false);
  });
});

describe("l'aperçu", () => {
  afterEach(cleanup);

  it("le dit quand la boutique n'a rien vendu, plutôt que d'inventer", () => {
    // Aucune donnée d'exemple dans l'application : pas de client
    // fictif, pas de montant inventé.
    afficher();
    expect(screen.getByText(/montre une vraie vente de la boutique/)).toBeTruthy();
  });
});

describe("le bouton d'enregistrement", () => {
  afterEach(cleanup);

  it("reste inerte tant que rien n'a changé", () => {
    afficher();
    expect(screen.getByRole("button", { name: /Enregistrer/ }).hasAttribute("disabled")).toBe(true);
  });

  it("s'active dès qu'un réglage bouge", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Bandeau/ }));
    expect(screen.getByRole("button", { name: /Enregistrer/ }).hasAttribute("disabled")).toBe(
      false,
    );
  });
});
