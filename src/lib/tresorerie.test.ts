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

  it("une vente à crédit n'entre qu'à son paiement", () => {
    const credit = calculerTresorerie({ ...base, ventes: [...base.ventes, { montantPaye: 0 }] });
    expect(credit.tresorerieGlobaleActuelle).toBe(
      calculerTresorerie(base).tresorerieGlobaleActuelle,
    );
  });
});
