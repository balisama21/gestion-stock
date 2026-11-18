import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Marque, Signature, Totaux } from "./blocs";
import { ContexteVisa } from "../lib/visa";
import { ContexteConversion } from "../lib/equivalents";
import type { TotauxDocument } from "../lib/buildDocument";

afterEach(cleanup);

const IMAGE = "data:image/png;base64,iVBORw0KGgo=";

describe("le cachet et la signature sur la feuille", () => {
  const signatures = {
    gauche: "Signature du client",
    droite: "Cachet et signature de l'entreprise",
  };

  it("se posent au-dessus de la ligne de l'entreprise, la signature sur le tampon", () => {
    const { container } = render(
      <ContexteVisa.Provider
        value={{
          cachet: { src: IMAGE, opacite: 0.9, ratio: 1 },
          signature: { src: IMAGE, opacite: 1, ratio: 3 },
        }}
      >
        <Signature signatures={signatures} />
      </ContexteVisa.Provider>,
    );
    const visa = container.querySelector(".doc-visa");
    expect(visa).toBeTruthy();
    expect(visa?.querySelector(".doc-visa-cachet")).toBeTruthy();
    expect(visa?.querySelector(".doc-visa-signature--sur")).toBeTruthy();
    expect(container.textContent).toContain("Cachet et signature de l'entreprise");
  });

  it("laisse la ligne nue sans image", () => {
    const { container } = render(<Signature signatures={signatures} />);
    expect(container.querySelector(".doc-visa")).toBeNull();
  });
});

describe("les totaux dans la devise du document", () => {
  const totaux = {
    horsTaxe: null,
    tva: null,
    total: 1_252_500,
    paye: 1_252_500,
    reste: 0,
    modePaiement: null,
    commission: null,
    libelleHorsTaxe: "Hors taxe",
    libelleTva: "TVA",
    libelleTotal: "Total",
    libellePaye: "Déjà payé",
    libelleReste: "Reste à payer",
  } as unknown as TotauxDocument;

  it("s'impriment en euros quand le document l'impose", () => {
    const { container } = render(
      <ContexteConversion.Provider
        value={{ code: "EUR", symbole: "€", decimales: 2, taux: 5000, nom: "Euro" }}
      >
        <Totaux totaux={totaux} devise="Ar" />
      </ContexteConversion.Provider>,
    );
    expect(container.textContent?.replace(/\s/g, " ")).toContain("250,50 €");
    expect(container.textContent).not.toContain("Ar");
  });

  it("restent en ariary sans devise imposée", () => {
    const { container } = render(<Totaux totaux={totaux} devise="Ar" />);
    expect(container.textContent?.replace(/\s/g, " ")).toContain("1 252 500 Ar");
  });
});

describe("la signature du client", () => {
  it("n'a ni texte ni filet sur une facture, où le client ne signe pas", () => {
    const { container } = render(
      <Signature signatures={{ gauche: "", droite: "Cachet et signature de l'entreprise" }} />,
    );
    const lignes = container.querySelectorAll(".doc-signatures .ligne");
    expect(lignes).toHaveLength(1);
    expect(container.textContent).not.toContain("Signature du client");
  });
});

describe("le logo de la boutique", () => {
  const emetteur = {
    titre: "Émetteur",
    nom: "Épicerie du Centre",
    lignes: [],
    nif: null,
    logoUrl: IMAGE,
    initiales: null,
    sousTitre: null,
  };

  it("se pose à côté du nom", () => {
    const { container } = render(<Marque emetteur={emetteur} />);
    expect(container.querySelector(".doc-logo")).toBeTruthy();
    expect(container.querySelector(".doc-nom")?.textContent).toBe("Épicerie du Centre");
  });

  it("seul et en grand quand il porte déjà le nom", () => {
    const { container } = render(<Marque emetteur={{ ...emetteur, logoSeul: true }} />);
    expect(container.querySelector(".doc-logo--seul")?.getAttribute("alt")).toBe(
      "Épicerie du Centre",
    );
    expect(container.querySelector(".doc-nom")).toBeNull();
  });
});
