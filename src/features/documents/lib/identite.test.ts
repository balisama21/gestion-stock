import { describe, expect, it } from "vitest";
import {
  IDENTITE_PAR_DEFAUT,
  identiteVide,
  ligneDesIdentifiants,
  ligneEnLigne,
  lignesDePaiement,
  lignesDesContacts,
  lireIdentite,
} from "./identite";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, PRODUITS, V024 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, lireReglagesDocuments } from "./reglages";

/**
 * L'IDENTITÉ COMMUNE, ET LA PROMESSE QU'ELLE NE CHANGE RIEN.
 *
 * Le premier bloc est le plus important de tout le fichier : une
 * boutique qui n'a rien saisi doit obtenir exactement le document
 * d'avant. Tant qu'il tient, le reste peut évoluer.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const base = { produits: PRODUITS, boutique: BOUTIQUE, reglages: R };

const CONTACT = {
  id: "c1",
  nom: "Mariama",
  mention: "Comores",
  telephone: "+269 32 12 345",
  lieu: "",
  surDocuments: true,
};

describe("sans rien saisir, le document ne bouge pas", () => {
  it("l'en-tête garde ses deux lignes d'avant", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.emetteur.lignes).toEqual([
      "105 Ambohidratrimo",
      "0389723412 · balisamamamy2003@gmail.com",
    ]);
  });

  it("n'imprime aucune coordonnée de paiement", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.coordonneesPaiement).toBeNull();
  });

  it("une boutique sans clé « identite » lit une identité vide", () => {
    expect(identiteVide(lireReglagesDocuments({ modele: "bandeau" }).identite)).toBe(true);
    expect(identiteVide(IDENTITE_PAR_DEFAUT)).toBe(true);
  });
});

describe("la lecture de la colonne JSON", () => {
  it("écarte une ligne restée entièrement blanche", () => {
    const i = lireIdentite({
      contacts: [CONTACT, { nom: "", mention: "", telephone: "", lieu: "" }],
      identifiants: [{ libelle: "", valeur: "" }],
      paiement: { mobileMoney: [{ operateur: "", numero: "" }] },
    });
    expect(i.contacts).toHaveLength(1);
    expect(i.identifiants).toEqual([]);
    expect(i.paiement.mobileMoney).toEqual([]);
  });

  it("donne une clé de liste à un enregistrement qui n'en a pas", () => {
    const i = lireIdentite({ contacts: [{ nom: "Rakoto" }] });
    expect(i.contacts[0].id).toBeTruthy();
    // Une clé absente veut dire « oui » : on saisit un contact pour le voir.
    expect(i.contacts[0].surDocuments).toBe(true);
  });

  it("ne fait pas confiance à ce qu'elle trouve", () => {
    const i = lireIdentite({ contacts: "oui", reseaux: 12, paiement: null, siteWeb: [] });
    expect(i).toEqual(IDENTITE_PAR_DEFAUT);
  });
});

describe("de l'identité au papier", () => {
  it("compose une ligne de contact sans séparateur orphelin", () => {
    expect(lignesDesContacts(lireIdentite({ contacts: [CONTACT] }))).toEqual([
      "Mariama · Comores · +269 32 12 345",
    ]);
  });

  it("laisse de côté un contact décoché, sans le perdre", () => {
    const i = lireIdentite({ contacts: [{ ...CONTACT, surDocuments: false }] });
    expect(i.contacts).toHaveLength(1);
    expect(lignesDesContacts(i)).toEqual([]);
  });

  it("garde l'ordre de la liste, qui est celui de l'impression", () => {
    const i = lireIdentite({
      contacts: [CONTACT, { id: "c2", nom: "Rakoto", telephone: "034 00 000 00" }],
    });
    expect(lignesDesContacts(i)[1]).toBe("Rakoto · 034 00 000 00");
  });

  it("nomme chaque réseau, parce qu'un pseudo seul ne dit rien", () => {
    const i = lireIdentite({ siteWeb: "maboutique.mg", reseaux: { instagram: "maboutique" } });
    expect(ligneEnLigne(i)).toBe("maboutique.mg · Instagram maboutique");
  });

  it("n'écrit rien quand aucun réseau n'est renseigné", () => {
    expect(ligneEnLigne(IDENTITE_PAR_DEFAUT)).toBeNull();
    expect(ligneDesIdentifiants(IDENTITE_PAR_DEFAUT)).toBeNull();
    expect(lignesDePaiement(IDENTITE_PAR_DEFAUT)).toEqual([]);
  });

  it("colle le libellé à sa valeur, et sépare les identifiants entre eux", () => {
    const i = lireIdentite({
      identifiants: [
        { libelle: "RCS", valeur: "2024-B-112" },
        { libelle: "Licence", valeur: "4478" },
      ],
    });
    expect(ligneDesIdentifiants(i)).toBe("RCS 2024-B-112 · Licence 4478");
  });

  it("imprime un numéro de paiement même sans son opérateur", () => {
    const i = lireIdentite({
      paiement: { mobileMoney: [{ numero: "034 12 345 67" }], banque: "BNI", rib: "MG46 0000" },
    });
    expect(lignesDePaiement(i)).toEqual(["034 12 345 67", "BNI · MG46 0000"]);
  });
});

describe("ce que l'identité ajoute au document", () => {
  const reglages = {
    ...R,
    identite: lireIdentite({
      contacts: [CONTACT],
      siteWeb: "maboutique.mg",
      identifiants: [{ libelle: "RCS", valeur: "2024-B-112" }],
      paiement: { mobileMoney: [{ operateur: "MVola", numero: "034 12 345 67" }] },
    }),
  };

  it("ajoute ses lignes APRÈS celles de « Ma boutique »", () => {
    const d = documentDeVente({ ...base, ventes: [V024], reglages });
    expect(d.emetteur.lignes).toEqual([
      "105 Ambohidratrimo",
      "0389723412 · balisamamamy2003@gmail.com",
      "Mariama · Comores · +269 32 12 345",
      "maboutique.mg",
      "RCS 2024-B-112",
    ]);
  });

  it("indique où payer sur une facture", () => {
    const d = documentDeVente({ ...base, ventes: [V024], reglages });
    expect(d.coordonneesPaiement).toEqual(["MVola · 034 12 345 67"]);
  });

  it("ne l'indique pas sur un reçu, qui constate un paiement déjà fait", () => {
    const d = documentDeVente({ ...base, ventes: [V024], reglages, type: "recu" });
    expect(d.coordonneesPaiement).toBeNull();
  });
});
