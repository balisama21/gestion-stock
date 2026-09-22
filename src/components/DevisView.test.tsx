import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DevisView } from "./DevisView";
import type { StoreSettings } from "../types";
import {
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ReglagesDocuments,
} from "../features/documents/lib/reglages";

/**
 * CE QUE L'ÉCRAN ENVOIE VRAIMENT À LA BASE.
 *
 * La proforma et le devis partagent tout : la liste, le formulaire,
 * la conversion en vente. Ce qui les sépare tient dans deux champs de
 * la charge utile — le type et la durée promise. S'ils n'arrivent pas
 * jusqu'à la base, la proforma s'imprime en devis et personne ne s'en
 * aperçoit avant que le client ne le dise.
 */

const BOUTIQUE = {
  storeName: "Boutique d'essai",
  subtitle: "",
  suppliers: [],
  currencySymbol: "Ar",
  tvaRate: 0,
} as unknown as StoreSettings;

function afficher(reglages: ReglagesDocuments = REGLAGES_DOCUMENTS_PAR_DEFAUT) {
  const onAddQuote = vi.fn().mockResolvedValue({ quote: { numero: "PRO001" }, error: null });
  render(
    <DevisView
      reglagesDocuments={reglages}
      quotes={[]}
      quoteItems={[]}
      clients={[]}
      products={[]}
      onAddQuote={onAddQuote}
      onUpdateQuote={vi.fn()}
      onSetStatus={vi.fn()}
      onDeleteQuote={vi.fn()}
      settings={BOUTIQUE}
    />,
  );
  return onAddQuote;
}

/** Remplit le minimum : un destinataire et une ligne. */
function remplir() {
  fireEvent.change(screen.getByLabelText(/Nom sur/i), { target: { value: "Rakoto" } });
  fireEvent.change(screen.getByLabelText(/Désignation/i), { target: { value: "Ciment" } });
  fireEvent.change(screen.getByLabelText(/Prix unitaire/i), { target: { value: "1000" } });
}

afterEach(cleanup);

describe("la nature de la pièce", () => {
  it("part sur « devis » quand on clique sur « Nouveau devis »", async () => {
    const onAddQuote = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouveau devis/ }));
    remplir();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => expect(onAddQuote).toHaveBeenCalled());
    expect(onAddQuote.mock.calls[0][0]).toMatchObject({ type: "devis" });
  });

  it("part sur « proforma » quand on clique sur « Nouvelle proforma »", async () => {
    const onAddQuote = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle proforma/ }));
    remplir();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => expect(onAddQuote).toHaveBeenCalled());
    expect(onAddQuote.mock.calls[0][0]).toMatchObject({ type: "proforma" });
  });

  it("fige la durée promise, telle que la boutique l'a réglée", async () => {
    const onAddQuote = afficher({
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      types: { proforma: { validiteJours: 7 } },
    });
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle proforma/ }));
    remplir();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await waitFor(() => expect(onAddQuote).toHaveBeenCalled());
    expect(onAddQuote.mock.calls[0][0]).toMatchObject({
      type: "proforma",
      duree_validite_jours: 7,
    });
  });
});
