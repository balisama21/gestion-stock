import { describe, expect, it } from "vitest";
import { lireGS1 } from "./gs1";
import { codePropre } from "../hooks/useDouchette";

describe("lireGS1", () => {
  it("lit la forme entre parenthèses", () => {
    expect(lireGS1("(01)03400930000120(17)280131(10)ab123")).toEqual({
      code: "3400930000120",
      lot: "AB123",
      peremption: "2028-01-31",
    });
  });
  it("lit la forme brute, avec le séparateur invisible", () => {
    const fnc1 = String.fromCharCode(29);
    expect(lireGS1(`010340093000012010AB123${fnc1}17280100`)).toEqual({
      code: "3400930000120",
      lot: "AB123",
      peremption: "2028-01-31",
    });
  });
  it("lit un lot placé en dernier, sans séparateur", () => {
    expect(lireGS1("01034009300001201728063010L-42")?.lot).toBe("L-42");
  });
  it("ne prend pas un code-barres ordinaire pour un carré", () => {
    expect(lireGS1("3400930000120")).toBeNull();
    expect(lireGS1("6191234567890")).toBeNull();
  });
});

describe("codePropre", () => {
  it("ramène le carré et le GTIN-14 au code imprimé sous les barres", () => {
    expect(codePropre("(01)03400930000120(17)280131(10)AB123")).toBe("3400930000120");
    expect(codePropre("03400930000120")).toBe("3400930000120");
    expect(codePropre("340 0930 000120")).toBe("3400930000120");
  });
});
