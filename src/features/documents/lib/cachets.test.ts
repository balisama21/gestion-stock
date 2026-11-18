import { describe, expect, it } from "vitest";
import { largeurNetteMm, lireCachets, visaDeLaBoutique, type Cachet } from "./cachets";
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
  role: "cachet",
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

describe("le rôle d'une image", () => {
  const brut = (extra: Record<string, unknown>) => ({
    id: "x1",
    nom: "Cachet",
    chemin: "43fc454f-ae66-48cd-af23-a46c0857a527/x1.png",
    largeur: 800,
    hauteur: 400,
    opacite: 1,
    ...extra,
  });

  it("se lit tel qu'il a été enregistré", () => {
    expect(lireCachets([brut({ role: "signature" })])[0].role).toBe("signature");
  });

  it("se déduit du nom sur les anciennes images", () => {
    expect(lireCachets([brut({ nom: "Signature du gérant" })])[0].role).toBe("signature");
    expect(lireCachets([brut({ nom: "Cachet officiel" })])[0].role).toBe("cachet");
  });

  it("désigne le cachet et la signature que la facture appose", () => {
    const liste = lireCachets([
      brut({ id: "a", nom: "Tampon" }),
      brut({ id: "b", nom: "Signé", role: "signature" }),
      brut({ id: "c", nom: "Autre tampon" }),
    ]);
    const v = visaDeLaBoutique(liste);
    expect(v.cachet?.id).toBe("a");
    expect(v.signature?.id).toBe("b");
  });
});
