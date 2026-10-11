import { describe, expect, it } from "vitest";
import { estLeSoir, phraseDuMoment } from "./phrases";

describe("les phrases du haut de page", () => {
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
  });

  it("le lendemain, une autre phrase", () => {
    expect(phraseDuMoment(new Date(2026, 9, 12, 9, 0))).not.toEqual(
      phraseDuMoment(new Date(2026, 9, 11, 9, 0)),
    );
    expect(phraseDuMoment(new Date(2026, 9, 12, 20, 0))).not.toEqual(
      phraseDuMoment(new Date(2026, 9, 11, 20, 0)),
    );
  });
});
