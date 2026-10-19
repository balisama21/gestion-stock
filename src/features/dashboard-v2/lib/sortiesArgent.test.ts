import { describe, expect, it } from "vitest";
import {
  chiffresDuJour,
  chiffresFlux,
  type ChiffresVentes,
  type SourcesChiffres,
} from "./chiffres";

const achat = { date: "2026-10-18", totalAchat: 10_000, quantite: 10 };
const sources = (reglementsAchats?: { date: string; montant: number }[]) =>
  ({
    sales: [],
    purchases: [achat],
    expenses: [{ date: "2026-10-18", montant: 500, vendeur: "Mamy" }],
    payments: [],
    mouvements: [],
    reglementsAchats,
  }) as unknown as SourcesChiffres;

const octobre = {
  intervalle: { debut: "2026-10-01", fin: "2026-10-31" },
  precedent: { debut: "2026-09-01", fin: "2026-09-30" },
} as never;
const ventes = { total: 0 } as ChiffresVentes;

describe("l'argent sorti pour les achats est celui qui a été payé", () => {
  it("un achat à crédit ne sort que pour ce qui a été réglé", () => {
    const f = chiffresFlux(sources([{ date: "2026-10-18", montant: 3_000 }]), octobre, ventes);
    expect(f.achats).toBe(3_000);
    expect(f.sorties).toBe(3_500);
  });

  it("le reste réglé plus tard compte à SA date", () => {
    const s = sources([
      { date: "2026-10-18", montant: 3_000 },
      { date: "2026-11-02", montant: 7_000 },
    ]);
    expect(chiffresFlux(s, octobre, ventes).achats).toBe(3_000);
    const j = chiffresDuJour(s, "2026-10-18");
    expect(j.sorties).toBe(3_500);
    expect(j.achatsDuMois).toBe(3_000);
  });

  it("sans règlements connus, le total des achats (ancien comportement)", () => {
    expect(chiffresFlux(sources(), octobre, ventes).achats).toBe(10_000);
  });
});
