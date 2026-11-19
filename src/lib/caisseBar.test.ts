import { describe, expect, it } from "vitest";
import { recapCaisse, veille } from "./caisseBar";
import type { Payment, Sale } from "../types";
import type { LigneNote } from "./bar";

const vente = (p: Partial<Sale>): Sale =>
  ({
    id: "v",
    numero: "V1",
    date: "2026-11-19",
    productId: "thb",
    designation: "THB",
    quantite: 1,
    prixVenteUnit: 5000,
    totalVente: 5000,
    prixAchatUnitRef: 0,
    totalAchatRef: 0,
    margeTotale: 0,
    vendeur: "Caisse",
    commission: 0,
    montantPaye: 5000,
    montantRembourse: 0,
    montantAvoire: 0,
    soldeDu: 0,
    statutCredit: "Payé",
    ...p,
  }) as Sale;

const paiement = (p: Partial<Payment>): Payment => ({
  id: "p",
  numero: "P1",
  orderId: null,
  saleId: "v",
  montant: 0,
  methode: "especes",
  reference: null,
  note: null,
  createdAt: "2026-11-19T21:00:00",
  ...p,
});

const ligne = (p: Partial<LigneNote>): LigneNote => ({
  id: "l",
  store_id: "s",
  note_id: "n",
  product_id: "thb",
  designation: "THB",
  genre: "article",
  quantite: 1,
  prix_unit: 5000,
  offert: false,
  serveur: null,
  annulee: false,
  motif: null,
  sale_id: null,
  cree_le: "2026-11-19T21:00:00",
  ...p,
});

describe("la caisse de la soirée", () => {
  const ventes = [
    vente({ id: "a", ticketId: "t1", totalVente: 30000, soldeDu: 0 }),
    vente({ id: "b", ticketId: "t1", totalVente: 20000, soldeDu: 0, productId: "" }),
    vente({ id: "c", ticketId: "t2", totalVente: 15000, soldeDu: 5000 }),
    vente({ id: "d", date: "2026-11-18", totalVente: 99999 }),
  ];
  const paiements = [
    paiement({ saleId: "a", montant: 30000, methode: "especes" }),
    paiement({ saleId: "b", montant: 20000, methode: "mobile_money" }),
    paiement({ saleId: "c", montant: 10000, methode: "especes" }),
    // Un vieux crédit réglé ce soir entre dans la caisse de ce soir.
    paiement({ saleId: "d", montant: 7000, methode: "especes" }),
    paiement({ saleId: "d", montant: 1000, createdAt: "2026-11-18T22:00:00" }),
  ];
  const lignes = [
    ligne({ id: "1", sale_id: "a", quantite: 6, serveur: "Rado" }),
    ligne({ id: "2", sale_id: "a", quantite: 1, offert: true, serveur: "Rado" }),
    ligne({ id: "3", sale_id: "c", quantite: 3, serveur: "Fara" }),
    ligne({ id: "4", sale_id: "b", genre: "droit_table", product_id: null, prix_unit: 20000 }),
    ligne({ id: "5", annulee: true, quantite: 2 }),
    ligne({ id: "6", annulee: true, quantite: 2, cree_le: "2026-11-18T23:00:00" }),
  ];

  it("compte le vendu du jour, l'argent reçu par moyen et le crédit", () => {
    const r = recapCaisse("2026-11-19", ventes, paiements, lignes);
    expect(r.vendu).toBe(65000);
    expect(r.recu).toBe(67000);
    expect(r.parMoyen).toEqual([
      { methode: "especes", montant: 47000, nombre: 3 },
      { methode: "mobile_money", montant: 20000, nombre: 1 },
    ]);
    expect(r.aCredit).toBe(5000);
    expect(r.additions).toBe(2);
  });

  it("met à part les offerts, les annulations et ce que chaque serveur a servi", () => {
    const r = recapCaisse("2026-11-19", ventes, paiements, lignes);
    expect(r.offerts).toBe(5000);
    expect(r.annule).toBe(10000);
    expect(r.parServeur).toEqual([
      { serveur: "Rado", montant: 30000, articles: 7 },
      { serveur: "Fara", montant: 15000, articles: 3 },
    ]);
  });

  it("sait reculer d'un jour, même un premier du mois", () => {
    expect(veille("2026-12-01")).toBe("2026-11-30");
    expect(veille("2027-01-01")).toBe("2026-12-31");
  });
});
