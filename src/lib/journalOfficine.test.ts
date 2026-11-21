import { describe, expect, it } from "vitest";
import type { Expense, Payment, Purchase, Sale } from "../types";
import { journalOfficine, parJour } from "./journalOfficine";

const vente = (v: Partial<Sale>): Sale =>
  ({
    id: "v",
    numero: "V1",
    date: "2026-11-21",
    productId: "p",
    designation: "Paracétamol 500 mg",
    quantite: 1,
    totalVente: 1000,
    margeTotale: 400,
    vendeur: "Hanitra",
    montantPaye: 1000,
    soldeDu: 0,
    ...v,
  }) as Sale;

const paiement = (p: Partial<Payment>): Payment => ({
  id: "pay",
  numero: "PAY1",
  orderId: null,
  saleId: "v",
  montant: 1000,
  methode: "especes",
  reference: null,
  note: null,
  createdAt: "2026-11-21T09:00:00",
  ...p,
});

describe("journalOfficine", () => {
  const ecritures = journalOfficine({
    ventes: [
      vente({ id: "a", ticketId: "t1", designation: "Paracétamol 500 mg" }),
      vente({ id: "b", ticketId: "t1", designation: "Zinc 20 mg", quantite: 2 }),
      vente({ id: "ancienne", date: "2026-11-10", clientCredit: "Marie R." }),
    ],
    paiements: [
      paiement({ id: "1", saleId: "a", montant: 1000 }),
      paiement({ id: "2", saleId: "b", montant: 2600, methode: "mobile_money" }),
      paiement({ id: "3", saleId: "ancienne", montant: 5000, createdAt: "2026-11-21T15:00:00" }),
    ],
    achats: [
      {
        id: "x",
        date: "2026-11-21",
        fournisseur: "Analamanga",
        totalAchat: 30000,
        montantPaye: 10000,
      },
      {
        id: "y",
        date: "2026-11-21",
        fournisseur: "Analamanga",
        totalAchat: 20000,
        montantPaye: 20000,
      },
    ] as Purchase[],
    depenses: [
      {
        id: "d",
        date: "2026-11-20",
        type: "Autre dépense",
        montant: 8000,
        note: "Sacs",
        vendeur: "Fara",
      },
    ] as Expense[],
    apports: [],
  });

  it("regroupe l'argent d'un même client servi, et met les crédits réglés à part", () => {
    const comptoir = ecritures.find((e) => e.genre === "encaissement")!;
    expect(comptoir.montant).toBe(3600);
    expect(comptoir.titre).toBe("Paracétamol 500 mg, Zinc 20 mg × 2");
    expect(comptoir.detail).toContain("Espèces + Mobile Money");
    const reglement = ecritures.find((e) => e.genre === "reglement")!;
    expect(reglement.titre).toBe("Règlement de crédit · Marie R.");
    expect(reglement.jour).toBe("2026-11-21");
  });

  it("compte une livraison par grossiste et par jour, à ce qui a été payé", () => {
    const livraison = ecritures.filter((e) => e.genre === "reception");
    expect(livraison).toHaveLength(1);
    expect(livraison[0].montant).toBe(-30000);
    expect(livraison[0].aCredit).toBe(true);
  });

  it("range par jour avec les entrées et les sorties", () => {
    const jours = parJour(ecritures);
    expect(jours.map((j) => j.jour)).toEqual(["2026-11-21", "2026-11-20"]);
    expect(jours[0].entrees).toBe(8600);
    expect(jours[0].sorties).toBe(30000);
    expect(jours[1].sorties).toBe(8000);
  });
});
