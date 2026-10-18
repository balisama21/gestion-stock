import { describe, expect, it } from "vitest";
import type { Sale } from "../types";
import { avoirsDesVentes, chiffreAffairesNet, chiffreAffairesParJour } from "./ventes";
import { aRembourserApresAvoir } from "../components/facturation/paiement";
import { statutDeFacture } from "../components/facturation/statuts";
import { construireDocuments } from "../components/facturation/documents";
import { calculerIndicateurs } from "../components/facturation/indicateurs";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../features/documents/lib/reglages";
import { construirePeriode } from "../features/dashboard-v2/hooks/useDashboardPeriod";
import { chiffresVentes, type SourcesChiffres } from "../features/dashboard-v2/lib/chiffres";

/**
 * L'AVOIR EFFACE LA DETTE — DÉCISION DU 18 OCTOBRE.
 *
 * La base pose l'avoir sur `montant_avoire` et en déduit `solde_du`
 * (migration 20261018055411). Côté écran, trois règles en découlent :
 *  - le chiffre d'affaires est net des avoirs, chacun à SA date ;
 *  - seul ce qui dépasse la dette se rembourse ;
 *  - une facture couverte par paiements et avoirs n'est plus due.
 */

const vente = (p: Partial<Sale> & { id: string; totalVente: number }): Sale => ({
  numero: p.id.toUpperCase(),
  date: "2026-10-05",
  productId: "p1",
  designation: "Article",
  quantite: 1,
  prixVenteUnit: p.totalVente,
  prixAchatUnitRef: 0,
  totalAchatRef: 0,
  margeTotale: p.totalVente,
  vendeur: "Hanta",
  commission: 0,
  montantPaye: 0,
  montantRembourse: 0,
  montantAvoire: 0,
  soldeDu: p.totalVente - (p.montantPaye ?? 0),
  statutCredit: "Impayé",
  ticketId: "T1",
  ...p,
});

describe("ce qu'un avoir laisse à rendre", () => {
  const facture = (paye: number) => [vente({ id: "a", totalVente: 100_000, montantPaye: paye })];

  it("facture impayée : l'avoir efface la dette, rien ne sort de la caisse", () => {
    expect(aRembourserApresAvoir(facture(0), 100_000)).toEqual([]);
  });

  it("payée 30 000, avoir 50 000 : il reste 20 000 dus, rien à rendre", () => {
    expect(aRembourserApresAvoir(facture(30_000), 50_000)).toEqual([]);
  });

  it("payée 30 000, avoir 80 000 : 10 000 à rendre", () => {
    expect(aRembourserApresAvoir(facture(30_000), 80_000)).toEqual([
      { saleId: "a", montant: 10_000 },
    ]);
  });

  it("payée entièrement, avoir total : tout se rend", () => {
    expect(aRembourserApresAvoir(facture(100_000), 100_000)).toEqual([
      { saleId: "a", montant: 100_000 },
    ]);
  });

  it("ce qui a déjà été rendu ne se rend pas deux fois", () => {
    const deja = [
      vente({ id: "a", totalVente: 100_000, montantPaye: 100_000, montantRembourse: 40_000 }),
    ];
    expect(aRembourserApresAvoir(deja, 100_000)).toEqual([{ saleId: "a", montant: 60_000 }]);
  });

  it("sur plusieurs lignes, chacune jusqu'à ce qu'elle a encaissé", () => {
    const ticket = [
      vente({ id: "a", totalVente: 50_000, montantPaye: 50_000 }),
      vente({ id: "b", totalVente: 50_000, montantPaye: 20_000 }),
    ];
    // Versé 70 000 ; après un avoir de 60 000, il ne doit plus que 40 000.
    expect(aRembourserApresAvoir(ticket, 60_000)).toEqual([{ saleId: "a", montant: 30_000 }]);
  });
});

describe("le statut d'une facture couverte par un avoir", () => {
  const base = { annulee: false, envoyee: false, echeance: "2026-10-01", aujourdhui: "2026-10-18" };

  it("payée 40 000 + avoir 60 000 sur 100 000 : soldée, pas en retard", () => {
    expect(statutDeFacture({ ...base, montant: 100_000, paye: 40_000, avoire: 60_000 })).toBe(
      "payee",
    );
  });

  it("un avoir partiel sur une facture échue laisse le reste en retard", () => {
    expect(statutDeFacture({ ...base, montant: 100_000, paye: 0, avoire: 60_000 })).toBe("retard");
  });
});

describe("le chiffre d'affaires, net des avoirs à leur date", () => {
  const ventes = [
    vente({ id: "sept", totalVente: 100_000, date: "2026-09-20", ticketId: "T9" }),
    vente({ id: "oct", totalVente: 50_000, date: "2026-10-05", ticketId: "T10" }),
  ];
  // Un avoir d'octobre qui annule la vente de septembre.
  const avoirs = [{ date: "2026-10-10", montant: 100_000, ticket_id: "T9" }];

  it("l'avoir baisse le jour où il est établi, pas le mois de la vente", () => {
    const parJour = chiffreAffairesParJour(ventes, avoirs);
    expect(parJour.get("2026-09-20")).toBe(100_000);
    expect(parJour.get("2026-10-10")).toBe(-100_000);
  });

  it("un écran ne retranche que les avoirs de SES ventes", () => {
    expect(avoirsDesVentes(avoirs, [ventes[1]])).toEqual([]);
    expect(chiffreAffairesNet(ventes, avoirsDesVentes(avoirs, ventes))).toBe(50_000);
  });

  it("le tableau de bord et la page Facturation donnent le même chiffre", () => {
    const aujourdhui = "2026-10-18";
    const periode = construirePeriode(
      "month",
      { debut: "2026-10-01", fin: aujourdhui },
      aujourdhui,
    );

    const tableau = chiffresVentes(
      { sales: ventes, avoirs } as unknown as SourcesChiffres,
      periode,
    );

    const documents = construireDocuments({
      sales: ventes,
      payments: [],
      quotes: [],
      quoteItems: [],
      facturesAchat: [],
      avoirs: [
        {
          id: "av1",
          numero: "AV001",
          date: "2026-10-10",
          montant: 100_000,
          ticket_id: "T9",
          facture_numero: "V-SEPT",
          client_id: null,
          client_nom: "",
          motif: "",
          created_by: null,
          created_at: "2026-10-10T10:00:00Z",
          store_id: "s",
        },
      ],
      envois: new Set(),
      recus: new Set(),
      reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
      aujourdhui,
    });
    const facturation = calculerIndicateurs({
      documents,
      payments: [],
      intervalle: periode.intervalle,
    });

    // Octobre : 50 000 vendus, 100 000 annulés sur une vente de septembre.
    expect(tableau.total).toBe(-50_000);
    expect(facturation.facture.montant).toBe(tableau.total);
  });
});
