import { describe, it, expect } from "vitest";
import {
  echeanceExigible,
  joursDeRetard,
  statutDOffre,
  statutDeFacture,
  statutDeFactureAchat,
  LIBELLE_STATUT,
  CLASSE_STATUT,
  type EtatFacture,
} from "./statuts";

const facture = (p: Partial<EtatFacture> = {}): EtatFacture => ({
  montant: 100_000,
  paye: 0,
  annulee: false,
  envoyee: false,
  echeance: "2026-09-30",
  aujourdhui: "2026-09-22",
  ...p,
});

describe("le statut d'une facture", () => {
  it("part d'« Émise » quand rien ne s'est encore passé", () => {
    expect(statutDeFacture(facture())).toBe("emise");
  });

  it("passe à « Envoyée » dès qu'un envoi est enregistré", () => {
    expect(statutDeFacture(facture({ envoyee: true }))).toBe("envoyee");
  });

  it("passe à « Partiellement payée » au premier règlement", () => {
    expect(statutDeFacture(facture({ paye: 40_000 }))).toBe("partiel");
  });

  it("passe à « Payée » quand le solde tombe à zéro", () => {
    expect(statutDeFacture(facture({ paye: 100_000 }))).toBe("payee");
  });

  it("dit « Payée » plutôt qu'« En retard » quand tout est réglé", () => {
    expect(statutDeFacture(facture({ paye: 100_000, echeance: "2026-01-01" }))).toBe("payee");
  });

  it("le retard passe devant le paiement partiel", () => {
    expect(statutDeFacture(facture({ paye: 40_000, echeance: "2026-09-21" }))).toBe("retard");
  });

  it("l'annulation passe devant tout le reste", () => {
    expect(
      statutDeFacture(facture({ annulee: true, paye: 100_000, echeance: "2026-01-01" })),
    ).toBe("annulee");
  });
});

describe("le jour exact où le retard se déclenche", () => {
  const veille = facture({ echeance: "2026-09-30", aujourdhui: "2026-09-29" });
  const jourJ = facture({ echeance: "2026-09-30", aujourdhui: "2026-09-30" });
  const lendemain = facture({ echeance: "2026-09-30", aujourdhui: "2026-10-01" });

  it("la veille, rien", () => expect(statutDeFacture(veille)).toBe("emise"));

  it("le jour de l'échéance, rien non plus — on a la journée pour payer", () =>
    expect(statutDeFacture(jourJ)).toBe("emise"));

  it("le lendemain, en retard", () => expect(statutDeFacture(lendemain)).toBe("retard"));
});

describe("l'échéance exigible", () => {
  it("ajoute les jours du réglage", () => {
    expect(echeanceExigible("2026-09-22", "sous_30_jours")).toBe("2026-10-22");
    expect(echeanceExigible("2026-09-22", "sous_15_jours")).toBe("2026-10-07");
  });

  it("« à réception » vaut le jour du document : une créance d'hier est en retard", () => {
    expect(echeanceExigible("2026-09-22", "a_reception")).toBe("2026-09-22");
    expect(echeanceExigible("2026-09-22", "comptant")).toBe("2026-09-22");
  });

  it("franchit les mois et les années sans se décaler", () => {
    expect(echeanceExigible("2026-12-20", "sous_30_jours")).toBe("2027-01-19");
  });
});

describe("le compte des jours de retard", () => {
  it("compte les jours écoulés depuis l'échéance", () => {
    expect(joursDeRetard("2026-09-01", "2026-09-22")).toBe(21);
  });

  it("ne compte rien avant l'échéance", () => {
    expect(joursDeRetard("2026-10-01", "2026-09-22")).toBe(0);
    expect(joursDeRetard("2026-09-22", "2026-09-22")).toBe(0);
  });
});

describe("le statut d'un devis ou d'une proforma", () => {
  it("une offre sans réponse est en attente", () => {
    expect(statutDOffre("envoye", "2026-12-31", null, "2026-09-22")).toBe("attente");
  });

  it("une offre dont la validité est passée est expirée", () => {
    expect(statutDOffre("envoye", "2026-09-01", null, "2026-09-22")).toBe("expire");
  });

  it("une offre acceptée ne devient jamais expirée", () => {
    expect(statutDOffre("accepte", "2026-01-01", null, "2026-09-22")).toBe("accepte");
  });

  it("une offre convertie le dit, quoi qu'en dise son statut enregistré", () => {
    expect(statutDOffre("envoye", "2026-01-01", "ticket-1", "2026-09-22")).toBe("converti");
  });

  it("un brouillon reste un brouillon", () => {
    expect(statutDOffre("brouillon", null, null, "2026-09-22")).toBe("brouillon");
  });
});

describe("le statut d'une facture reçue", () => {
  it("à payer, partiellement payée, payée", () => {
    expect(statutDeFactureAchat(500_000, 0)).toBe("a_payer");
    expect(statutDeFactureAchat(500_000, 200_000)).toBe("partiel");
    expect(statutDeFactureAchat(500_000, 500_000)).toBe("payee");
  });

  it("un trop-perçu reste « Payée », jamais un reste négatif", () => {
    expect(statutDeFactureAchat(500_000, 600_000)).toBe("payee");
  });
});

describe("chaque statut porte un mot et une couleur", () => {
  it("aucun statut n'est muet", () => {
    for (const [cle, libelle] of Object.entries(LIBELLE_STATUT)) {
      expect(libelle.length, cle).toBeGreaterThan(0);
      expect(CLASSE_STATUT[cle as keyof typeof CLASSE_STATUT], cle).toBeTruthy();
    }
  });
});
