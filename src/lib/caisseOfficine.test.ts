import { describe, expect, it } from "vitest";
import type { Payment, Sale } from "../types";
import { caisseDuJour, ecartDuTiroir } from "./caisseOfficine";

const vente = (v: Partial<Sale>): Sale =>
  ({
    id: "v",
    numero: "V1",
    date: "2026-11-21",
    productId: "p",
    designation: "Paracétamol 500 mg",
    quantite: 1,
    prixVenteUnit: 1000,
    totalVente: 1000,
    prixAchatUnitRef: 600,
    totalAchatRef: 600,
    margeTotale: 400,
    vendeur: "Hanitra",
    commission: 0,
    montantPaye: 1000,
    montantRembourse: 0,
    montantAvoire: 0,
    soldeDu: 0,
    statutCredit: "Payé",
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

describe("caisseDuJour", () => {
  it("additionne la recette, l'argent reçu par moyen et les crédits du jour", () => {
    const ventes = [
      vente({ id: "a", ticketId: "t1", totalVente: 3000, montantPaye: 3000 }),
      vente({ id: "b", ticketId: "t1", totalVente: 2000, montantPaye: 2000 }),
      vente({
        id: "c",
        ticketId: "t2",
        totalVente: 10000,
        montantPaye: 3000,
        soldeDu: 7000,
        clientId: "ostie",
        clientCredit: "OSTIE",
      }),
      vente({ id: "d", ticketId: "t3", totalVente: 4000, montantPaye: 0, soldeDu: 4000 }),
      vente({ id: "hier", date: "2026-11-20", totalVente: 5000, soldeDu: 0 }),
    ];
    const paiements = [
      paiement({ saleId: "a", montant: 3000 }),
      paiement({ saleId: "b", montant: 2000, methode: "mobile_money" }),
      paiement({ saleId: "c", montant: 3000 }),
      // Un crédit d'hier réglé aujourd'hui entre dans la caisse d'aujourd'hui.
      paiement({ saleId: "hier", montant: 5000 }),
      // Un paiement d'hier n'y entre pas.
      paiement({ saleId: "hier", montant: 999, createdAt: "2026-11-20T18:00:00" }),
    ];
    const c = caisseDuJour("2026-11-21", ventes, paiements, new Set(["ostie"]));
    expect(c.vendu).toBe(19000);
    expect(c.recu).toBe(13000);
    expect(c.especes).toBe(11000);
    expect(c.parMoyen[0]).toEqual({ methode: "especes", montant: 11000, nombre: 3 });
    expect(c.reglementsAnterieurs).toBe(5000);
    expect(c.creditTiers).toBe(7000);
    expect(c.creditPatients).toBe(4000);
    expect(c.tickets).toHaveLength(3);
    expect(c.tickets.find((t) => t.cle === "t2")?.tiers).toBe(true);
  });

  it("ne compte pas les lignes fabriquées depuis les commandes", () => {
    const c = caisseDuJour("2026-11-21", [vente({ origine: "commande" })], [], new Set());
    expect(c.vendu).toBe(0);
    expect(c.tickets).toHaveLength(0);
  });
});

describe("ecartDuTiroir", () => {
  it("compare le tiroir compté au fond plus les espèces reçues", () => {
    expect(ecartDuTiroir(20000, 11000, 31000)).toBe(0);
    expect(ecartDuTiroir(20000, 11000, 30000)).toBe(-1000);
    expect(ecartDuTiroir(20000, 11000, 32000)).toBe(1000);
  });
});
