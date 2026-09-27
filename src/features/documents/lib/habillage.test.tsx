import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Libre } from "../templates/Libre";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import {
  blocsResolus,
  creerDisposition,
  habiller,
  lireLibre,
  poserBloc,
  type Disposition,
} from "./disposition";
import { figer, lireCopieFigee } from "./copieFigee";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const feuille = (d: Disposition) =>
  render(
    <Libre
      document={doc}
      base={d.base}
      blocs={blocsResolus(d)}
      lignes={doc.lignes}
      pagination={null}
    />,
  ).container;

const relire = (d: Disposition) =>
  lireLibre(JSON.parse(JSON.stringify({ dispositions: { [d.id]: d } }))).dispositions[d.id];

describe("l'allure d'un bloc", () => {
  it("police, gras, italique et couleur du texte passent sur la feuille", () => {
    const d = habiller(creerDisposition("facture", "classique", "x"), "titre", {
      police: "serif",
      gras: true,
      italique: true,
      encre: "#8E2F3C",
    });
    const titre = feuille(d).querySelector<HTMLElement>('[data-bloc="titre"]')!;
    expect(titre.className).toContain("bl-police-serif");
    expect(titre.className).toContain("bl-gras");
    expect(titre.className).toContain("bl-italique");
    expect(titre.style.getPropertyValue("--bl-encre")).toBe("#8E2F3C");
  });

  it("la taille agrandit le contenu sans toucher au cadre", () => {
    const d = habiller(creerDisposition("facture", "classique", "x"), "motDeFin", { taille: 150 });
    const bloc = feuille(d).querySelector<HTMLElement>('[data-bloc="motDeFin"]')!;
    expect(bloc.style.width).toBe(`${blocsResolus(d).motDeFin.l}mm`);
    expect(bloc.querySelector<HTMLElement>(".doc-libre-echelle")?.style.zoom).toBe("1.5");
  });

  it("fond et bordure habillent le bloc ; sur le bandeau, le fond en change la couleur", () => {
    let d = habiller(creerDisposition("facture", "bandeau", "x"), "mentions", {
      fond: "#E6EBE8",
      bordure: 0.6,
    });
    d = habiller(d, "fond", { fond: "#1F4E79" });
    const racine = feuille(d);
    const mentions = racine.querySelector<HTMLElement>('[data-bloc="mentions"]')!;
    expect(mentions.className).toContain("bl-cadre");
    expect(mentions.style.background).toMatch(/230, 235, 232|#E6EBE8/i);
    expect(mentions.style.border).toContain("0.6mm solid");
    const fond = racine.querySelector<HTMLElement>('[data-bloc="fond"]')!;
    expect(fond.style.getPropertyValue("--doc")).toBe("#1F4E79");
    expect(fond.style.background).toBe("");
  });

  it("sans allure choisie, la feuille ne change pas", () => {
    const d = creerDisposition("facture", "classique", "x");
    const titre = feuille(d).querySelector<HTMLElement>('[data-bloc="titre"]')!;
    expect(titre.className).toBe("doc-libre-bloc bl-titre bl-droite");
    expect(titre.querySelector(".doc-libre-echelle")).toBeNull();
  });

  it("une clé rendue au modèle disparaît, et l'allure vide aussi", () => {
    let d = habiller(creerDisposition("facture", "classique", "x"), "titre", { gras: true });
    d = habiller(d, "titre", { gras: undefined });
    expect(d.blocs.titre).not.toHaveProperty("habillage");
  });
});

describe("sauvegarde de l'allure", () => {
  it("se relit à l'identique, couleur du document comprise", () => {
    let d = creerDisposition("facture", "classique", "x");
    d = habiller(d, "titre", { police: "mono", taille: 130, encre: "#1F4E79" });
    d = habiller(d, "mentions", { fond: "#FFFFFF", bordure: 1, bordureCouleur: "#16181A" });
    d = { ...d, couleur: "#8E2F3C" };
    expect(relire(d)).toEqual(d);
  });

  it("écarte ce qui n'est pas une allure, et borne la taille", () => {
    const relu = lireLibre({
      dispositions: {
        a: {
          type: "facture",
          base: "classique",
          couleur: "rouge",
          blocs: {
            titre: {
              x: 1,
              y: 1,
              l: 50,
              h: 10,
              habillage: {
                police: "comic",
                taille: 900,
                encre: "url(x)",
                fond: "#12345",
                bordure: -1,
                gras: "oui",
              },
            },
            mentions: { x: 1, y: 20, l: 50, h: 10, habillage: { taille: 10 } },
          },
        },
      },
    }).dispositions.a;
    expect(relu.couleur).toBeUndefined();
    expect(relu.blocs.titre?.habillage).toEqual({ taille: 250 });
    expect(relu.blocs.mentions?.habillage).toEqual({ taille: 60 });
  });

  it("la copie figée garde l'allure et la couleur de la disposition", () => {
    let d = creerDisposition("facture", "classique", "x");
    d = habiller(poserBloc(d, "titre", { y: 20 }), "titre", { gras: true });
    d = { ...d, couleur: "#1F4E79" };
    const reglages = {
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      libre: { dispositions: { [d.id]: d }, parType: { facture: d.id } },
    };
    const copie = JSON.parse(JSON.stringify(figer(reglages, BOUTIQUE, "facture", "2026-09-27")));
    const relue = lireCopieFigee(copie, REGLAGES_DOCUMENTS_PAR_DEFAUT, "facture");
    expect(relue?.reglages.libre.dispositions[d.id]).toEqual(d);
  });
});
