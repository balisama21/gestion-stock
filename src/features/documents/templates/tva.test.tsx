import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Bandeau } from "./Bandeau";
import { Classique } from "./Classique";
import { Compact } from "./Compact";
import { Epure } from "./Epure";
import { Ticket } from "./Ticket";
import { documentDeVente } from "../lib/buildDocument";
import { BOUTIQUE, PRODUITS, TICKET_TROIS_LIGNES } from "../lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../lib/reglages";

/**
 * Une facture à trois taux, telle qu'elle s'imprime : la colonne de
 * TVA sur chaque modèle, et une ligne par taux dans les totaux.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const document = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS.map((p) =>
    p.id === "p-024" ? { ...p, tvaRate: 0 } : p.id === "p-022" ? { ...p, tvaCategorie: 5.5 } : p,
  ),
  boutique: BOUTIQUE,
  reglages: { ...R, options: { ...R.options, tva: true } },
});

/** Le texte, espaces insécables ramenés à des espaces simples. */
const texte = (el: HTMLElement) => (el.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");

describe("une facture à plusieurs taux", () => {
  for (const [nom, Modele] of Object.entries({ Classique, Bandeau, Epure, Compact })) {
    it(`${nom} montre la colonne et la ventilation`, () => {
      const { container } = render(
        <Modele document={document} lignes={document.lignes} premiere derniere pagination={null} />,
      );
      const t = texte(container);
      expect(t).toContain("5,5 %");
      expect(t).toContain("TVA 20 % sur 250 000 Ar");
      expect(t).toContain("TVA 5,5 % sur 4 265 Ar");
      expect(t).toContain("TVA 0 % sur 3 000 Ar");
      expect(t).toContain("307 500");
    });
  }

  it("le ticket donne une ligne par taux", () => {
    const { container } = render(
      <Ticket document={document} reglages={R.ticket} date="13/09/2026" />,
    );
    const t = texte(container);
    expect(t).toContain("TVA 20 %");
    expect(t).toContain("TVA 5,5 %");
  });
});
