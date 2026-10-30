import { describe, expect, it } from "vitest";
import {
  changerReference,
  choisirUnite,
  contenuDe,
  depuisFiche,
  duOuDeLa,
  erreurDeLaFiche,
  estUnContenant,
  prixDetailles,
  saisieUniteVide,
  unOuUne,
  versFiche,
  type PrixSaisis,
  type SaisieUnite,
} from "./uniteDeVente";

/**
 * L'UNITÉ DITE SIMPLEMENT
 *
 * Un cahier à la pièce n'ouvre rien ; un paquet de 12 cahiers demande
 * son contenu, et les prix se déduisent d'un niveau à l'autre.
 */

const paquet = (contenu = "12"): SaisieUnite => ({
  ...saisieUniteVide(),
  idLot: "lot",
  unite: "paquet",
  contenu,
  uniteInterne: "pièce",
});

describe("ce qui est un contenant", () => {
  it("un paquet, un carton, un sac de 50 kg, une Boîte ; pas une pièce ni un kg", () => {
    expect(estUnContenant("paquet")).toBe(true);
    expect(estUnContenant("Carton")).toBe(true);
    expect(estUnContenant("sac de 50 kg")).toBe(true);
    expect(estUnContenant("Boîte")).toBe(true);
    expect(estUnContenant("pièce")).toBe(false);
    expect(estUnContenant("kg")).toBe(false);
    expect(estUnContenant("")).toBe(false);
  });

  it("parle français : un paquet, une boîte, du carton, de la pièce", () => {
    expect(unOuUne("paquet")).toBe("un paquet");
    expect(unOuUne("boîte")).toBe("une boîte");
    expect(duOuDeLa("carton")).toBe("du carton");
    expect(duOuDeLa("pièce")).toBe("de la pièce");
  });

  it("une douzaine en contient 12 sans qu'on le dise", () => {
    expect(choisirUnite(saisieUniteVide(), "douzaine").contenu).toBe("12");
  });
});

describe("une pièce, un kg : rien de plus", () => {
  it("la fiche garde l'unité et les prix tels quels, sans conditionnement", () => {
    const s = { ...saisieUniteVide(), unite: "kg" };
    expect(versFiche(s, { achat: 3000, vente: 3600, reference: "lot" })).toEqual({
      unite: "kg",
      prixAchat: 3000,
      prixVenteDefaut: 3600,
      conditionnements: [],
    });
  });

  it("un paquet sans contenu dit se vend entier : c'est une unité comme une autre", () => {
    const s = paquet("");
    expect(contenuDe(s)).toBeNull();
    expect(erreurDeLaFiche(s, { achat: 500, vente: 700, reference: "lot" })).toBeNull();
    expect(versFiche(s, { achat: 500, vente: 700, reference: "lot" })).toMatchObject({
      unite: "paquet",
      prixAchat: 500,
      prixVenteDefaut: 700,
      conditionnements: [],
    });
  });
});

describe("un paquet de 12 cahiers acheté 12 000", () => {
  it("coûte 1 000 la pièce", () => {
    const d = prixDetailles(paquet(), { achat: 12000, vente: 0, reference: "lot" });
    expect(d.achatUnite).toBe(1000);
  });

  it("vendu 15 000 le paquet : la pièce passe à 1 250", () => {
    const d = prixDetailles(paquet(), { achat: 12000, vente: 15000, reference: "lot" });
    expect(d.venteUnite).toBe(1250);
    expect(d.venteLot).toBe(15000);
  });

  it("vendu 1 250 la pièce : le paquet passe à 15 000", () => {
    const d = prixDetailles(paquet(), { achat: 12000, vente: 1250, reference: "unite" });
    expect(d.venteLot).toBe(15000);
    expect(d.venteUnite).toBe(1250);
  });

  it("changer de référence convertit le prix, sans en changer le sens", () => {
    const auPaquet: PrixSaisis = { achat: 12000, vente: 15000, reference: "lot" };
    const aLaPiece = changerReference(paquet(), auPaquet, "unite");
    expect(aLaPiece).toEqual({ achat: 12000, vente: 1250, reference: "unite" });
    expect(changerReference(paquet(), aLaPiece, "lot")).toEqual(auPaquet);
  });

  it("la fiche compte le stock en pièces, et le paquet en devient le conditionnement", () => {
    const fiche = versFiche(paquet(), { achat: 12000, vente: 15000, reference: "lot" });
    expect(fiche).toEqual({
      unite: "pièce",
      prixAchat: 1000,
      prixVenteDefaut: 1250,
      conditionnements: [
        {
          id: "lot",
          nom: "paquet",
          quantite: 12,
          prixAchat: 12000,
          prixVente: 15000,
          codeBarres: null,
        },
      ],
    });
  });

  it("prix fixé à la pièce : le paquet n'a pas de prix propre, il suit la pièce", () => {
    const fiche = versFiche(paquet(), { achat: 12000, vente: 1250, reference: "unite" });
    expect(fiche.prixVenteDefaut).toBe(1250);
    expect(fiche.conditionnements[0].prixVente).toBeNull();
  });

  it("un prix qui ne tombe pas juste s'arrondit au centime à la pièce, jamais au paquet", () => {
    const fiche = versFiche(paquet(), { achat: 10000, vente: 10000, reference: "lot" });
    expect(fiche.prixAchat).toBe(833.33);
    expect(fiche.prixVenteDefaut).toBe(833.33);
    expect(fiche.conditionnements[0]).toMatchObject({ prixAchat: 10000, prixVente: 10000 });
  });
});

