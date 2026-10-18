import { describe, expect, it } from "vitest";
import { estEnAttenteDeReponse, type Devis } from "./devis";
import { pointsDAttention, type SourcesChiffres } from "../features/dashboard-v2/lib/chiffres";
import { construireDocuments } from "../components/facturation/documents";
import { calculerIndicateurs } from "../components/facturation/indicateurs";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../features/documents/lib/reglages";

/**
 * « COMBIEN DE DEVIS ATTENDENT UNE RÉPONSE ? » — UNE SEULE RÉPONSE.
 *
 * La page Devis écartait les expirés, le tableau de bord les comptait,
 * la page Facturation écartait les brouillons : sur les cinq devis
 * ci-dessous, trois écrans donnaient 2, 3 et 1.
 */

const AUJOURDHUI = "2026-10-18";
const MIDI = new Date(`${AUJOURDHUI}T12:00:00`);

const devis = (p: Partial<Devis> & { id: string; statut: string }): Devis =>
  ({
    numero: p.id.toUpperCase(),
    type: "devis",
    date: "2026-10-01",
    valide_jusqu_au: "2026-10-31",
    client_nom: "Rakoto",
    client_id: null,
    created_by: null,
    total: 100_000,
    note: null,
    vente_ticket_id: null,
    ...p,
  }) as Devis;

const DEVIS: Devis[] = [
  devis({ id: "brouillon", statut: "brouillon" }),
  devis({ id: "envoye", statut: "envoye" }),
  devis({ id: "expire", statut: "envoye", valide_jusqu_au: "2026-10-10" }),
  devis({ id: "accepte", statut: "accepte" }),
  devis({ id: "refuse", statut: "refuse" }),
];

describe("un devis en attente de réponse", () => {
  it("brouillon ou envoyé, et encore valable", () => {
    expect(DEVIS.filter((d) => estEnAttenteDeReponse(d, MIDI)).map((d) => d.id)).toEqual([
      "brouillon",
      "envoye",
    ]);
  });

  it("le dernier jour de validité compte encore", () => {
    expect(
      estEnAttenteDeReponse(
        { statut: "envoye", valide_jusqu_au: AUJOURDHUI },
        new Date(`${AUJOURDHUI}T18:00:00`),
      ),
    ).toBe(true);
  });
});

describe("le même nombre sur les trois écrans", () => {
  it("le tableau de bord ne compte plus les devis expirés", () => {
    const sources = { taches: [], quotes: DEVIS } as unknown as SourcesChiffres;
    const points = pointsDAttention(
      sources,
      { aRecommander: [] } as unknown as Parameters<typeof pointsDAttention>[1],
      AUJOURDHUI,
    );
    expect(points.devisSansReponse).toBe(2);
  });

  it("la page Facturation compte les brouillons, comme la page Devis", () => {
    const documents = construireDocuments({
      sales: [],
      payments: [],
      quotes: DEVIS,
      quoteItems: [],
      facturesAchat: [],
      avoirs: [],
      envois: new Set(),
      recus: new Set(),
      reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
      aujourdhui: AUJOURDHUI,
    });
    const i = calculerIndicateurs({ documents, payments: [], intervalle: null });
    expect(i.offres.nombre).toBe(2);
    expect(i.offres.montant).toBe(200_000);
  });
});
