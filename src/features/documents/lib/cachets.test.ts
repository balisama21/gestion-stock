import { describe, expect, it } from "vitest";
import { largeurNetteMm, lireCachets, type Cachet } from "./cachets";
import { lireReglagesDocuments, REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";

const BOUTIQUE = "43fc454f-ae66-48cd-af23-a46c0857a527";
const officiel: Cachet = {
  id: "a1",
  nom: "Cachet officiel",
  chemin: `${BOUTIQUE}/0b6c1f7e-9a0e-4b7a-9d7c-2f1e8f3a4b5c.png`,
  largeur: 1200,
  hauteur: 1180,
  opacite: 0.9,
  creeLe: "2026-09-26T10:00:00.000Z",
};

describe("les cachets de la boutique", () => {
  it("se sauvegardent et se relisent à l'identique", () => {
    const signature = {
      ...officiel,
      id: "b2",
      nom: "Signature du gérant",
      largeur: 900,
      hauteur: 300,
    };
    const reglages = { ...REGLAGES_DOCUMENTS_PAR_DEFAUT, cachets: [officiel, signature] };
    expect(lireReglagesDocuments(JSON.parse(JSON.stringify(reglages))).cachets).toEqual([
      officiel,
      signature,
    ]);
  });

  it("aucun par défaut", () => {
    expect(lireReglagesDocuments(undefined).cachets).toEqual([]);
  });

  it("écarte ce qui ne pointe pas vers un PNG de la boutique, et les doublons", () => {
    const lus = lireCachets([
      officiel,
      { ...officiel },
      { ...officiel, id: "x", chemin: "../../autre/boutique.png" },
      { ...officiel, id: "y", chemin: `${BOUTIQUE}/photo.jpg` },
      { ...officiel, id: "z", largeur: 0 },
      "n'importe quoi",
    ]);
    expect(lus.map((c) => c.id)).toEqual(["a1"]);
  });

  it("borne l'opacité", () => {
    expect(lireCachets([{ ...officiel, opacite: 0 }])[0].opacite).toBe(0.2);
    expect(lireCachets([{ ...officiel, opacite: 3 }])[0].opacite).toBe(1);
  });

  it("dit jusqu'où l'image reste nette à 300 points par pouce", () => {
    // 1200 px à 300 ppp = 4 pouces = 101,6 mm.
    expect(largeurNetteMm(officiel)).toBe(102);
  });
});