describe("ce qui est refusé avant d'écrire", () => {
  const prix: PrixSaisis = { achat: 1, vente: 1, reference: "lot" };
  it("un paquet d'une seule pièce, ou d'une demi-pièce", () => {
    expect(erreurDeLaFiche(paquet("1"), prix)).toMatch(/au moins 2 pièces/);
    expect(erreurDeLaFiche(paquet("2.5"), prix)).toMatch(/nombre entier/);
  });
  it("un carton qui contiendrait des cartons", () => {
    const s = { ...paquet(), unite: "carton", uniteInterne: "carton" };
    expect(erreurDeLaFiche(s, prix)).toMatch(/ne peut pas contenir/);
  });
});

describe("relire une fiche pour la modifier", () => {
  it("le paquet redevient l'unité choisie, et les prix reviennent tels quels", () => {
    const fiche = versFiche(paquet(), { achat: 10000, vente: 10000, reference: "lot" });
    const relu = depuisFiche(fiche);
    expect(relu.saisie).toMatchObject({ unite: "paquet", contenu: "12", uniteInterne: "pièce" });
    expect(relu.prix).toEqual({ achat: 10000, vente: 10000, reference: "lot" });
    // Enregistrer sans rien toucher ne change rien.
    expect(versFiche(relu.saisie, relu.prix)).toEqual(fiche);
  });

  it("un prix de vente fixé à la pièce le reste", () => {
    const fiche = versFiche(paquet(), { achat: 12000, vente: 1300, reference: "unite" });
    expect(depuisFiche(fiche).prix).toEqual({ achat: 12000, vente: 1300, reference: "unite" });
  });

  it("des prix de carton qui ne s'accordent pas avec ceux de l'unité : l'unité fait foi", () => {
    // Le cas réel : paquet à 4 000 / 6 400, carton de 2 paquets noté 4 000 / 20 000.
    const relu = depuisFiche({
      unite: "paquet",
      prixAchat: 4000,
      prixVenteDefaut: 6400,
      conditionnements: [
        {
          id: "c",
          nom: "carton",
          quantite: 2,
          prixAchat: 4000,
          prixVente: 20000,
          codeBarres: null,
        },
      ],
    });
    expect(relu.saisie).toMatchObject({ unite: "carton", contenu: "2", uniteInterne: "paquet" });
    expect(relu.prix).toEqual({ achat: 8000, vente: 6400, reference: "unite" });
    expect(versFiche(relu.saisie, relu.prix)).toMatchObject({
      unite: "paquet",
      prixAchat: 4000,
      prixVenteDefaut: 6400,
    });
  });

  it("les autres conditionnements d'un produit ne sont pas effacés", () => {
    const sac = {
      id: "s",
      nom: "sac",
      quantite: 50,
      prixAchat: null,
      prixVente: null,
      codeBarres: null,
    };
    const relu = depuisFiche({
      unite: "kg",
      prixAchat: 3000,
      prixVenteDefaut: 3500,
      conditionnements: [
        { id: "c", nom: "carton", quantite: 10, prixAchat: null, prixVente: null, codeBarres: "9" },
        sac,
      ],
    });
    const fiche = versFiche(relu.saisie, relu.prix);
    expect(fiche.conditionnements.map((c) => c.nom)).toEqual(["carton", "sac"]);
    expect(fiche.conditionnements[0].codeBarres).toBe("9");
  });
});
