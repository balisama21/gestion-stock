import { describe, it, expect } from "vitest";
import type { Sale } from "../../types";
import { repartirLePaiement, resteDuTicket } from "./paiement";

const ligne = (id: string, total: number, paye: number): Sale => ({
  id,
  numero: "V001",
  date: "2026-09-20",
  productId: "p1",
  designation: "Article",
  quantite: 1,
  prixVenteUnit: total,
  totalVente: total,
  prixAchatUnitRef: 0,
  totalAchatRef: 0,
  margeTotale: total,
  vendeur: "Hanta",
  commission: 0,
  montantPaye: paye,
  montantRembourse: 0,
  soldeDu: total - paye,
  statutCredit: paye >= total ? "Payé" : paye > 0 ? "Partiel" : "Impayé",
  ticketId: "T1",
});

describe("la répartition d'un règlement sur les lignes d'un ticket", () => {
  const ticket = [ligne("a", 30_000, 0), ligne("b", 20_000, 0), ligne("c", 50_000, 0)];

  it("solde chaque ligne avant d'entamer la suivante", () => {
    expect(repartirLePaiement(ticket, 40_000)).toEqual([
      { saleId: "a", montant: 30_000 },
      { saleId: "b", montant: 10_000 },
    ]);
  });

  it("un règlement complet touche toutes les lignes", () => {
    const parts = repartirLePaiement(ticket, 100_000);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((n, p) => n + p.montant, 0)).toBe(100_000);
  });

  it("ce qui dépasse le dû n'est pas réparti", () => {
    const parts = repartirLePaiement(ticket, 150_000);
    expect(parts.reduce((n, p) => n + p.montant, 0)).toBe(100_000);
  });

  it("saute les lignes déjà soldées", () => {
    const partiel = [ligne("a", 30_000, 30_000), ligne("b", 20_000, 0)];
    expect(repartirLePaiement(partiel, 20_000)).toEqual([{ saleId: "b", montant: 20_000 }]);
  });

  it("un montant nul ou négatif ne produit aucune écriture", () => {
    expect(repartirLePaiement(ticket, 0)).toEqual([]);
    expect(repartirLePaiement(ticket, -5_000)).toEqual([]);
  });

  it("la somme répartie n'excède jamais ce que le ticket doit", () => {
    for (const montant of [1, 999, 50_000, 99_999, 100_000, 200_000]) {
      const total = repartirLePaiement(ticket, montant).reduce((n, p) => n + p.montant, 0);
      expect(total).toBeLessThanOrEqual(resteDuTicket(ticket));
      expect(total).toBeLessThanOrEqual(montant);
    }
  });
});

describe("le reste d'un ticket", () => {
  it("additionne les soldes de ses lignes", () => {
    expect(resteDuTicket([ligne("a", 30_000, 10_000), ligne("b", 20_000, 0)])).toBe(40_000);
  });

  it("ignore un solde négatif, qui n'est pas une créance", () => {
    const trop = { ...ligne("a", 30_000, 30_000), soldeDu: -5_000 };
    expect(resteDuTicket([trop])).toBe(0);
  });
});
