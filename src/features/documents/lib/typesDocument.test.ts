import { describe, expect, it } from "vitest";
import { DEFAUTS_TYPE, appliquerVariables, lireTypes, numeroDuDocument } from "./typesDocument";
import { estPersonnalise, ouvrirPersonnalisation, resoudreType } from "./resolveur";
import { documentDeCommande, documentDeDevis, documentDeVente } from "./buildDocument";
import { BOUTIQUE, PRODUITS, V024 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, lireReglagesDocuments } from "./reglages";
import type { Database } from "../../../lib/database.types";

/**
 * LE NIVEAU 2, ET SA PROMESSE : RIEN NE BOUGE TANT QU'ON N'Y TOUCHE PAS.
 *
 * Les valeurs par défaut sont le relevé de ce que le code imprimait
 * avant la refonte. Le premier bloc les verrouille mot pour mot :
 * c'est ce qui fait qu'une boutique qui n'ouvre jamais cet écran ne
 * s'aperçoit de rien.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const base = { produits: PRODUITS, boutique: BOUTIQUE, reglages: R };

describe("les défauts sont ce que le code disait", () => {
  it("garde les titres d'hier", () => {
    expect(DEFAUTS_TYPE.facture.titre).toBe("FACTURE");
    expect(DEFAUTS_TYPE.recu.titre).toBe("REÇU");
    expect(DEFAUTS_TYPE.devis.titre).toBe("DEVIS");
    expect(DEFAUTS_TYPE.commande.titre).toBe("BON DE COMMANDE");
  });

  it("garde les préfixes d'hier", () => {
    expect(resoudreType(R, "facture").prefixe).toBe("FAC-");
    expect(resoudreType(R, "devis").prefixe).toBe("DEV-");
    expect(resoudreType(R, "recu").prefixe).toBe("REC-");
    expect(resoudreType(R, "commande").prefixe).toBe("CMD-");
  });

  it("garde les conditions d'hier, et elles diffèrent par type", () => {
    expect(resoudreType(R, "facture").conditions).toMatch(/^Paiement à réception/);
    expect(resoudreType(R, "devis").conditions).toMatch(/^Offre valable/);
    expect(resoudreType(R, "commande").conditions).toMatch(/^Commande ferme/);
  });

  it("n'écrit rien dans l'enregistrement tant qu'on n'a rien personnalisé", () => {
    expect(R.types).toEqual({});
    expect(estPersonnalise(R, "facture")).toBe(false);
  });
});

describe("l'héritage, niveau 1 puis niveau 2", () => {
  it("prend le modèle et la couleur de la boutique, à défaut du sien", () => {
    const boutique = { ...R, modele: "epure" as const, couleur: "#1F4E79" };
    expect(resoudreType(boutique, "devis").modele).toBe("epure");

    const devisEnCompact = { ...boutique, types: { devis: { modele: "compact" as const } } };
    expect(resoudreType(devisEnCompact, "devis").modele).toBe("compact");
    // Et la facture, elle, n'a pas bougé.
    expect(resoudreType(devisEnCompact, "facture").modele).toBe("epure");
  });

  it("respecte le préfixe qu'une boutique avait déjà choisi pour ses factures", () => {
    const ancienne = lireReglagesDocuments({ prefixeFacture: "F-" });
    expect(resoudreType(ancienne, "facture").prefixe).toBe("F-");
    // Le réglage du type l'emporte quand il existe.
    expect(
      resoudreType({ ...ancienne, types: { facture: { prefixe: "FA-" } } }, "facture").prefixe,
    ).toBe("FA-");
  });

  it("une fois personnalisé, un champ vidé veut dire vide et non « hérité »", () => {
    const sansMerci = { ...R, types: { facture: { motDeFin: "" } } };
    expect(resoudreType(sansMerci, "facture").motDeFin).toBe("");
    const d = documentDeVente({ ...base, ventes: [V024], reglages: sansMerci });
    expect(d.motDeFin).toBeNull();
  });

  it("le bon de commande fournisseur ne dit pas merci, même si la boutique le dit", () => {
    expect(R.motDeFin).toBe("Merci de votre confiance.");
    expect(resoudreType(R, "achat").motDeFin).toBe("");
    // Mais la boutique peut le renverser.
    expect(
      resoudreType({ ...R, types: { achat: { motDeFin: "À bientôt." } } }, "achat").motDeFin,
    ).toBe("À bientôt.");
  });

  it("« Personnaliser » recopie ce qui était hérité, pour partir de ce qu'on voit", () => {
    const ouvert = ouvrirPersonnalisation(R, "devis");
    expect(ouvert.titre).toBe("DEVIS");
    expect(ouvert.prefixe).toBe("DEV-");
    expect(ouvert.validiteJours).toBe(30);
    // L'échéance n'a de sens que sur une facture : elle n'y est pas.
    expect(ouvert.echeance).toBeUndefined();
    expect(ouvrirPersonnalisation(R, "facture").echeance).toBe("sous_15_jours");
  });
});

describe("la lecture de la colonne JSON", () => {
  it("n'invente aucune clé, pour que l'absence garde son sens", () => {
    expect(lireTypes({ facture: { titre: "Note" } })).toEqual({ facture: { titre: "Note" } });
  });

  it("écarte ce qu'elle ne reconnaît pas sans écarter le reste", () => {
    expect(lireTypes({ facture: { modele: "gothique", titre: "Note" } })).toEqual({
      facture: { titre: "Note" },
    });
    expect(lireTypes({ inconnu: { titre: "x" } })).toEqual({});
    expect(lireTypes("oui")).toEqual({});
  });
});

describe("l'année dans le préfixe", () => {
  it("est celle du DOCUMENT, pas celle d'aujourd'hui", () => {
    expect(appliquerVariables("FAC-{AAAA}-", "2024-12-31")).toBe("FAC-2024-");
    expect(appliquerVariables("F{AA}/", "2024-12-31")).toBe("F24/");
  });

  it("retombe sur l'année en cours quand la pièce n'a pas de date", () => {
    const annee = String(new Date().getFullYear());
    expect(appliquerVariables("FAC-{AAAA}-", null)).toBe(`FAC-${annee}-`);
  });

  it("ne produit jamais un préfixe tout seul", () => {
    expect(numeroDuDocument("", "FAC-{AAAA}-", "2024-01-01")).toBe("");
    expect(numeroDuDocument("V026", "FAC-{AAAA}-", "2024-01-01")).toBe("FAC-2024-V026");
  });

  it("numérote la facture avec l'année de la vente", () => {
    const reglages = { ...R, types: { facture: { prefixe: "FAC-{AAAA}-" } } };
    const d = documentDeVente({ ...base, ventes: [V024], reglages });
    expect(d.numero).toBe(`FAC-${V024.date.slice(0, 4)}-${V024.numero}`);
  });
});

describe("ce que le type impose au document", () => {
  it("change le titre et les conditions d'une facture, et d'elle seule", () => {
    const reglages = {
      ...R,
      types: { facture: { titre: "NOTE DE VENTE", conditions: "Payable sous huitaine." } },
    };
    const facture = documentDeVente({ ...base, ventes: [V024], reglages });
    expect(facture.titre).toBe("NOTE DE VENTE");
    expect(facture.mentions).toBe("Payable sous huitaine.");

    const recu = documentDeVente({ ...base, ventes: [V024], reglages, type: "recu" });
    expect(recu.titre).toBe("REÇU");
    expect(recu.mentions).toMatch(/^Paiement à réception/);
  });

  it("des conditions vidées ne laissent pas de bloc derrière elles", () => {
    const reglages = { ...R, types: { facture: { conditions: "" } } };
    expect(documentDeVente({ ...base, ventes: [V024], reglages }).mentions).toBeNull();
  });

  it("applique l'échéance du type plutôt que celle de la boutique", () => {
    const reglages = { ...R, types: { facture: { echeance: "comptant" as const } } };
    const d = documentDeVente({ ...base, ventes: [V024], reglages });
    expect(d.meta.find((m) => m.libelle === "Règlement")?.valeur).toBe("Payée comptant");
  });

  it("vaut aussi pour le devis et le bon de commande", () => {
    const devis: Database["public"]["Tables"]["quotes"]["Row"] = {
      client_id: null,
      client_nom: "Rakoto",
      created_at: "2024-03-02T08:00:00Z",
      created_by: null,
      date: "2024-03-02",
      type: "devis",
      duree_validite_jours: null,
      id: "q1",
      note: null,
      numero: "DEV001",
      statut: "envoye",
      store_id: "s1",
      total: 1000,
      updated_at: "2024-03-02T08:00:00Z",
      valide_jusqu_au: "2024-04-01",
      vente_ticket_id: null,
    };
    const reglages = {
      ...R,
      types: { devis: { titre: "PROPOSITION", prefixe: "P-{AAAA}-" } },
    };
    const d = documentDeDevis({ devis, lignes: [], boutique: BOUTIQUE, reglages });
    expect(d.titre).toBe("PROPOSITION");
    expect(d.numero).toBe("P-2024-DEV001");
  });

  it("numérote un bon de commande avec l'année de sa création", () => {
    const commande = {
      created_at: "2025-07-04T10:00:00Z",
      date_livraison: null,
      montant_paye: 0,
      montant_total: 5000,
      numero: "CMD00001",
      reste_a_payer: 5000,
    } as unknown as Database["public"]["Tables"]["orders"]["Row"];
    const reglages = { ...R, types: { commande: { prefixe: "BC-{AAAA}-" } } };
    const d = documentDeCommande({ commande, lignes: [], boutique: BOUTIQUE, reglages });
    expect(d.numero).toBe("BC-2025-CMD00001");
  });
});
