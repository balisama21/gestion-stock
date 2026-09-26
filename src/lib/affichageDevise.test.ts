import { afterEach, describe, expect, it } from "vitest";
import { definirDevises, versAffichage, symboleDeSaisie } from "./affichageDevise";
import { formatCurrency } from "../utils/formulas";
import { montant, argent } from "../features/documents/lib/format";
import { montantEnLettres } from "../features/documents/lib/montantEnLettres";

const MGA = { code: "MGA", symbole: "Ar", decimales: 0 };
const EUR = { code: "EUR", symbole: "€", decimales: 2, nom: "Euro", taux: 5000 };
const KMF = { code: "KMF", symbole: "CF", decimales: 0, nom: "Franc comorien", taux: 10 };

describe("devise d'affichage", () => {
  afterEach(() => definirDevises(MGA, null));

  it("sans devise d'affichage, rien ne change", () => {
    definirDevises(MGA, null);
    expect(formatCurrency(347800)).toBe("347\u00a0800 Ar");
    expect(montant(347800, "Ar")).toBe("347\u00a0800\u00a0Ar");
  });

  it("en euros, le montant est CONVERTI, pas seulement renommé", () => {
    definirDevises(MGA, EUR);
    expect(versAffichage(347800)).toBeCloseTo(69.56);
    expect(formatCurrency(347800)).toBe("69,56 €");
    expect(montant(347800, "Ar")).toBe("69,56\u00a0€");
    expect(argent(347800)).toBe("69,56");
    // On saisit toujours dans la devise de tenue.
    expect(symboleDeSaisie()).toBe("Ar");
  });

  it("le montant en lettres suit la devise d'affichage, et se tait s'il y a des centimes", () => {
    definirDevises(MGA, KMF);
    expect(montantEnLettres(10000)).toMatch(/mille franc comorien$/);
    definirDevises(MGA, EUR);
    expect(montantEnLettres(10000)).toBeNull();
  });

  it("choisir la devise de tenue comme affichage désactive la conversion", () => {
    definirDevises(MGA, { ...EUR, code: "MGA" });
    expect(formatCurrency(1000)).toBe("1\u00a0000 Ar");
  });
});
