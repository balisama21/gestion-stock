import { describe, expect, it } from "vitest";
import { documentDeFactureAchat } from "./buildDocument";
import { BOUTIQUE } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import type { Database } from "../../../lib/database.types";

/**
 * LA FACTURE D'ACHAT FOURNISSEUR.
 *
 * Le point à ne pas perdre de vue : ce papier est NOTRE relevé de la
 * facture reçue, pas la facture du fournisseur. L'en-tête reste celui
 * de la boutique, le fournisseur occupe le bloc d'en face, et son
 * numéro à lui est affiché comme tel. Imprimer un document à
 * l'en-tête d'un tiers reviendrait à fabriquer une pièce en son nom.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;

const FOURNISSEUR = {
  id: "f1",
  nom: "Rasoa",
  entreprise: "Distri Nord",
  adresse: "Lot II B 45",
  ville: "Antananarivo",
  telephone: "034 11 222 33",
  numero_fiscal: "NIF 9988",
} as unknown as Database["public"]["Tables"]["suppliers"]["Row"];

const FACTURE = {
  id: "fa1",
  store_id: "s1",
  supplier_id: "f1",
  fournisseur: "Distri Nord",
  numero: "FA003",
  numero_fournisseur: "2026-0451",
  date: "2026-09-10",
  date_echeance: "2026-10-10",
  total: 450000,
  montant_paye: 150000,
  note: null,
  piece_jointe: null,
  created_by: null,
  created_at: "2026-09-10T08:00:00Z",
  updated_at: "2026-09-10T08:00:00Z",
} as Database["public"]["Tables"]["supplier_invoices"]["Row"];

const LIGNES = [
  {
    id: "l1",
    invoice_id: "fa1",
    store_id: "s1",
    product_id: null,
    designation: "Ciment 50 kg",
    quantite: 10,
    unite: "sac",
    prix_unitaire: 40000,
    total: 400000,
    created_at: "2026-09-10T08:00:00Z",
  },
] as Database["public"]["Tables"]["supplier_invoice_items"]["Row"][];

const construire = (reglages: ReglagesDocuments = R, facture = FACTURE) =>
  documentDeFactureAchat({
    facture,
    lignes: LIGNES,
    fournisseur: FOURNISSEUR,
    boutique: BOUTIQUE,
    reglages,
  });

describe("c'est notre relevé, pas la facture du fournisseur", () => {
  it("garde la boutique en en-tête", () => {
    expect(construire().emetteur.nom).toBe("Ma Boutique");
  });

  it("met le fournisseur en face, avec son numéro fiscal à lui", () => {
    const d = construire();
    expect(d.destinataire.titre).toBe("Fournisseur");
    expect(d.destinataire.nom).toBe("Distri Nord");
    // La personne devient une ligne de contact sous l'entreprise.
    expect(d.destinataire.lignes).toContain("Rasoa");
    expect(d.destinataire.nif).toBe("NIF 9988");
  });

  it("affiche les deux numéros : le nôtre et celui du papier", () => {
    const d = construire();
    expect(d.numero).toBe("FA-FA003");
    expect(d.meta.find((m) => m.libelle === "N° fournisseur")?.valeur).toBe("2026-0451");
  });

  it("ne demande à personne de signer, et n'indique pas où nous payer", () => {
    const d = construire();
    expect(d.signatures).toBeNull();
    expect(d.coordonneesPaiement).toBeNull();
  });
});

describe("les montants viennent du papier", () => {
  it("reprend le total tel quel, sans additionner les lignes", () => {
    // Les lignes totalisent 400 000 ; la facture en porte 450 000.
    expect(construire().totaux.total).toBe(450000);
  });

  it("déduit le reste, et ne descend jamais sous zéro", () => {
    expect(construire().totaux.reste).toBe(300000);
    const trop = { ...FACTURE, montant_paye: 500000 };
    expect(construire(R, trop).totaux.reste).toBe(0);
  });

  it("dit si elle reste à régler", () => {
    expect(construire().tampon?.texte).toBe("Reste à régler");
    expect(construire(R, { ...FACTURE, montant_paye: 450000 }).tampon?.texte).toBe("Réglée");
  });
});

describe("elle suit ses propres réglages", () => {
  it("prend le titre et le préfixe du type « facture_achat »", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      types: { facture_achat: { titre: "PIÈCE FOURNISSEUR", prefixe: "PF-{AAAA}-" } },
    };
    const d = construire(reglages);
    expect(d.titre).toBe("PIÈCE FOURNISSEUR");
    expect(d.numero).toBe("PF-2026-FA003");
  });

  it("obéit à sa mise en page", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      pages: { facture_achat: { "infos.numeroFournisseur": { visible: false } } },
    };
    expect(construire(reglages).meta.map((m) => m.libelle)).not.toContain("N° fournisseur");
  });

  it("ne dit pas merci à un fournisseur, sauf si la boutique le décide", () => {
    expect(construire().motDeFin).toBeNull();
    const reglages: ReglagesDocuments = {
      ...R,
      types: { facture_achat: { motDeFin: "Reçu, merci." } },
    };
    expect(construire(reglages).motDeFin).toBe("Reçu, merci.");
  });
});

describe("une facture saisie sans fiche fournisseur", () => {
  it("se contente du nom libre, sans bloc vide", () => {
    const d = documentDeFactureAchat({
      facture: { ...FACTURE, supplier_id: null, fournisseur: "Quincaillerie du coin" },
      lignes: LIGNES,
      fournisseur: null,
      boutique: BOUTIQUE,
      reglages: R,
    });
    expect(d.destinataire.nom).toBe("Quincaillerie du coin");
    expect(d.destinataire.lignes).toEqual([]);
    expect(d.destinataire.nif).toBeNull();
  });
});
