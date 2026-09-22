import { describe, expect, it } from "vitest";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES, V024 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import { resoudreType } from "./resolveur";
import type { Sale } from "../../../types";

/**
 * LA FACTURE DE SERVICE AVEC COMMISSION.
 *
 * Tout tient à une phrase : la commission est une PART du total, pas
 * un supplément. Le client paie la même somme qu'elle soit détaillée
 * ou non ; la caisse, la marge et le stock ne s'en aperçoivent pas.
 * Ces tests tiennent cette promesse, et celle qui va avec — une
 * boutique qui ne saisit jamais de commission ne voit rien changer.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const base = { produits: PRODUITS, boutique: BOUTIQUE, paiements: [PAIEMENT], reglages: R };

/** Le même ticket, avec une commission portée par sa première ligne. */
const avecCommission = (montant: number): Sale[] =>
  TICKET_TROIS_LIGNES.map((v, i) => (i === 0 ? { ...v, commission: montant } : v));

describe("sans commission, rien ne change", () => {
  it("ne détaille rien et reste une facture ordinaire", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.totaux.commission).toBeNull();
    expect(d.type).toBe("facture");
  });
});

describe("la commission est une part du total", () => {
  const d = () => documentDeVente({ ...base, ventes: avecCommission(50000) });

  it("ne change pas d'un ariary ce que le client paie", () => {
    const sans = documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES });
    expect(d().totaux.total).toBe(sans.totaux.total);
    expect(d().totaux.paye).toBe(sans.totaux.paye);
    expect(d().totaux.reste).toBe(sans.totaux.reste);
  });

  it("se détaille en deux lignes dont la somme est le total", () => {
    const c = d().totaux.commission;
    expect(c).not.toBeNull();
    expect(c!.montant).toBe(50000);
    expect((c!.prestation ?? 0) + c!.montant).toBe(d().totaux.total);
    expect(c!.libellePrestation).toBe("Prestation");
    expect(c!.libelle).toBe("Commission");
  });

  it("additionne les commissions du ticket, comme les montants", () => {
    const ventes = TICKET_TROIS_LIGNES.map((v, i) =>
      i === 0 ? { ...v, commission: 30000 } : i === 1 ? { ...v, commission: 20000 } : v,
    );
    expect(documentDeVente({ ...base, ventes }).totaux.commission?.montant).toBe(50000);
  });
});

describe("le mode d'affichage est un réglage", () => {
  it("laisse la commission comprise quand la boutique le demande", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      types: { commission: { commissionSeparee: false } },
    };
    const d = documentDeVente({ ...base, ventes: avecCommission(50000), reglages });
    expect(d.totaux.commission).toBeNull();
    // Le total, lui, est le même dans les deux modes.
    expect(d.totaux.total).toBe(307500);
  });

  it("se détaille par défaut", () => {
    expect(resoudreType(R, "commission").commissionSeparee).toBe(true);
  });

  it("accepte des mots à elle", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      pages: {
        commission: {
          "totaux.prestation": { libelle: "Montant reversé" },
          "totaux.commission": { libelle: "Notre part" },
        },
      },
    };
    const c = documentDeVente({ ...base, ventes: avecCommission(50000), reglages }).totaux
      .commission;
    expect(c?.libellePrestation).toBe("Montant reversé");
    expect(c?.libelle).toBe("Notre part");
  });
});

describe("le type « commission » ne s'invite pas", () => {
  it("n'existe que lorsque la vente en porte une", () => {
    expect(documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES }).type).toBe("facture");
    expect(documentDeVente({ ...base, ventes: avecCommission(50000) }).type).toBe("commission");
  });

  it("laisse le reçu tranquille : il constate un paiement, il ne détaille pas", () => {
    const d = documentDeVente({ ...base, ventes: avecCommission(50000), type: "recu" });
    expect(d.type).toBe("recu");
    expect(d.totaux.commission).toBeNull();
  });

  it("prend ses propres titre et préfixe quand la boutique les règle", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      types: { commission: { titre: "FACTURE DE SERVICE", prefixe: "FS-" } },
    };
    const d = documentDeVente({ ...base, ventes: avecCommission(50000), reglages });
    expect(d.titre).toBe("FACTURE DE SERVICE");
    expect(d.numero).toBe(`FS-${TICKET_TROIS_LIGNES[0].numero}`);
    // Et la facture ordinaire, elle, n'a pas bougé.
    expect(documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES, reglages }).titre).toBe(
      "FACTURE",
    );
  });
});
