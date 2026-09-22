import { describe, it, expect } from "vitest";
import { composerCsv } from "../../lib/exportTableur";
import type { DocumentCommercial } from "./documents";
import { entetesFacturation, lignesFacturation, nomDeLExport } from "./exportFacturation";

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
  paye: 100_000,
  reste: 150_000,
  statut: "partiel",
  avoirDe: null,
  ventes: [],
  devis: null,
  lignesDevis: [],
  factureAchat: null,
  avoir: null,
  reference: null,
  ...p,
});

describe("le fichier du comptable", () => {
  it("annonce la devise UNE fois, dans l'en-tête", () => {
    const entetes = entetesFacturation("Ar");
    expect(entetes.filter((e) => e.includes("(Ar)"))).toHaveLength(3);
    expect(entetes).toContain("Numéro");
    expect(entetes).toContain("Statut");
  });

  it("sort les montants en NOMBRES, pour qu'une colonne s'additionne", () => {
    const [ligne] = lignesFacturation([doc({ cle: "1" })]);
    expect(ligne[5]).toBe(250_000);
    expect(ligne[6]).toBe(100_000);
    expect(ligne[7]).toBe(150_000);
    expect(typeof ligne[5]).toBe("number");
  });

  it("dit le statut en toutes lettres, pas par sa clé", () => {
    const [ligne] = lignesFacturation([doc({ cle: "1" })]);
    expect(ligne[8]).toBe("Partiellement payée");
  });

  it("une colonne vide reste vide, jamais « null »", () => {
    const [ligne] = lignesFacturation([doc({ cle: "1", echeance: null, reference: null })]);
    expect(ligne[4]).toBe("");
    expect(ligne[10]).toBe("");
    expect(composerCsv(entetesFacturation("Ar"), [ligne])).not.toContain("null");
  });

  it("garde l'ordre de la liste affichée", () => {
    const lignes = lignesFacturation([
      doc({ cle: "1", numero: "FAC-V003" }),
      doc({ cle: "2", numero: "FAC-V001" }),
    ]);
    expect(lignes.map((l) => l[0])).toEqual(["FAC-V003", "FAC-V001"]);
  });

  it("le CSV porte la marque d'octets qu'Excel réclame", () => {
    const csv = composerCsv(entetesFacturation("Ar"), lignesFacturation([doc({ cle: "1" })]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toContain(";");
  });
});

describe("le nom du fichier", () => {
  it("dit ce qu'il contient et le jour où il a été tiré", () => {
    expect(nomDeLExport("Ce mois", "2026-09-22")).toBe("Facturation_Ce_mois_2026-09-22");
  });

  it("ne laisse passer ni accent ni caractère qu'un système refuserait", () => {
    expect(nomDeLExport("Période « spéciale » / 2026", "2026-09-22")).toBe(
      "Facturation_Periode_speciale_2026_2026-09-22",
    );
  });
});
