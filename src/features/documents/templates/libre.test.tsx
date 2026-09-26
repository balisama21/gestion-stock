import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Libre } from "./Libre";
import { documentDeVente } from "../lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "../lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../lib/reglages";
import { blocsResolus, creerDisposition, poserBloc } from "../lib/disposition";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const poser = (d: ReturnType<typeof creerDisposition>) =>
  render(
    <Libre
      document={doc}
      base={d.base}
      blocs={blocsResolus(d)}
      lignes={doc.lignes}
      pagination={null}
    />,
  ).container;

describe("la feuille libre", () => {
  it("pose chaque bloc à sa place, en millimètres", () => {
    const d = poserBloc(creerDisposition("facture", "classique", "x"), "titre", { x: 20, y: 40 });
    const titre = poser(d).querySelector<HTMLElement>('[data-bloc="titre"]')!;
    expect(titre.style.left).toBe("20mm");
    expect(titre.style.top).toBe("40mm");
    expect(titre.textContent).toBe(doc.titre);
  });

  it("une mention obligatoire déplacée reste affichée, au premier plan", () => {
    let d = creerDisposition("facture", "classique", "x");
    d = poserBloc(d, "totaux", { x: 0, y: 280, masque: true });
    d = poserBloc(d, "reperes", { x: 190, y: 0, masque: true });
    d = poserBloc(d, "signatures", { x: 0, y: 280, l: 210, h: 17 });
    const c = poser(d);
    const totaux = c.querySelector<HTMLElement>('[data-bloc="totaux"]')!;
    const reperes = c.querySelector<HTMLElement>('[data-bloc="reperes"]')!;
    expect(totaux.textContent).toContain(doc.totaux.libelleTotal);
    expect(reperes.textContent).toContain(doc.numero);
    expect(Number(totaux.style.zIndex)).toBeGreaterThan(
      Number(c.querySelector<HTMLElement>('[data-bloc="signatures"]')!.style.zIndex),
    );
  });

  it("un bloc masqué ne laisse rien", () => {
    const d = poserBloc(creerDisposition("facture", "classique", "x"), "motDeFin", {
      masque: true,
    });
    expect(poser(d).querySelector('[data-bloc="motDeFin"]')).toBeNull();
  });

  it("n'affiche pas les données absentes du document", () => {
    const c = poser(creerDisposition("facture", "classique", "x"));
    expect(c.querySelector('[data-bloc="paiement"]')).toBeNull();
  });
});
