import { describe, it, expect } from "vitest";
import type { Sale } from "../../types";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../../features/documents/lib/reglages";
import {
  cleDocument,
  construireDocuments,
  grouperParTicket,
  type Avoir,
  type FactureAchat,
  type SourceFacturation,
} from "./documents";

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

const source = (p: Partial<SourceFacturation> = {}): SourceFacturation => ({
  sales: [],
  payments: [],
  quotes: [],
  quoteItems: [],
  facturesAchat: [],
  avoirs: [],
  envois: new Set(),
  recus: new Set(),
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
  aujourdhui: AUJOURDHUI,
  ...p,
});

describe("le regroupement par ticket", () => {
  it("réunit les lignes d'un même passage en caisse", () => {
    const par = grouperParTicket([
      vente({ id: "a", ticketId: "T1" }),
      vente({ id: "b", ticketId: "T1" }),
      vente({ id: "c", ticketId: "T2" }),
    ]);
    expect(par.size).toBe(2);
    expect(par.get("T1")).toHaveLength(2);
  });

  it("une vente seule est son propre ticket", () => {
    const par = grouperParTicket([vente({ id: "a" })]);
    expect([...par.keys()]).toEqual(["a"]);
  });
});

describe("aucune opération n'est comptée deux fois", () => {
  it("un ticket de trois lignes ne donne QU'UNE ligne de facturation", () => {
    const docs = construireDocuments(
      source({
        sales: [
          vente({ id: "a", ticketId: "T1", totalVente: 30_000 }),
          vente({ id: "b", ticketId: "T1", totalVente: 20_000 }),
          vente({ id: "c", ticketId: "T1", totalVente: 50_000 }),
        ],
      }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0].montant).toBe(100_000);
  });

  it("le total de la liste est celui des ventes, à l'ariary près", () => {
    const ventes = [
      vente({ id: "a", ticketId: "T1", totalVente: 33_333 }),
      vente({ id: "b", ticketId: "T1", totalVente: 33_333 }),
      vente({ id: "c", totalVente: 33_334 }),
    ];
    const docs = construireDocuments(source({ sales: ventes }));
    const totalListe = docs.reduce((n, d) => n + d.montant, 0);
    const totalVentes = ventes.reduce((n, v) => n + v.totalVente, 0);
    expect(totalListe).toBe(totalVentes);
  });

  it("un reçu n'ajoute pas de seconde ligne au même ticket", () => {
    const sales = [vente({ id: "a", ticketId: "T1" })];
    const sansRecu = construireDocuments(source({ sales }));
    const avecRecu = construireDocuments(source({ sales, recus: new Set(["T1"]) }));

    expect(sansRecu).toHaveLength(1);
    expect(avecRecu).toHaveLength(1);
    expect(sansRecu[0].type).toBe("facture");
    expect(avecRecu[0].type).toBe("recu");
    expect(avecRecu[0].montant).toBe(sansRecu[0].montant);
  });

  it("un devis n'entre dans aucun total de vente : il ne porte ni payé ni reste", () => {
    const docs = construireDocuments(
      source({
        quotes: [
          {
            id: "d1",
            store_id: "s",
            client_id: null,
            client_nom: "Rakoto",
            created_at: "",
            created_by: null,
            date: "2026-09-10",
            duree_validite_jours: 30,
            note: null,
            numero: "DEV001",
            statut: "envoye",
            total: 250_000,
            type: "devis",
            updated_at: "",
            valide_jusqu_au: "2026-10-10",
            vente_ticket_id: null,
          },
        ],
      }),
    );
    expect(docs).toHaveLength(1);
    expect(docs[0].paye).toBe(0);
    expect(docs[0].reste).toBe(0);
    expect(docs[0].statut).toBe("attente");
  });
});

describe("le type d'un ticket", () => {
  it("devient « commission » dès que le ticket en porte une", () => {
    const docs = construireDocuments(
      source({ sales: [vente({ id: "a", ticketId: "T1", commission: 8_000 })] }),
    );
    expect(docs[0].type).toBe("commission");
  });

  it("reste « facture » quand la commission est nulle", () => {
    const docs = construireDocuments(source({ sales: [vente({ id: "a", ticketId: "T1" })] }));
    expect(docs[0].type).toBe("facture");
  });
});

