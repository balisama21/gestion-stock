import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Ticket } from "./Ticket";
import { documentDeVente } from "../lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "../lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../lib/reglages";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type: "recu",
});

const reglages = REGLAGES_DOCUMENTS_PAR_DEFAUT.ticket;

describe("le ticket sans disposition", () => {
  it("se rend à l'identique", () => {
    const { container } = render(<Ticket document={doc} reglages={reglages} date="13/09/2026" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("le ticket en colonne", () => {
  it("suit l'ordre choisi et ne sépare pas le code-barres du pied", () => {
    const { container } = render(
      <Ticket
        document={doc}
        reglages={reglages}
        date="13/09/2026"
        reperer
        colonne={{
          ordre: ["entete", "totaux", "infos", "articles", "pied", "codeBarres"],
          masques: [],
        }}
      />,
    );
    const sections = [...container.querySelectorAll<HTMLElement>("[data-section]")].map(
      (s) => s.dataset.section,
    );
    expect(sections).toEqual(["entete", "totaux", "infos", "articles", "pied", "codeBarres"]);
    expect(container.querySelectorAll(".sep")).toHaveLength(4);
  });

  it("retire une section masquée sans laisser de filet orphelin", () => {
    const { container } = render(
      <Ticket
        document={doc}
        reglages={reglages}
        date="13/09/2026"
        colonne={{
          ordre: ["codeBarres", "entete", "infos", "articles", "totaux", "pied"],
          masques: ["codeBarres"],
        }}
      />,
    );
    expect(container.querySelector(".codebarres")).toBeNull();
    expect(container.firstElementChild?.classList.contains("sep")).toBe(false);
  });
});
