import { describe, expect, it } from "vitest";
import { NATURES, natureChoisissable, natureDe } from "./natures";

describe("la nature d'une boutique", () => {
  it("vaut « standard » pour toutes les boutiques d'avant", () => {
    expect(natureDe(null)).toBe("standard");
    expect(natureDe({})).toBe("standard");
    expect(natureDe({ modules: {} })).toBe("standard");
    expect(natureDe({ nature: "inconnue" })).toBe("standard");
  });

  it("se lit dans la personnalisation", () => {
    expect(natureDe({ nature: "karaoke" })).toBe("karaoke");
  });

  it("ne laisse choisir qu'une nature prête", () => {
    for (const n of NATURES) {
      expect(natureChoisissable(n.cle)).toBe(n.disponible ? n.cle : "standard");
    }
    expect(natureChoisissable(undefined)).toBe("standard");
  });

  it("garde la boutique standard en tête, et disponible", () => {
    expect(NATURES[0]).toMatchObject({ cle: "standard", disponible: true });
  });
});
