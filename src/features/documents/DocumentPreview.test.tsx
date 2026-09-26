import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DocumentPreview } from "./DocumentPreview";
import { documentDeVente } from "./lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./lib/reglages";
import { creerDisposition, deplacerSection, FEUILLE, poserBloc } from "./lib/disposition";

afterEach(cleanup);

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

let facture = creerDisposition("facture", "bandeau", "Factures");
facture = poserBloc(facture, "totaux", { x: 0, y: 290 });
facture = poserBloc(facture, "logo", { x: 180, y: 5, l: 25, h: 25 });
const ticket = deplacerSection(creerDisposition("ticket", "classique", "Caisse"), "codeBarres", 0);

const AVEC: ReglagesDocuments = {
  ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
  libre: {
    dispositions: { [facture.id]: facture, [ticket.id]: ticket },
    parType: { facture: facture.id, ticket: ticket.id },
  },
};

const feuilles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".doc-feuille")];

describe("sans disposition, rien ne change", () => {
  it("rend le même document qu'avant l'éditeur", () => {
    const avant = render(
      <DocumentPreview document={doc} reglages={REGLAGES_DOCUMENTS_PAR_DEFAUT} sansActions />,
    ).container.innerHTML;
    cleanup();
    const seulementDevis: ReglagesDocuments = {
      ...AVEC,
      libre: { ...AVEC.libre, parType: { devis: facture.id } },
    };
    const apres = render(<DocumentPreview document={doc} reglages={seulementDevis} sansActions />)
      .container.innerHTML;
    expect(apres).toBe(avant);
    expect(apres).not.toContain("doc-feuille--libre");
  });
});

describe("avec une disposition libre", () => {
  it("rend la feuille libre, au modèle de départ", () => {
    const { container } = render(<DocumentPreview document={doc} reglages={AVEC} sansActions />);
    const [f] = feuilles(container);
    expect(f.className).toContain("doc-feuille--libre");
    expect(f.className).toContain("m-bandeau");
    expect(f.className).toContain("printable-receipt");
  });

  it("aucun bloc ne dépasse le cadre A4, même poussé au bord", () => {
    const { container } = render(<DocumentPreview document={doc} reglages={AVEC} sansActions />);
    for (const b of container.querySelectorAll<HTMLElement>("[data-bloc]")) {
      const [x, y, l, h] = [b.style.left, b.style.top, b.style.width, b.style.height].map(
        parseFloat,
      );
      expect(x + l).toBeLessThanOrEqual(FEUILLE.l);
      expect(y + h).toBeLessThanOrEqual(FEUILLE.h);
    }
    const totaux = container.querySelector<HTMLElement>('[data-bloc="totaux"]')!;
    expect(totaux.textContent).toContain(doc.totaux.libelleTotal);
  });

  it("un modèle imposé pour ce tirage l'emporte", () => {
    const { container } = render(
      <DocumentPreview
        document={doc}
        reglages={AVEC}
        modele="epure"
        dispositionId={null}
        sansActions
      />,
    );
    expect(feuilles(container)[0].className).toContain("m-epure");
    expect(container.innerHTML).not.toContain("doc-feuille--libre");
  });

  it("le ticket suit l'ordre choisi", () => {
    const { container } = render(
      <DocumentPreview document={doc} reglages={AVEC} format="t80" sansActions />,
    );
    const rouleau = container.querySelector(".doc-ticket")!;
    expect(rouleau.firstElementChild?.classList.contains("codebarres")).toBe(true);
  });
});
