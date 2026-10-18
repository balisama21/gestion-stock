import { describe, expect, it } from "vitest";
import { commandeAnnulee, montantCommande, resteDuCommande } from "./commandes";
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
      expect(montantCommande(commande(statut, 12000, 5000))).toBe(12000);
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
