import { describe, it, expect } from "vitest";
import type { Sale } from "../../types";
import type { Devis } from "../../lib/devis";
import { offresDeLaPortee, ventesDeLaPortee, voitLesFacturesRecues } from "./portee";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../../features/documents/lib/reglages";
import { construireDocuments } from "./documents";

const vente = (id: string, vendeur: string): Sale => ({
  id,
  numero: `V00${id}`,
  date: "2026-09-20",
  productId: "p1",
  designation: "Article",
  quantite: 1,
  prixVenteUnit: 100_000,
  totalVente: 100_000,
  prixAchatUnitRef: 0,
  totalAchatRef: 0,
  margeTotale: 100_000,
  vendeur,
  commission: 0,
  montantPaye: 0,
  montantRembourse: 0,
  soldeDu: 100_000,
  statutCredit: "Impayé",
  ticketId: `T${id}`,
});

const devis = (id: string, auteur: string | null): Devis => ({
  id,
  store_id: "s",
  client_id: null,
  client_nom: "Rakoto",
  created_at: "",
  created_by: auteur,
  date: "2026-09-10",
  duree_validite_jours: 30,
  note: null,
  numero: `DEV00${id}`,
  statut: "envoye",
  total: 80_000,
  type: "devis",
  updated_at: "",
  valide_jusqu_au: "2026-10-10",
  vente_ticket_id: null,
});

const VENTES = [vente("1", "Hanta"), vente("2", "Naina"), vente("3", "Hanta")];
const OFFRES = [devis("1", "u-hanta"), devis("2", "u-naina")];

describe("un vendeur ne voit que ses propres documents", () => {
  it("ses ventes, et pas celles de l'équipe", () => {
    const siennes = ventesDeLaPortee(VENTES, false, "Hanta");
    expect(siennes).toHaveLength(2);
    expect(siennes.every((v) => v.vendeur === "Hanta")).toBe(true);
  });

  it("les offres qu'il a établies, reconnues par son identifiant", () => {
    const siennes = offresDeLaPortee(OFFRES, false, "u-hanta");
    expect(siennes.map((d) => d.id)).toEqual(["1"]);
  });

  it("pas le classeur des factures reçues, qui est à la boutique entière", () => {
    expect(voitLesFacturesRecues(false)).toBe(false);
  });

  it("une personne sans nom ni identifiant ne voit RIEN, plutôt que tout", () => {
    expect(ventesDeLaPortee(VENTES, false, "")).toEqual([]);
    expect(offresDeLaPortee(OFFRES, false, null)).toEqual([]);
  });
});

describe("une portée large ne retire rien", () => {
  it("toutes les ventes et toutes les offres", () => {
    expect(ventesDeLaPortee(VENTES, true, "Hanta")).toHaveLength(3);
    expect(offresDeLaPortee(OFFRES, true, "u-hanta")).toHaveLength(2);
    expect(voitLesFacturesRecues(true)).toBe(true);
  });
});

describe("la portée s'applique AVANT la mise en pièces", () => {
  it("la liste d'un vendeur ne peut pas contenir la facture d'un collègue", () => {
    const documents = construireDocuments({
      sales: ventesDeLaPortee(VENTES, false, "Hanta"),
      payments: [],
      quotes: offresDeLaPortee(OFFRES, false, "u-hanta"),
      quoteItems: [],
      facturesAchat: [],
      avoirs: [],
      envois: new Set(),
      recus: new Set(),
      reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
      aujourdhui: "2026-09-22",
    });

    expect(documents.filter((d) => d.entite === "vente")).toHaveLength(2);
    expect(documents.every((d) => d.vendeur === "" || d.vendeur === "Hanta")).toBe(true);
    // Aucune pièce ne porte le numéro de la vente de Naina.
    expect(documents.some((d) => d.numeroBrut === "V002")).toBe(false);
  });
});
