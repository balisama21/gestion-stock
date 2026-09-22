import { describe, expect, it } from "vitest";
import { documentDeDevis } from "./buildDocument";
import { BOUTIQUE } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import type { Database } from "../../../lib/database.types";

/**
 * LA FACTURE PROFORMA.
 *
 * Elle se construit comme un devis — mêmes lignes, même écran, même
 * conversion en vente — et se présente comme une facture. Ce fichier
 * tient les deux bouts : que rien du devis ne change, et que tout ce
 * qui doit différer diffère.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;

const piece = (type: "devis" | "proforma"): Database["public"]["Tables"]["quotes"]["Row"] => ({
  client_id: null,
  client_nom: "Rakoto",
  created_at: "2026-03-02T08:00:00Z",
  created_by: null,
  date: "2026-03-02",
  duree_validite_jours: 30,
  id: "q1",
  note: null,
  numero: type === "proforma" ? "PRO001" : "DEV001",
  statut: "envoye",
  store_id: "s1",
  total: 120000,
  type,
  updated_at: "2026-03-02T08:00:00Z",
  valide_jusqu_au: "2026-04-01",
  vente_ticket_id: null,
});

const construire = (type: "devis" | "proforma", reglages: ReglagesDocuments = R) =>
  documentDeDevis({ devis: piece(type), lignes: [], boutique: BOUTIQUE, reglages });

describe("la proforma se présente comme une facture", () => {
  it("porte son titre et son préfixe", () => {
    const d = construire("proforma");
    expect(d.titre).toBe("FACTURE PROFORMA");
    expect(d.numero).toBe("PRO-PRO001");
    expect(d.nomDeFichier).toBe("Proforma_PRO-PRO001");
  });

  it("dit « la présente facture » et non « la présente offre »", () => {
    expect(construire("proforma").type).toBe("proforma");
    expect(construire("devis").type).toBe("devis");
  });

  it("adresse la pièce, au lieu de la proposer", () => {
    expect(construire("proforma").destinataire.titre).toBe("Facturé à");
    expect(construire("devis").destinataire.titre).toBe("Devis pour");
  });

  it("ne parle pas d'argent déjà versé, comme le devis", () => {
    const d = construire("proforma");
    expect(d.totaux.paye).toBeNull();
    expect(d.totaux.reste).toBeNull();
    expect(d.tampon).toBeNull();
  });

  it("annonce un prix ferme, et non une proposition", () => {
    expect(construire("proforma").totaux.libelleTotal).toBe("Total");
    expect(construire("devis").totaux.libelleTotal).toBe("Montant proposé");
  });

  it("annonce jusqu'à quand elle tient", () => {
    expect(construire("proforma").meta.map((m) => m.libelle)).toContain("Valable jusqu'au");
  });
});

describe("elle a ses propres réglages, sans toucher au devis", () => {
  it("suit le type « proforma » et non le type « devis »", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      types: { proforma: { titre: "PRO FORMA", prefixe: "PF-{AAAA}-" } },
    };
    const p = construire("proforma", reglages);
    expect(p.titre).toBe("PRO FORMA");
    expect(p.numero).toBe("PF-2026-PRO001");

    const d = construire("devis", reglages);
    expect(d.titre).toBe("DEVIS");
    expect(d.numero).toBe("DEV-DEV001");
  });

  it("a sa propre mise en page", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      pages: { proforma: { "bas.signature": { visible: false } } },
    };
    expect(construire("proforma", reglages).signatures).toBeNull();
    expect(construire("devis", reglages).signatures).toBeTruthy();
  });
});

describe("une valeur inattendue en base", () => {
  it("se lit comme un devis plutôt que de casser la page", () => {
    const bizarre = { ...piece("devis"), type: "facture-lune" };
    const d = documentDeDevis({ devis: bizarre, lignes: [], boutique: BOUTIQUE, reglages: R });
    expect(d.titre).toBe("DEVIS");
  });
});
