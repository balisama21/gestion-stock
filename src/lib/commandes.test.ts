import { describe, expect, it } from "vitest";
import {
  commandeAnnulee,
  lignesDesCommandesLivrees,
  montantCommande,
  resteDuCommande,
} from "./commandes";
import { chiffresCommandes, chiffresPaiements } from "../features/dashboard-v2/lib/chiffres";
import type { SourcesChiffres, ChiffresFlux } from "../features/dashboard-v2/lib/chiffres";

const commande = (statut: string, total: number, reste: number, jour = "2026-10-10") => ({
  statut_commande: statut,
  montant_total: total,
  reste_a_payer: reste,
  created_at: `${jour}T10:00:00Z`,
});

describe("ce qu'une commande doit encore", () => {
  it("une commande annulée ne doit plus rien", () => {
    expect(commandeAnnulee(commande("annule", 12000, 12000))).toBe(true);
    expect(resteDuCommande(commande("annule", 12000, 12000))).toBe(0);
    expect(montantCommande(commande("annule", 12000, 12000))).toBe(0);
  });

  it("les autres statuts gardent leur reste", () => {
    for (const statut of ["en_attente", "en_cours", "livre"]) {
      expect(resteDuCommande(commande(statut, 12000, 5000))).toBe(5000);
    }
  });

  it("seule une commande livrée fait du chiffre d'affaires", () => {
    expect(montantCommande(commande("livre", 12000, 5000))).toBe(12000);
    for (const statut of ["en_attente", "en_cours", "annule"]) {
      expect(montantCommande(commande(statut, 12000, 5000))).toBe(0);
    }
  });

  it("un reste nul ou négatif compte pour zéro", () => {
    expect(resteDuCommande({ statut_commande: "livre", reste_a_payer: null })).toBe(0);
    expect(resteDuCommande({ statut_commande: "livre", reste_a_payer: -5 })).toBe(0);
  });
});

describe("le tableau de bord écarte les commandes annulées", () => {
  const sources = {
    sales: [],
    orders: [commande("annule", 12000, 12000), commande("en_attente", 8000, 8000)],
  } as unknown as SourcesChiffres;

  it("de l'argent à recevoir", () => {
    const flux = { encaisse: 0, encaisseParJour: [] } as unknown as ChiffresFlux;
    const periode = { intervalle: { debut: "2026-10-01", fin: "2026-10-17" } } as never;
    const p = chiffresPaiements(sources, periode, flux, "2026-10-17");
    expect(p.aRecevoir + p.enRetard).toBe(8000);
  });

  it("des commandes à encaisser", () => {
    const c = chiffresCommandes({ ...sources, deliveries: [] } as unknown as SourcesChiffres);
    expect(c.aEncaisser).toBe(1);
  });
});

describe("une commande livrée entre dans le chiffre d'affaires, à sa date de livraison", () => {
  const article = (id: string, total: number, marge: number) => ({
    id,
    product_id: `p-${id}`,
    designation: `Article ${id}`,
    quantite: 2,
    prix_vente_unit: total / 2,
    prix_achat_unit: (total - marge) / 2,
    total_vente: total,
    total_achat_ref: total - marge,
    marge_totale: marge,
  });
  const cmd = (id: string, statut: string, items = [article("a", 3000, 1000)]) => ({
    id,
    numero: `CMD-${id}`,
    statut_commande: statut,
    client_id: "client-1",
    owner_id: "u1",
    // Une mise à jour tardive (un paiement reçu après livraison) :
    // elle ne doit PAS servir de date de vente.
    updated_at: "2026-10-25T09:00:00",
    items,
  });

  it("une ligne par article, datée du jour de la livraison", () => {
    const livreeLe = new Map([["c1", "2026-10-18T14:30:00"]]);
    const lignes = lignesDesCommandesLivrees(
      [cmd("c1", "livre", [article("a", 3000, 1000), article("b", 2000, 500)])],
      livreeLe,
    );
    expect(lignes).toHaveLength(2);
    expect(lignes.every((l) => l.date === "2026-10-18")).toBe(true);
    expect(lignes.reduce((n, l) => n + l.totalVente, 0)).toBe(5000);
    expect(lignes.reduce((n, l) => n + l.margeTotale, 0)).toBe(1500);
    // Un seul « ticket » par commande, et le client de la commande.
    expect(new Set(lignes.map((l) => l.ticketId)).size).toBe(1);
    expect(lignes[0].clientId).toBe("client-1");
    expect(lignes[0].origine).toBe("commande");
  });

  it("aucune créance en double : ce que la commande doit se lit sur la commande", () => {
    const [l] = lignesDesCommandesLivrees([cmd("c1", "livre")], new Map());
    expect(l.soldeDu).toBe(0);
    expect(l.montantPaye).toBe(0);
  });

  it("en attente, en cours ou annulée : rien", () => {
    const lignes = lignesDesCommandesLivrees(
      [cmd("c1", "en_attente"), cmd("c2", "en_cours"), cmd("c3", "annule")],
      new Map(),
    );
    expect(lignes).toEqual([]);
  });

  it("sans mouvement de livraison connu, la dernière mise à jour sert de date", () => {
    const [l] = lignesDesCommandesLivrees([cmd("c1", "livre")], new Map());
    expect(l.date).toBe("2026-10-25");
  });
});
