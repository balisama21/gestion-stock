import { describe, expect, it } from "vitest";
import { ajouterALaNote, decalerJour, formaterTelephone } from "./saisie";
import { prixAuCoefficient, proposerMedicaments } from "./medicamentsCourants";
import { lireFrappe } from "../hooks/useDouchette";

describe("formaterTelephone", () => {
  it("met en forme un numéro malgache", () => {
    expect(formaterTelephone("0341234567")).toBe("034 12 345 67");
    expect(formaterTelephone("034 12 34567")).toBe("034 12 345 67");
    expect(formaterTelephone("+261341234567")).toBe("+261 34 12 345 67");
  });
  it("laisse tel quel un numéro qu'il ne connaît pas", () => {
    expect(formaterTelephone("12 34")).toBe("12 34");
  });
});

describe("ajouterALaNote", () => {
  it("ajoute un mot sans le répéter", () => {
    expect(ajouterALaNote("", "Diabétique")).toBe("Diabétique");
    expect(ajouterALaNote("Asthmatique.", "Diabétique")).toBe("Asthmatique, Diabétique");
    expect(ajouterALaNote("Diabétique", "diabétique")).toBe("Diabétique");
  });
});

describe("decalerJour", () => {
  it("passe les fins de mois", () => {
    expect(decalerJour("2026-11-30", 1)).toBe("2026-12-01");
    expect(decalerJour("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("proposerMedicaments", () => {
  it("trouve par le début du nom, sans accent", () => {
    const p = proposerMedicaments("amox");
    expect(p[0].nom).toBe("Amoxicilline");
    expect(p[0].regime).toBe("ordonnance");
  });
  it("trouve par la molécule", () => {
    expect(proposerMedicaments("lumefantrine")[0].nom).toBe("Artéméther-Luméfantrine");
  });
  it("attend deux lettres", () => {
    expect(proposerMedicaments("a")).toEqual([]);
  });
});

describe("prixAuCoefficient", () => {
  it("arrondit au-dessus à 50 Ar", () => {
    expect(prixAuCoefficient(430, 1.3)).toBe(600);
    expect(prixAuCoefficient(1000, 1.25)).toBe(1250);
    expect(prixAuCoefficient(0, 1.3)).toBe(0);
  });
});

describe("lireFrappe", () => {
  const frappe = (code: string, ecart: number) =>
    [...code].map((touche, i) => ({ touche, quand: i * ecart }));
  it("reconnaît le rythme d'une douchette", () => {
    expect(lireFrappe(frappe("6191234567890", 10))).toBe("6191234567890");
  });
  it("ignore une main qui tape", () => {
    expect(lireFrappe(frappe("6191234567890", 150))).toBeNull();
  });
  it("ignore un code trop court", () => {
    expect(lireFrappe(frappe("123", 5))).toBeNull();
  });
});
