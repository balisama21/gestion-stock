import { describe, expect, it } from "vitest";
import {
  documentDAvoir,
  documentDeCommande,
  documentDeDevis,
  documentDeVente,
} from "./buildDocument";
import { BOUTIQUE, PRODUITS, TICKET_TROIS_LIGNES, V024, V025, V026 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import { resoudreMiseEnPage } from "./resolveur";
import { tauxDuProduit, ventilerTva } from "./tva";
import type { Database } from "../../../lib/database.types";

/**
 * LA TVA DE CHAQUE LIGNE.
 *
 * Le taux saisi sur la fiche produit était enregistré et lu nulle part :
 * les documents n'appliquaient que celui de la boutique. Ces tests
 * tiennent l'ordre — produit, catégorie, boutique — et ce qui ne doit
 * pas bouger : le total, et une pièce déjà émise.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const AVEC_TVA = { ...R, options: { ...R.options, tva: true } };

// setreela exonéré (fiche à 0), chocolat à 5 % par sa catégorie.
const CATALOGUE = PRODUITS.map((p) =>
  p.id === "p-024"
    ? { ...p, tvaRate: 0 }
    : p.id === "p-022"
      ? { ...p, categoryId: "cat-1", tvaCategorie: 5 }
      : p,
);

describe("le taux d'une ligne", () => {
  it("prend celui de la fiche, même à zéro", () => {
    expect(tauxDuProduit("p-024", CATALOGUE, 20)).toBe(0);
  });

  it("prend celui de la catégorie quand la fiche n'en a pas", () => {
    expect(tauxDuProduit("p-022", CATALOGUE, 20)).toBe(5);
  });

  it("préfère la fiche à la catégorie", () => {
    const fiche = [{ id: "x", tvaRate: 10, tvaCategorie: 5 }];
    expect(tauxDuProduit("x", fiche, 20)).toBe(10);
  });

  it("retombe sur la boutique : sans taux, sans fiche, sans produit", () => {
    expect(tauxDuProduit("p-019", CATALOGUE, 20)).toBe(20);
    expect(tauxDuProduit("p-disparu", CATALOGUE, 20)).toBe(20);
    expect(tauxDuProduit(null, CATALOGUE, 20)).toBe(20);
  });
});

describe("la ventilation par taux", () => {
  it("garde l'addition juste, taux par taux", () => {
    const parTaux = ventilerTva(
      [
        { tva: 20, total: 300000 },
        { tva: 5, total: 4500 },
        { tva: 20, total: 7 },
      ],
      304507,
    )!;
    expect(parTaux.map((t) => t.taux)).toEqual([20, 5]);
    expect(parTaux[0].horsTaxe + parTaux[0].montant).toBe(300007);
    expect(parTaux[1].horsTaxe + parTaux[1].montant).toBe(4500);
  });

  it("refuse de ventiler des lignes qui ne font pas le total", () => {
    expect(ventilerTva([{ tva: 20, total: 1000 }], 900)).toBeNull();
    expect(ventilerTva([{ tva: null, total: 1000 }], 1000)).toBeNull();
  });
});

describe("une facture à plusieurs taux", () => {
  const d = documentDeVente({
    ventes: TICKET_TROIS_LIGNES,
    produits: CATALOGUE,
    boutique: BOUTIQUE,
    reglages: AVEC_TVA,
  });

  it("donne à chaque ligne son taux", () => {
    expect(d.lignes.map((l) => l.tva)).toEqual([20, 5, 0]);
  });

  it("ventile la TVA, et le total ne bouge pas", () => {
    expect(d.totaux.total).toBe(307500);
    expect(d.totaux.tva!.parTaux).toEqual([
      { taux: 20, horsTaxe: 250000, montant: 50000 },
      { taux: 5, horsTaxe: 4286, montant: 214 },
      { taux: 0, horsTaxe: 3000, montant: 0 },
    ]);
    expect(d.totaux.tva!.montant).toBe(50214);
    expect(d.totaux.horsTaxe! + d.totaux.tva!.montant).toBe(d.totaux.total);
  });

  it("montre la colonne de TVA, puisque les taux diffèrent", () => {
    expect(d.colonnes.map((c) => c.cle)).toContain("tva");
  });

  it("tait la colonne quand toutes les lignes ont le même taux", () => {
    const seul = documentDeVente({
      ventes: [V024, V025],
      produits: PRODUITS,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
    });
    expect(seul.colonnes.map((c) => c.cle)).not.toContain("tva");
    expect(seul.totaux.tva!.parTaux).toHaveLength(1);
  });

  it("ne montre rien quand aucune ligne n'est taxée", () => {
    const exonere = documentDeVente({
      ventes: [V026],
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
    });
    expect(exonere.totaux.tva).toBeNull();
    expect(exonere.totaux.horsTaxe).toBeNull();
  });
});

describe("une pièce déjà émise", () => {
  it("garde les taux du jour où elle est partie", () => {
    const d = documentDeVente({
      ventes: [V025],
      produits: CATALOGUE, // le chocolat est passé à 5 % depuis
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
      tauxFiges: { "s-025": 20 },
    });
    expect(d.lignes[0].tva).toBe(20);
    expect(d.totaux.tva!.montant).toBe(750);
  });

  it("émise avant les taux par ligne, une vente ressort au taux de la boutique", () => {
    const d = documentDeVente({
      ventes: TICKET_TROIS_LIGNES,
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
      tauxFiges: "avant",
    });
    expect(d.lignes.map((l) => l.tva)).toEqual([20, 20, 20]);
    expect(d.totaux.tva!.parTaux).toHaveLength(1);
  });
});

type Devis = Database["public"]["Tables"]["quotes"]["Row"];
type LigneDevis = Database["public"]["Tables"]["quote_items"]["Row"];

const DEVIS = {
  id: "q-1",
  numero: "D001",
  date: "2026-10-30",
  total: 10000,
  type: "devis",
  client_nom: "Dimby",
  valide_jusqu_au: null,
} as Devis;

const ligneDevis = (id: string, product_id: string | null, total: number) =>
  ({ id, product_id, designation: id, quantite: 1, prix_unitaire: total, total }) as LigneDevis;

describe("les autres pièces", () => {
  it("un devis porte la TVA de ses lignes", () => {
    const d = documentDeDevis({
      devis: DEVIS,
      lignes: [ligneDevis("a", "p-022", 5250), ligneDevis("b", null, 4750)],
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
    });
    expect(d.lignes.map((l) => l.tva)).toEqual([5, 20]);
    expect(d.totaux.tva!.parTaux.map((t) => t.taux)).toEqual([20, 5]);
    expect(d.totaux.total).toBe(10000);
  });

  it("un devis émis avant les taux par ligne ressort sans TVA, comme à l'époque", () => {
    const d = documentDeDevis({
      devis: DEVIS,
      lignes: [ligneDevis("a", "p-022", 10000)],
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
      tauxFiges: "avant",
    });
    expect(d.totaux.tva).toBeNull();
    expect(d.lignes[0].tva).toBeNull();
  });

  it("un bon de commande client aussi", () => {
    const d = documentDeCommande({
      commande: {
        id: "o-1",
        numero: "C001",
        created_at: "2026-10-30T08:00:00Z",
        montant_total: 1200,
        montant_paye: 0,
        reste_a_payer: 1200,
        date_livraison: null,
      } as Database["public"]["Tables"]["orders"]["Row"],
      lignes: [
        {
          id: "oi-1",
          product_id: "p-019",
          designation: "Vera",
          quantite: 1,
          prix_vente_unit: 1200,
          total_vente: 1200,
        } as Database["public"]["Tables"]["order_items"]["Row"],
      ],
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
    });
    expect(d.totaux.tva!.montant).toBe(200);
    expect(d.totaux.horsTaxe).toBe(1000);
  });

  it("un avoir dont les lignes ne font pas le montant ne ventile rien", () => {
    const d = documentDAvoir({
      avoir: {
        id: "av-1",
        numero: "AV001",
        date: "2026-10-30",
        montant: 500,
        motif: "Geste commercial",
        client_nom: "Dimby",
        facture_numero: null,
      } as Database["public"]["Tables"]["avoirs"]["Row"],
      lignes: [
        {
          id: "ai-1",
          product_id: "p-019",
          designation: "Vera",
          quantite: 1,
          prix_unitaire: 1200,
          total: 1200,
        } as Database["public"]["Tables"]["avoir_items"]["Row"],
      ],
      produits: CATALOGUE,
      boutique: BOUTIQUE,
      reglages: AVEC_TVA,
    });
    expect(d.totaux.total).toBe(500);
    expect(d.totaux.tva).toBeNull();
  });

  it("la colonne se règle sur une facture, et n'existe pas sur un bon fournisseur", () => {
    expect(resoudreMiseEnPage(AVEC_TVA, "facture").visible("tableau.tva")).toBe(true);
    expect(
      resoudreMiseEnPage(AVEC_TVA, "achat").elements.some((e) => e.cle === "tableau.tva"),
    ).toBe(false);
  });
});
