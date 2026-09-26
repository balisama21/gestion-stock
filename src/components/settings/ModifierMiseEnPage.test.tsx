import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModifierMiseEnPage } from "./ModifierMiseEnPage";
import {
  ContexteReglagesDocuments,
  type ReglagesModifiables,
} from "../../features/documents/contexteReglages";
import { documentDeVente } from "../../features/documents/lib/buildDocument";
import {
  BOUTIQUE,
  CLIENT,
  PAIEMENT,
  PRODUITS,
  TICKET_TROIS_LIGNES,
} from "../../features/documents/lib/fixtures";
import {
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ReglagesDocuments,
} from "../../features/documents/lib/reglages";
import { creerDisposition, dispositionDuType } from "../../features/documents/lib/disposition";

vi.mock("../../features/documents/lib/traiterCachet", () => ({ imageCachet: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

function afficher(
  props: Partial<React.ComponentProps<typeof ModifierMiseEnPage>> = {},
  ctx: Partial<ReglagesModifiables> = {},
) {
  const enregistrer = vi.fn().mockResolvedValue(null);
  const valeur: ReglagesModifiables = {
    peutRegler: true,
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
    enregistrer,
    ...ctx,
  };
  const onDisposition = vi.fn();
  const onOuverture = vi.fn();
  render(
    <ContexteReglagesDocuments.Provider value={valeur}>
      <ModifierMiseEnPage
        document={doc}
        format="a4"
        dispositionId={null}
        modele="epure"
        onDisposition={onDisposition}
        onOuverture={onOuverture}
        {...props}
      />
    </ContexteReglagesDocuments.Provider>,
  );
  const enregistre = () => enregistrer.mock.calls.at(-1)?.[0] as ReglagesDocuments;
  return { enregistrer, enregistre, onDisposition, onOuverture };
}

const bouton = () => screen.queryByRole("button", { name: /Modifier la mise en page/ });

describe("qui voit le bouton", () => {
  it("personne sans le droit de régler les documents", () => {
    afficher({}, { peutRegler: false });
    expect(bouton()).toBeNull();
  });

  it("personne hors de l'application", () => {
    render(
      <ModifierMiseEnPage document={doc} format="a4" dispositionId={null} modele="classique" />,
    );
    expect(bouton()).toBeNull();
  });
});

describe("depuis un document en mode simple", () => {
  it("part du modèle affiché, et l'enregistrement le rend actif pour ce type", async () => {
    const { enregistre, onDisposition, onOuverture } = afficher();
    fireEvent.click(bouton()!);
    expect(onOuverture).toHaveBeenCalledWith(true);
    expect(screen.getByRole("dialog", { name: "Éditeur de disposition" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
    await waitFor(() => expect(onDisposition).toHaveBeenCalled());

    const d = dispositionDuType(enregistre().libre, "facture")!;
    expect(d.base).toBe("epure");
    expect(onDisposition).toHaveBeenCalledWith(d.id);
    expect(onOuverture).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog", { name: "Éditeur de disposition" })).toBeNull();
  });

  it("garde l'éditeur ouvert et le dit quand l'enregistrement échoue", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    afficher({}, { enregistrer: vi.fn().mockResolvedValue("Boutique verrouillée") });
    fireEvent.click(bouton()!);
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(screen.getByRole("dialog", { name: "Éditeur de disposition" })).toBeTruthy();
  });

  it("demande avant de quitter avec des changements", () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(false);
    afficher();
    fireEvent.click(bouton()!);
    fireEvent.click(screen.getByRole("button", { name: "Logo" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux réglages" }));
    expect(confirmer).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Éditeur de disposition" })).toBeTruthy();
  });
});

describe("depuis une pièce déjà émise", () => {
  it("règle la disposition actuelle du type, sans changer la pièce affichée", async () => {
    const actuelle = creerDisposition("facture", "compact", "Actuelle");
    const reglages = {
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      libre: { dispositions: { [actuelle.id]: actuelle }, parType: { facture: actuelle.id } },
    };
    const { enregistre, onDisposition } = afficher(
      { pieceFigee: true, dispositionId: "figee-ancienne" },
      { reglages },
    );
    fireEvent.click(bouton()!);
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));
    await waitFor(() => expect(enregistre()).toBeDefined());
    expect(dispositionDuType(enregistre().libre, "facture")?.id).toBe(actuelle.id);
    expect(onDisposition).not.toHaveBeenCalled();
  });
});

describe("depuis un ticket", () => {
  it("ouvre l'éditeur en colonne", () => {
    afficher({ format: "t80" });
    fireEvent.click(bouton()!);
    expect(screen.getByRole("dialog", { name: "Éditeur du ticket" })).toBeTruthy();
  });
});
