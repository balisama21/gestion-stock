import { describe, it, expect } from "vitest";
import type { Sale } from "../../types";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../../features/documents/lib/reglages";
import { construirePeriode } from "../../features/dashboard-v2/hooks/useDashboardPeriod";
import { chiffresVentes, chiffresFlux } from "../../features/dashboard-v2/lib/chiffres";
import type { SourcesChiffres } from "../../features/dashboard-v2/lib/chiffres";
import { construireDocuments } from "./documents";
import { calculerIndicateurs, compterLesRetards } from "./indicateurs";

const AUJOURDHUI = "2026-09-22";

const vente = (p: Partial<Sale> & { id: string }): Sale => ({
  numero: "V001",
  date: "2026-09-20",
  productId: "p1",
  designation: "Article",
  quantite: 1,
  prixVenteUnit: 100_000,
  totalVente: 100_000,
  prixAchatUnitRef: 60_000,
  totalAchatRef: 60_000,
  margeTotale: 40_000,
  vendeur: "Hanta",
  commission: 0,
  montantPaye: 0,
  montantRembourse: 0,
  soldeDu: 100_000,
  statutCredit: "Impayé",
  ...p,
});

const VENTES: Sale[] = [
  // Payée
  vente({ id: "a", ticketId: "T1", numero: "V001", date: "2026-09-05", totalVente: 200_000, montantPaye: 200_000, soldeDu: 0, statutCredit: "Payé" }),
  // Partiellement payée, échéance à venir (le réglage par défaut est
  // « sous 15 jours » : celle-ci est exigible le 7 octobre)
  vente({ id: "b", ticketId: "T2", numero: "V002", date: "2026-09-22", totalVente: 150_000, montantPaye: 50_000, soldeDu: 100_000, statutCredit: "Partiel" }),
  // En retard : exigible le 16 septembre, toujours impayée
  vente({ id: "c", ticketId: "T3", numero: "V003", date: "2026-09-01", totalVente: 300_000, montantPaye: 0, soldeDu: 300_000 }),
  // Hors période : le mois dernier
  vente({ id: "d", ticketId: "T4", numero: "V004", date: "2026-08-15", totalVente: 90_000, montantPaye: 0, soldeDu: 90_000 }),
];

const PAIEMENTS = [
  { montant: 200_000, createdAt: "2026-09-05T09:00:00+03:00" },
  { montant: 50_000, createdAt: "2026-09-22T11:30:00+03:00" },
  { montant: 90_000, createdAt: "2026-08-15T08:00:00+03:00" },
];

const documents = (sales = VENTES) =>
  construireDocuments({
    sales,
    payments: [],
    quotes: [],
    quoteItems: [],
    facturesAchat: [],
    avoirs: [],
    envois: new Set(),
    recus: new Set(),
    reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
    aujourdhui: AUJOURDHUI,
  });

const periodeDuMois = construirePeriode(
  "month",
  { debut: "2026-09-01", fin: AUJOURDHUI },
  AUJOURDHUI,
);

describe("les quatre chiffres du haut de page", () => {
  const i = calculerIndicateurs({
    documents: documents(),
    payments: PAIEMENTS,
    intervalle: periodeDuMois.intervalle,
  });

  it("« À encaisser » additionne ce qui reste dû sur la période", () => {
    expect(i.aEncaisser.montant).toBe(400_000);
    expect(i.aEncaisser.nombre).toBe(2);
  });

  it("« En retard » n'en garde que la part dont l'échéance est passée", () => {
    expect(i.enRetard.montant).toBe(300_000);
    expect(i.enRetard.nombre).toBe(1);
  });

  it("« Encaissé » additionne les règlements du mois, pas ceux d'avant", () => {
    expect(i.encaisse.montant).toBe(250_000);
  });

  it("le retard est une PART de ce qui reste à encaisser, jamais un supplément", () => {
    expect(i.enRetard.montant).toBeLessThanOrEqual(i.aEncaisser.montant);
  });
});

describe("les mêmes chiffres que le tableau de bord, sur la même période", () => {
  const sources: SourcesChiffres = {
    sales: VENTES,
    purchases: [],
    expenses: [],
    products: [],
    payments: PAIEMENTS,
    sellers: [],
    capital: {
      capitalInitial: 0,
      apportsTotal: 0,
      ventesTotalEncaisse: 0,
      achatsTotal: 0,
      depensesVendeursTotal: 0,
      remboursementsTotal: 0,
      tresorerieGlobaleActuelle: 0,
      seuilAlerteTresorerie: 0,
    },
    orders: [],
    clients: [],
    quotes: [],
    deliveries: [],
    taches: [],
    mouvements: [],
  };

  const ventes = chiffresVentes(sources, periodeDuMois);
  const flux = chiffresFlux(sources, periodeDuMois, ventes);
  const i = calculerIndicateurs({
    documents: documents(),
    payments: PAIEMENTS,
    intervalle: periodeDuMois.intervalle,
  });

  it("le chiffre d'affaires facturé est celui du tableau de bord", () => {
    expect(i.facture.montant).toBe(ventes.total);
  });

  it("l'encaissé est celui du tableau de bord", () => {
    expect(i.encaisse.montant).toBe(flux.encaisse);
  });

  it("le nombre de pièces est le nombre de tickets, pas le nombre de lignes", () => {
    expect(i.facture.nombre).toBe(ventes.tickets);
  });
});

describe("une facture annulée ne compte plus", () => {
  it("elle sort du chiffre d'affaires et de ce qui reste à encaisser", () => {
    const docs = construireDocuments({
      sales: [vente({ id: "c", ticketId: "T3", date: "2026-09-01", totalVente: 300_000, soldeDu: 300_000 })],
      payments: [],
      quotes: [],
      quoteItems: [],
      facturesAchat: [],
      avoirs: [
        {
          id: "av1",
          store_id: "s",
          numero: "AV001",
          date: "2026-09-21",
          ticket_id: "T3",
          facture_numero: "FAC-V003",
          client_id: null,
          client_nom: "",
          motif: "Retour complet",
          montant: 300_000,
          created_by: null,
          created_at: "",
        },
      ],
      envois: new Set(),
      recus: new Set(),
      reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
      aujourdhui: AUJOURDHUI,
    });
    const i = calculerIndicateurs({
      documents: docs,
      payments: [],
      intervalle: periodeDuMois.intervalle,
    });
    expect(i.facture.montant).toBe(0);
    expect(i.aEncaisser.montant).toBe(0);
    expect(i.enRetard.montant).toBe(0);
  });
});

describe("le badge du menu", () => {
  it("compte les retards sans se soucier de la période choisie", () => {
    expect(compterLesRetards(documents())).toBe(2);
  });

  it("ne compte rien quand tout est réglé", () => {
    const soldees = VENTES.map((v) => ({ ...v, montantPaye: v.totalVente, soldeDu: 0 }));
    expect(compterLesRetards(documents(soldees))).toBe(0);
  });
});
