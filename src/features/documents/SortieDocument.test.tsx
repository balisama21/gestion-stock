import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { SortieDocument } from "./SortieDocument";
import { ContexteReglagesDocuments } from "./contexteReglages";
import { documentDeVente } from "./lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./lib/reglages";

vi.mock("./lib/traiterCachet", () => ({ imageCachet: vi.fn() }));

afterEach(cleanup);

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

/** L'écran qui ouvre le document, et l'application qui garde les réglages. */
function Ecran({ onFermer }: { onFermer: () => void }) {
  const [reglages, setReglages] = useState<ReglagesDocuments>(REGLAGES_DOCUMENTS_PAR_DEFAUT);
  return (
    <ContexteReglagesDocuments.Provider
      value={{
        peutRegler: true,
        reglages,
        enregistrer: async (r) => {
          setReglages(r);
          return null;
        },
      }}
    >
      <SortieDocument document={doc} reglages={reglages} onFermer={onFermer} />
    </ContexteReglagesDocuments.Provider>
  );
}

describe("modifier la mise en page depuis un document", () => {
  it("l'aperçu montre la nouvelle disposition dès l'enregistrement", async () => {
    render(<Ecran onFermer={vi.fn()} />);
    expect(document.querySelector(".doc-feuille--libre")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Modifier la mise en page/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer/ }));

    await waitFor(() => expect(document.querySelector(".doc-feuille--libre")).not.toBeNull());
    const choix = screen.getByTitle(/Change le modèle pour ce document/) as HTMLSelectElement;
    expect(choix.value).toMatch(/^libre:/);
  });

  it("Échap dans l'éditeur ne ferme pas la fenêtre du document", async () => {
    const onFermer = vi.fn();
    render(<Ecran onFermer={onFermer} />);
    fireEvent.click(screen.getByRole("button", { name: /Modifier la mise en page/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });
    // La fenêtre joue 200 ms de sortie avant de prévenir.
    await new Promise((ok) => setTimeout(ok, 300));
    expect(onFermer).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Éditeur de disposition" })).toBeTruthy();
  });
});
