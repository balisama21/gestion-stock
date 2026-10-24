import { describe, expect, it } from "vitest";
import { ecrireNifStat, estDetaille, lireNifStat, texteFiscal, valeurFiscale } from "./nifStat";

/**
 * LE NIF ET LE STAT, DANS UNE SEULE COLONNE.
 *
 * Deux promesses : les deux numéros se relisent tels qu'on les a
 * saisis, et une valeur d'avant le découpage s'imprime exactement
 * comme avant.
 */

/** Les espaces insécables, rendues lisibles pour la comparaison. */
const lu = (v: string) => v.replace(/\u00a0/g, "_");

describe("l'aller et retour", () => {
  it.each([
    ["4001234567", "46101 11 2020 0 00123"],
    ["4001234567", ""],
    ["", "46101 11 2020 0 00123"],
  ])("NIF « %s » et STAT « %s » se relisent à l'identique", (nif, stat) => {
    const l = lireNifStat(ecrireNifStat(nif, stat));
    expect([l.nif, l.stat, l.libre]).toEqual([nif, stat, ""]);
  });

  it("n'écrit rien quand les deux sont vides", () => {
    expect(ecrireNifStat(" ", "")).toBe("");
  });
});

describe("les valeurs d'avant le découpage", () => {
  it("restent un numéro unique, imprimé comme avant", () => {
    expect(lireNifStat("12739-27391ue-62").libre).toBe("12739-27391ue-62");
    expect(lu(texteFiscal("12739-27391ue-62"))).toBe("NIF/STAT_12739-27391ue-62");
    expect(estDetaille("12739-27391ue-62")).toBe(false);
  });

  it("ne prennent pas l'ancien libellé commun pour un découpage", () => {
    expect(lireNifStat("NIF/STAT : 123").libre).toBe("123");
    expect(lireNifStat("NIF & STAT 123").libre).toBe("123");
  });

  it("lisent une saisie libre qui nomme déjà les deux", () => {
    expect(lireNifStat("NIF: 123 STAT: 456")).toEqual({ nif: "123", stat: "456", libre: "" });
    expect(lireNifStat("STAT 456 | NIF 123")).toEqual({ nif: "123", stat: "456", libre: "" });
  });
});

describe("ce qui s'imprime", () => {
  it("nomme chaque numéro, et lui seul", () => {
    expect(lu(texteFiscal("NIF 123 · STAT 456"))).toBe("NIF_123 · STAT_456");
    expect(lu(texteFiscal("NIF 123"))).toBe("NIF_123");
    expect(lu(valeurFiscale("STAT 456"))).toBe("STAT_456");
    expect(estDetaille("NIF 123 · STAT 456")).toBe(true);
  });

  it("ne coupe jamais un numéro en fin de ligne", () => {
    expect(lu(texteFiscal("NIF 400 123 · STAT 46101 11 2020"))).toBe(
      "NIF_400_123 · STAT_46101_11_2020",
    );
  });
});
