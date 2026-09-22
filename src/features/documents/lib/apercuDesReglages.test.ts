import { describe, expect, it } from "vitest";
import { apercuDesReglages } from "./apercuDesReglages";
import { BOUTIQUE, PRODUITS, TICKET_TROIS_LIGNES, V024 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import type { TypeDocumentV3 } from "./typesDocument";
import type { Sale } from "../../../types";

/**
 * L'APERÇU DES RÉGLAGES.
 *
 * Deux promesses. Il montre le document qu'on RÈGLE — régler un devis
 * et voir une facture ne renseigne sur rien. Et il ne change aucun
 * chiffre : la même vente, présentée sous six formes, porte six fois
 * le même total.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;

const voir = (type: TypeDocumentV3, reglages: ReglagesDocuments = R, sales = TICKET_TROIS_LIGNES) =>
  apercuDesReglages({ type, sales, produits: PRODUITS, boutique: BOUTIQUE, reglages });

const TOTAL = TICKET_TROIS_LIGNES.reduce((n, v) => n + v.totalVente, 0);

describe("l'aperçu suit le document réglé", () => {
  it.each([
    ["facture", "FACTURE"],
    ["recu", "REÇU"],
    ["devis", "DEVIS"],
    ["proforma", "FACTURE PROFORMA"],
    ["commande", "BON DE COMMANDE"],
    ["facture_achat", "FACTURE D'ACHAT"],
  ] as [TypeDocumentV3, string][])("montre %s sous son propre titre", (type, titre) => {
    expect(voir(type)?.document.titre).toBe(titre);
  });

  it("suit aussi les réglages en cours de saisie, sans rien enregistrer", () => {
    const reglages: ReglagesDocuments = { ...R, types: { devis: { titre: "OFFRE DE PRIX" } } };
    expect(voir("devis", reglages)?.document.titre).toBe("OFFRE DE PRIX");
    // Et la facture, qu'on n'a pas touchée, ne bouge pas.
    expect(voir("facture", reglages)?.document.titre).toBe("FACTURE");
  });

  it("montre la validité telle qu'elle vient d'être réglée", () => {
    const reglages: ReglagesDocuments = { ...R, types: { devis: { validiteJours: 7 } } };
    const meta = voir("devis", reglages)?.document.meta.find(
      (m) => m.libelle === "Valable jusqu'au",
    );
    // La vente est du 13/09/2026 ; sept jours plus tard.
    expect(meta?.valeur).toContain("20/09/2026");
  });
});

describe("la forme change, jamais le chiffre", () => {
  it("porte le même total sous toutes ses formes", () => {
    const types: TypeDocumentV3[] = [
      "facture",
      "recu",
      "devis",
      "proforma",
      "commande",
      "facture_achat",
    ];
    for (const type of types) {
      expect(voir(type)?.document.totaux.total).toBe(TOTAL);
    }
  });

  it("garde les vraies lignes de la vente, dans leur ordre", () => {
    const lignes = voir("devis")?.document.lignes.map((l) => l.designation);
    expect(lignes).toEqual(TICKET_TROIS_LIGNES.map((v) => v.designation));
  });

  it("le dit sous le document, plutôt que de le laisser croire", () => {
    expect(voir("devis")?.mention).toMatch(/présentée comme un devis/);
    expect(voir("facture")?.mention).toMatch(/dernière vente/);
  });
});

describe("la facture reçue reste NOTRE relevé", () => {
  it("garde la boutique en en-tête et prend le fournisseur du produit", () => {
    const d = voir("facture_achat")?.document;
    expect(d?.emetteur.nom).toBe("Ma Boutique");
    expect(d?.destinataire.titre).toBe("Fournisseur");
  });
});

describe("la commission ne s'invente pas", () => {
  it("dit qu'aucune vente n'en porte, au lieu d'en fabriquer une", () => {
    const a = voir("commission");
    expect(a?.mention).toMatch(/Aucune vente ne porte encore de commission/);
    expect(a?.document.totaux.commission).toBeNull();
  });

  it("montre la vente qui en porte une, dès qu'il en existe", () => {
    const avec: Sale[] = [{ ...V024, ticketId: null, commission: 50000 }, ...TICKET_TROIS_LIGNES];
    const a = voir("commission", R, avec);
    expect(a?.document.totaux.commission?.montant).toBe(50000);
    expect(a?.mention).toMatch(/portant une commission/);
  });
});

describe("le bon de commande fournisseur a son aperçu", () => {
  it("il montre les prix d'ACHAT, et non les prix de vente", () => {
    // C'est ce qu'on propose au fournisseur. Reprendre le prix de
    // vente afficherait ce qu'on demande au client.
    const a = voir("achat");
    expect(a).not.toBeNull();
    expect(a?.document.type).toBe("achat");
    expect(a?.mention).toMatch(/bon de commande fournisseur/);
  });

  it("il ne réclame rien : une commande n'est pas une créance", () => {
    const a = voir("achat");
    expect(a?.document.totaux.paye).toBeNull();
    expect(a?.document.totaux.reste).toBeNull();
  });
});

describe("ce qui n'a pas d'aperçu le dit", () => {
  it("rend null quand la boutique n'a encore rien vendu", () => {
    expect(voir("facture", R, [])).toBeNull();
  });
});