describe("le numéro imprimé", () => {
  it("porte le préfixe du type", () => {
    const docs = construireDocuments(
      source({ sales: [vente({ id: "a", ticketId: "T1", numero: "V024" })] }),
    );
    expect(docs[0].numero).toBe("FAC-V024");
    expect(docs[0].numeroBrut).toBe("V024");
  });
});

const avoir = (p: Partial<Avoir> & { id: string }): Avoir => ({
  store_id: "s",
  numero: "AV001",
  date: "2026-09-21",
  ticket_id: "T1",
  facture_numero: "FAC-V001",
  client_id: null,
  client_nom: "Rakoto",
  motif: "Erreur de saisie",
  montant: 100_000,
  created_by: null,
  created_at: "",
  ...p,
});

describe("l'avoir et la facture qu'il couvre", () => {
  it("un avoir du montant entier annule la facture", () => {
    const docs = construireDocuments(
      source({
        sales: [vente({ id: "a", ticketId: "T1", totalVente: 100_000 })],
        avoirs: [avoir({ id: "av1", montant: 100_000 })],
      }),
    );
    const facture = docs.find((d) => d.entite === "vente")!;
    expect(facture.statut).toBe("annulee");
    expect(facture.avoirDe).toBe("AV001");
  });

  it("un avoir PARTIEL ne l'annule pas : la créance reste due", () => {
    const docs = construireDocuments(
      source({
        sales: [vente({ id: "a", ticketId: "T1", totalVente: 100_000 })],
        avoirs: [avoir({ id: "av1", montant: 30_000 })],
      }),
    );
    const facture = docs.find((d) => d.entite === "vente")!;
    expect(facture.statut).not.toBe("annulee");
    expect(facture.avoirDe).toBe("AV001");
  });

  it("plusieurs avoirs partiels finissent par l'annuler", () => {
    const docs = construireDocuments(
      source({
        sales: [vente({ id: "a", ticketId: "T1", totalVente: 100_000 })],
        avoirs: [
          avoir({ id: "av1", numero: "AV001", montant: 30_000 }),
          avoir({ id: "av2", numero: "AV002", montant: 70_000 }),
        ],
      }),
    );
    const facture = docs.find((d) => d.entite === "vente")!;
    expect(facture.statut).toBe("annulee");
    expect(facture.avoirDe).toBe("AV001, AV002");
  });

  it("l'avoir est lui-même une pièce de la liste", () => {
    const docs = construireDocuments(source({ avoirs: [avoir({ id: "av1" })] }));
    expect(docs).toHaveLength(1);
    expect(docs[0].type).toBe("avoir");
    expect(docs[0].numero).toBe("AV-AV001");
  });
});

describe("la facture reçue d'un fournisseur", () => {
  const recue: FactureAchat = {
    id: "f1",
    store_id: "s",
    supplier_id: null,
    fournisseur: "Quincaillerie du Sud",
    numero: "FA001",
    numero_fournisseur: "2026-4412",
    date: "2026-09-15",
    date_echeance: "2026-10-15",
    total: 500_000,
    montant_paye: 200_000,
    note: null,
    piece_jointe: null,
    created_by: null,
    created_at: "",
    updated_at: "",
  };

  it("porte son reste et son statut, et garde le numéro du papier reçu", () => {
    const docs = construireDocuments(source({ facturesAchat: [recue] }));
    expect(docs[0].reste).toBe(300_000);
    expect(docs[0].statut).toBe("partiel");
    expect(docs[0].reference).toBe("2026-4412");
    expect(docs[0].tiers).toBe("Quincaillerie du Sud");
  });
});

describe("l'ordre et les clés", () => {
  it("les plus récents d'abord", () => {
    const docs = construireDocuments(
      source({
        sales: [
          vente({ id: "a", ticketId: "T1", date: "2026-09-01" }),
          vente({ id: "b", ticketId: "T2", date: "2026-09-20" }),
          vente({ id: "c", ticketId: "T3", date: "2026-09-10" }),
        ],
      }),
    );
    expect(docs.map((d) => d.date)).toEqual(["2026-09-20", "2026-09-10", "2026-09-01"]);
  });

  it("chaque pièce a une clé unique", () => {
    const docs = construireDocuments(
      source({
        sales: [vente({ id: "a", ticketId: "T1" })],
        avoirs: [avoir({ id: "av1" })],
      }),
    );
    expect(new Set(docs.map((d) => d.cle)).size).toBe(docs.length);
    expect(docs.map((d) => d.cle)).toContain(cleDocument("vente", "T1"));
  });
});
