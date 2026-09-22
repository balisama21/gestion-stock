import { describe, it, expect } from "vitest";
import type { DocumentCommercial } from "./documents";
import {
  lienEmail,
  lienWhatsApp,
  messageDEnvoi,
  messageDeRelance,
  numeroWhatsApp,
  objetDuCourrier,
} from "./envoi";

const doc = (p: Partial<DocumentCommercial> = {}): DocumentCommercial => ({
  cle: "vente:T1",
  entite: "vente",
  entiteId: "T1",
  type: "facture",
  numero: "FAC-V001",
  numeroBrut: "V001",
  date: "2026-09-01",
  echeance: "2026-09-16",
  tiers: "Rakoto",
  clientId: null,
  vendeur: "Hanta",
  auteurId: null,
  montant: 250_000,
  paye: 0,
  reste: 250_000,
  statut: "retard",
  avoirDe: null,
  ventes: [],
  devis: null,
  lignesDevis: [],
  factureAchat: null,
  avoir: null,
  reference: null,
  ...p,
});

const contexte = (d = doc()) => ({
  document: d,
  nomBoutique: "Ma Boutique",
  montant: "250 000 Ar",
  reste: "250 000 Ar",
  echeance: "16/09/2026",
  aujourdhui: "2026-09-22",
});

describe("le numéro au format que WhatsApp exige", () => {
  it("ajoute l'indicatif à un numéro local", () => {
    expect(numeroWhatsApp("034 00 000 01")).toBe("261340000001");
  });

  it("garde un numéro déjà international", () => {
    expect(numeroWhatsApp("+261 34 00 000 01")).toBe("261340000001");
    expect(numeroWhatsApp("261340000001")).toBe("261340000001");
  });

  it("refuse ce qu'il ne sait pas lire, plutôt que d'inventer", () => {
    expect(numeroWhatsApp("12345")).toBeNull();
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp("55 12 34 56")).toBeNull();
  });
});

describe("les liens", () => {
  it("le lien WhatsApp porte le message encodé", () => {
    const lien = lienWhatsApp("0340000001", "Bonjour & merci");
    expect(lien).toContain("https://wa.me/261340000001?text=");
    expect(lien).toContain(encodeURIComponent("Bonjour & merci"));
  });

  it("pas de numéro lisible, pas de lien", () => {
    expect(lienWhatsApp("12345", "Bonjour")).toBeNull();
  });

  it("le lien de courrier porte l'objet et le corps", () => {
    const lien = lienEmail("client@exemple.mg", "Facture FAC-V001", "Bonjour");
    expect(lien).toContain("mailto:");
    expect(lien).toContain(encodeURIComponent("Facture FAC-V001"));
  });

  it("une adresse sans arobase ne donne aucun lien", () => {
    expect(lienEmail("pas-une-adresse", "objet", "corps")).toBeNull();
    expect(lienEmail(null, "objet", "corps")).toBeNull();
  });
});

describe("le message d'envoi", () => {
  it("nomme le client, la pièce, le numéro et le montant", () => {
    const m = messageDEnvoi(contexte());
    expect(m).toContain("Rakoto");
    expect(m).toContain("facture FAC-V001");
    expect(m).toContain("250 000 Ar");
    expect(m).toContain("Ma Boutique");
  });

  it("ne salue pas « Client comptoir » par son nom", () => {
    const m = messageDEnvoi(contexte(doc({ tiers: "Client comptoir" })));
    expect(m).not.toContain("Client comptoir");
    expect(m.startsWith("Bonjour,")).toBe(true);
  });

  it("ne réclame rien sur une pièce soldée", () => {
    const m = messageDEnvoi(contexte(doc({ reste: 0, paye: 250_000, statut: "payee" })));
    expect(m).not.toContain("Reste à régler");
  });

  it("un devis demande une réponse plutôt qu'un règlement", () => {
    const m = messageDEnvoi(
      contexte(doc({ entite: "devis", type: "devis", reste: 0, statut: "attente" })),
    );
    expect(m).toContain("devis");
    expect(m).toContain("si cette offre vous convient");
  });
});

describe("le message de relance", () => {
  it("dit le numéro, le montant dû et le nombre de jours de retard", () => {
    const m = messageDeRelance(contexte());
    expect(m).toContain("FAC-V001");
    expect(m).toContain("250 000 Ar");
    expect(m).toContain("6 jours");
  });

  it("ne parle pas de retard quand l'échéance n'est pas passée", () => {
    const m = messageDeRelance(contexte(doc({ echeance: "2026-12-31" })));
    expect(m).not.toContain("Le retard est de");
  });
});

describe("l'objet du courrier", () => {
  it("annonce la pièce et la boutique", () => {
    expect(objetDuCourrier(doc(), "Ma Boutique")).toBe("Facture FAC-V001 — Ma Boutique");
  });

  it("une relance le dit dès l'objet", () => {
    expect(objetDuCourrier(doc(), "Ma Boutique", true)).toContain("Rappel —");
  });
});
