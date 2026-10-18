import { describe, expect, it } from "vitest";
import { calculerTresorerie, type SourcesTresorerie } from "./tresorerie";

const base: SourcesTresorerie = {
  capitalInitial: 100000,
  seuilAlerte: 0,
  apports: [{ montant: 20000 }],
  ventes: [{ montantPaye: 13000, montantRembourse: 1000 }],
  commandes: [{ montant_paye: 5000, montant_rembourse: 0 }],
  achats: [{ montantPaye: 10000 }],
  depenses: [{ montant: 4000 }],
};

describe("la trésorerie", () => {
  it("les postes retombent sur le total", () => {
    const t = calculerTresorerie(base);
    expect(t.tresorerieGlobaleActuelle).toBe(
      t.capitalInitial +
        t.apportsTotal +
        t.ventesTotalEncaisse -
        t.achatsTotal -
        t.depensesVendeursTotal -
        t.remboursementsTotal,
    );
    expect(t.tresorerieGlobaleActuelle).toBe(100000 + 20000 + 18000 - 10000 - 4000 - 1000);
  });

  it("un achat à crédit ne sort pas d'argent avant son règlement", () => {
    const avant = calculerTresorerie(base).tresorerieGlobaleActuelle;
    const aCredit = calculerTresorerie({ ...base, achats: [...base.achats, { montantPaye: 0 }] });
    expect(aCredit.tresorerieGlobaleActuelle).toBe(avant);
  });

  it("le règlement d'un fournisseur fait baisser la caisse", () => {
    const regle = calculerTresorerie({
      ...base,
      achats: [{ montantPaye: 10000 }, { montantPaye: 3000 }],
    });
    expect(regle.tresorerieGlobaleActuelle).toBe(
      calculerTresorerie(base).tresorerieGlobaleActuelle - 3000,
    );
  });

  it("les salaires et avances versés sortent de la caisse, et retombent dans l'addition", () => {
    const t = calculerTresorerie({
      ...base,
      salaires: [
        { montant: 50_000, statut: "versee" },
        // La base renvoie parfois un numeric en texte.
        { montant: "110000", statut: "versee" },
      ],
    });
    expect(t.salairesTotal).toBe(160_000);
    expect(t.tresorerieGlobaleActuelle).toBe(
      calculerTresorerie(base).tresorerieGlobaleActuelle - 160_000,
    );
    expect(t.tresorerieGlobaleActuelle).toBe(
      t.capitalInitial +
        t.apportsTotal +
        t.ventesTotalEncaisse -
        t.achatsTotal -
        t.depensesVendeursTotal -
        t.remboursementsTotal -
        t.salairesTotal,
    );
  });

  it("une demande, une approbation ou un refus de salaire ne déplacent pas d'argent", () => {
    const t = calculerTresorerie({
      ...base,
      salaires: ["en_attente", "approuvee", "refusee", "annulee"].map((statut) => ({
        montant: 40_000,
        statut,
      })),
    });
    expect(t.salairesTotal).toBe(0);
    expect(t.tresorerieGlobaleActuelle).toBe(calculerTresorerie(base).tresorerieGlobaleActuelle);
  });

  it("une vente à crédit n'entre qu'à son paiement", () => {
    const credit = calculerTresorerie({ ...base, ventes: [...base.ventes, { montantPaye: 0 }] });
    expect(credit.tresorerieGlobaleActuelle).toBe(
      calculerTresorerie(base).tresorerieGlobaleActuelle,
    );
  });
});
