import { describe, it, expect } from "vitest";
import type { DocumentCommercial } from "./documents";
import {
  compterFiltres,
  filtrerDocuments,
  trierDocuments,
  FILTRES_VIDES,
  type FiltresFacturation,
} from "./filtrer";

const doc = (p: Partial<DocumentCommercial> & { cle: string }): DocumentCommercial => ({
  entite: "vente",
  entiteId: p.cle,
  type: "facture",
  numero: "FAC-V001",
  numeroBrut: "V001",
  date: "2026-09-20",
  echeance: "2026-10-05",
  tiers: "Rakoto",
  clientId: null,
  vendeur: "Hanta",
  auteurId: null,
  montant: 250_000,
  paye: 0,
  reste: 250_000,
  statut: "emise",
  avoirDe: null,
  ventes: [],
  devis: null,
  lignesDevis: [],
  factureAchat: null,
  avoir: null,
  reference: null,
  ...p,
});

const f = (p: Partial<FiltresFacturation> = {}): FiltresFacturation => ({ ...FILTRES_VIDES, ...p });

const DOCS = [
  doc({ cle: "1", numero: "FAC-V001", tiers: "Rakoto", montant: 250_000, reste: 250_000 }),
  doc({
    cle: "2",
    numero: "DEV-DEV001",
    numeroBrut: "DEV001",
    type: "devis",
    entite: "devis",
    tiers: "Société Andry",
    statut: "attente",
    montant: 80_000,
    reste: 0,
    vendeur: "",
  }),
  doc({
    cle: "3",
    numero: "FA-FA001",
    numeroBrut: "FA001",
    type: "facture_achat",
    entite: "facture_achat",
    tiers: "Quincaillerie",
    reference: "2026-4412",
    statut: "a_payer",
    montant: 500_000,
    reste: 500_000,
    vendeur: "",
  }),
  doc({
    cle: "4",
    numero: "FAC-V002",
    tiers: "Rakoto",
    statut: "retard",
    vendeur: "Naina",
    numeroBrut: "V002",
    montant: 120_000,
    reste: 120_000,
  }),
];

describe("la recherche", () => {
  it("trouve par numéro, entier ou partiel", () => {
    expect(filtrerDocuments(DOCS, f({ recherche: "FAC-V001" }))).toHaveLength(1);
    expect(filtrerDocuments(DOCS, f({ recherche: "fac-" }))).toHaveLength(2);
    // Le numéro de la base se cherche aussi bien que celui qui s'imprime.
    expect(filtrerDocuments(DOCS, f({ recherche: "V002" }))).toHaveLength(1);
  });

  it("trouve par nom de client, sans accent ni casse", () => {
    expect(filtrerDocuments(DOCS, f({ recherche: "societe andry" }))).toHaveLength(1);
    expect(filtrerDocuments(DOCS, f({ recherche: "RAKOTO" }))).toHaveLength(2);
  });

  it("trouve par montant, écrit comme on le lit", () => {
    expect(filtrerDocuments(DOCS, f({ recherche: "250000" }))).toHaveLength(1);
    expect(filtrerDocuments(DOCS, f({ recherche: "250 000" }))).toHaveLength(1);
  });

  it("trouve par référence du client", () => {
    expect(filtrerDocuments(DOCS, f({ recherche: "2026-4412" }))).toHaveLength(1);
  });

  it("une recherche vide ne retire rien", () => {
    expect(filtrerDocuments(DOCS, f({ recherche: "   " }))).toHaveLength(4);
  });
});

describe("les filtres", () => {
  it("l'onglet ne garde qu'un type", () => {
    expect(filtrerDocuments(DOCS, f({ onglet: "devis" }))).toHaveLength(1);
    expect(filtrerDocuments(DOCS, f({ onglet: "tous" }))).toHaveLength(4);
  });

  it("le statut, le client et le vendeur se cumulent", () => {
    expect(filtrerDocuments(DOCS, f({ tiers: "Rakoto" }))).toHaveLength(2);
    expect(filtrerDocuments(DOCS, f({ tiers: "Rakoto", vendeur: "Naina" }))).toHaveLength(1);
    expect(filtrerDocuments(DOCS, f({ statut: "retard" }))).toHaveLength(1);
  });

  it("la période écarte ce qui tombe en dehors", () => {
    const ancien = doc({ cle: "5", date: "2026-01-05" });
    const liste = [...DOCS, ancien];
    expect(
      filtrerDocuments(liste, f({ intervalle: { debut: "2026-09-01", fin: "2026-09-30" } })),
    ).toHaveLength(4);
  });

  it("« À encaisser » ne garde que les ventes avec un reste", () => {
    const vus = filtrerDocuments(DOCS, f({ vue: "a_encaisser" }));
    expect(vus.every((d) => d.entite === "vente" && d.reste > 0)).toBe(true);
    expect(vus).toHaveLength(2);
  });

  it("« En retard » ne garde que les retards", () => {
    expect(filtrerDocuments(DOCS, f({ vue: "en_retard" }))).toHaveLength(1);
  });

  it("« Devis en attente » écarte les factures", () => {
    const vus = filtrerDocuments(DOCS, f({ vue: "offres" }));
    expect(vus).toHaveLength(1);
    expect(vus[0].type).toBe("devis");
  });
});

describe("le compte des filtres actifs", () => {
  it("ne compte ni l'onglet ni la période", () => {
    expect(compterFiltres(f({ onglet: "devis", intervalle: { debut: "a", fin: "b" } }))).toBe(0);
    expect(compterFiltres(f({ statut: "retard", tiers: "Rakoto" }))).toBe(2);
    expect(compterFiltres(f({ recherche: "  " }))).toBe(0);
  });
});

describe("le tri", () => {
  it("par date, du plus récent au plus ancien", () => {
    const liste = [
      doc({ cle: "a", date: "2026-09-01" }),
      doc({ cle: "b", date: "2026-09-20" }),
      doc({ cle: "c", date: "2026-09-10" }),
    ];
    expect(trierDocuments(liste, "date", true).map((d) => d.cle)).toEqual(["b", "c", "a"]);
    expect(trierDocuments(liste, "date", false).map((d) => d.cle)).toEqual(["a", "c", "b"]);
  });

  it("par montant, en nombres et non en texte", () => {
    const liste = [
      doc({ cle: "a", montant: 9_000 }),
      doc({ cle: "b", montant: 100_000 }),
      doc({ cle: "c", montant: 50_000 }),
    ];
    expect(trierDocuments(liste, "montant", true).map((d) => d.montant)).toEqual([
      100_000, 50_000, 9_000,
    ]);
  });

  it("à valeur égale, l'ordre ne bouge pas d'un rendu à l'autre", () => {
    const liste = [
      doc({ cle: "c", date: "2026-09-10" }),
      doc({ cle: "a", date: "2026-09-10" }),
      doc({ cle: "b", date: "2026-09-10" }),
    ];
    const premier = trierDocuments(liste, "date", true).map((d) => d.cle);
    const second = trierDocuments([...liste].reverse(), "date", true).map((d) => d.cle);
    expect(premier).toEqual(second);
  });

  it("ne modifie jamais la liste qu'on lui donne", () => {
    const liste = [doc({ cle: "a", date: "2026-09-01" }), doc({ cle: "b", date: "2026-09-20" })];
    const avant = liste.map((d) => d.cle);
    trierDocuments(liste, "date", true);
    expect(liste.map((d) => d.cle)).toEqual(avant);
  });
});
