import { describe, expect, it } from "vitest";
import { situations, totauxDuMois, type PaiementSalaire, type Salaire } from "./salaires";

const PERIODE = "2026-10-01";

const fiche = (employe: string, montant: number): Salaire =>
  ({
    id: employe,
    employe,
    montant,
    poste: null,
    user_id: null,
    debut_le: "2026-01-01",
    fin_le: null,
  }) as unknown as Salaire;

const verse = (employe: string, montant: number): PaiementSalaire =>
  ({
    id: `${employe}-${montant}`,
    employe,
    montant,
    type: "avance",
    statut: "versee",
    periode: PERIODE,
    created_at: "2026-10-05T10:00:00Z",
    demande_le: "2026-10-05T10:00:00Z",
  }) as unknown as PaiementSalaire;

describe("le reste à payer du mois", () => {
  it("n'additionne que ce qui reste dû : une avance en trop ne réduit pas la dette des autres", () => {
    const liste = situations(
      [fiche("Hanta", 100_000), fiche("Naivo", 100_000)],
      // Naivo a reçu 150 000 sur un salaire de 100 000.
      [verse("Naivo", 150_000)],
      PERIODE,
    );
    expect(liste.find((s) => s.employe === "Naivo")?.resteAPayer).toBe(-50_000);
    // On doit encore 100 000 à Hanta : c'est ce qui doit sortir de la caisse.
    expect(totauxDuMois(liste).resteAPayer).toBe(100_000);
  });

  it("l'en-tête retombe sur la somme des lignes affichées", () => {
    const liste = situations(
      [fiche("Hanta", 100_000), fiche("Naivo", 80_000)],
      [verse("Hanta", 30_000)],
      PERIODE,
    );
    const lignes = liste.reduce((n, s) => n + Math.max(0, s.resteAPayer), 0);
    expect(totauxDuMois(liste).resteAPayer).toBe(lignes);
    expect(lignes).toBe(150_000);
  });
});
