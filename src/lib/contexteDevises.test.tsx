import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { convertir, Equivalents, FournisseurDevises, texteEquivalents } from "./contexteDevises";
import { ContexteEquivalents } from "../features/documents/lib/equivalents";
import { EquivalentsTotal } from "../features/documents/parts/blocs";

const EUR = { code: "EUR", symbole: "€", decimales: 2, taux: 5000 };
const KMF = { code: "KMF", symbole: "CF", decimales: 0, taux: 10 };

describe("équivalents en devises", () => {
  afterEach(cleanup);

  it("convertit depuis la devise principale", () => {
    expect(convertir(10000, EUR)).toMatch(/^2,00.€$/);
    expect(convertir(10000, KMF)).toMatch(/^1.000.CF$/);
    expect(texteEquivalents(10000, [EUR, KMF])).toContain(" · ");
    expect(texteEquivalents(0, [EUR])).toBe("");
  });

  it("n'affiche rien tant qu'aucune devise n'est choisie", () => {
    const { container } = render(<Equivalents montant={10000} />);
    expect(container.textContent).toBe("");
  });

  it("affiche les devises choisies pour l'écran", () => {
    render(
      <FournisseurDevises value={{ affichees: [EUR], pourDocument: () => [] }}>
        <Equivalents montant={10000} />
      </FournisseurDevises>,
    );
    expect(screen.getByText(/2,00.€/)).toBeTruthy();
  });

  it("un document imprime le total dans chaque devise choisie", () => {
    render(
      <ContexteEquivalents.Provider value={[EUR, KMF]}>
        <EquivalentsTotal total={10000} />
      </ContexteEquivalents.Provider>,
    );
    expect(screen.getByText("Soit en EUR")).toBeTruthy();
    expect(screen.getByText("Soit en KMF")).toBeTruthy();
  });
});
