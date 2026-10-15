import { describe, expect, it } from "vitest";
import {
  PHRASES_LIVREES,
  decaler,
  estLeSoir,
  etatSerie,
  jourDeReference,
  phraseDuMoment,
  type Phrase,
} from "./phrases";

const cle = (p: Phrase) => [...p.lignes, ...p.devise].join("|");

describe("les phrases du haut de page", () => {
  it("plus de trois mois de phrases, toutes différentes, le jour comme le soir", () => {
    for (const serie of [PHRASES_LIVREES.jour, PHRASES_LIVREES.soir]) {
      expect(serie.length).toBeGreaterThanOrEqual(92);
      expect(new Set(serie.map(cle)).size).toBe(serie.length);
      for (const p of serie) {
        expect(p.lignes[0].trim()).not.toBe("");
        expect(p.devise[0].trim()).not.toBe("");
        expect(p.devise.join(" ").length).toBeLessThanOrEqual(40);
      }
    }
  });

  it("une phrase pour la journée, une autre le soir", () => {
    const matin = phraseDuMoment(new Date(2026, 9, 11, 9, 0));
    const soir = phraseDuMoment(new Date(2026, 9, 11, 19, 0));
    expect(matin).not.toEqual(soir);
    expect(phraseDuMoment(new Date(2026, 9, 11, 17, 59))).toEqual(matin);
    expect(phraseDuMoment(new Date(2026, 9, 11, 23, 30))).toEqual(soir);
  });

  it("la nuit garde la phrase de la veille au soir jusqu'à 4 h", () => {
    const soir = phraseDuMoment(new Date(2026, 9, 11, 21, 0));
    expect(phraseDuMoment(new Date(2026, 9, 12, 2, 0))).toEqual(soir);
    expect(estLeSoir(new Date(2026, 9, 12, 4, 0))).toBe(false);
    expect(jourDeReference(new Date(2026, 9, 12, 2, 0))).toBe("2026-10-11");
  });

  it("aucune phrase ne revient pendant trois mois", () => {
    const vues = { jour: new Set<string>(), soir: new Set<string>() };
    for (let j = 0; j < 92; j++) {
      const d = new Date(2026, 9, 11 + j);
      vues.jour.add(cle(phraseDuMoment(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10))));
      vues.soir.add(cle(phraseDuMoment(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20))));
    }
    expect(vues.jour.size).toBe(92);
    expect(vues.soir.size).toBe(92);
  });

  it("une fois la série épuisée : la reprendre, ou garder la dernière", () => {
    const liste = PHRASES_LIVREES.jour.slice(0, 3);
    const debut = "2026-10-11";
    const apres = decaler(debut, 4);
    const reprise = etatSerie(liste, debut, apres, "reutiliser");
    expect(reprise.epuisee).toBe(true);
    expect(reprise.phrase).toEqual(liste[1]);
    const attente = etatSerie(liste, debut, apres, "attendre");
    expect(attente.phrase).toEqual(liste[2]);
    expect(attente.restants).toBe(0);
  });

  it("compte les jours de phrases nouvelles qui restent", () => {
    const e = etatSerie(PHRASES_LIVREES.soir, "2026-10-11", "2026-10-11", "reutiliser");
    expect(e.rang).toBe(0);
    expect(e.restants).toBe(PHRASES_LIVREES.soir.length);
    expect(e.epuisee).toBe(false);
  });
});
