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

describe("ticket de caisse", () => {
  afterEach(cleanup);

  it("imprime les équivalents sous chaque article et sous le total", async () => {
    const { Ticket } = await import("../features/documents/templates/Ticket");
    const document = {
      emetteur: { nom: "B", lignes: [], nif: null },
      destinataire: { nom: "Client" },
      meta: [],
      codeBarres: null,
      heure: null,
      lignes: [
        {
          id: "1",
          designation: "Savon",
          detail: null,
          quantite: 1,
          unite: null,
          prixUnitaire: 10000,
          total: 10000,
        },
      ],
      totaux: {
        horsTaxe: null,
        tva: null,
        total: 10000,
        paye: null,
        reste: null,
        modePaiement: null,
        libellePaye: "",
      },
      devise: "Ar",
      messageTicket: null,
    } as unknown as React.ComponentProps<typeof Ticket>["document"];
    render(
      <ContexteEquivalents.Provider value={[EUR]}>
        <Ticket
          document={document}
          reglages={{ detailLignes: false, codeBarres: false } as never}
          date=""
        />
      </ContexteEquivalents.Provider>,
    );
    expect(screen.getByText("Soit en EUR")).toBeTruthy();
    expect(screen.getByText(/≈ 2,00.€/)).toBeTruthy();
  });
});
