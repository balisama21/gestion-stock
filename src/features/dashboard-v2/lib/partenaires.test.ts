import { describe, expect, it } from "vitest";
import { produitsAchetesA } from "../lib/partenaires";

const achat = (designation: string, date: string, supplierId: string | null, fournisseur = "") => ({
  designation,
  date,
  supplierId,
  fournisseur,
});

describe("ce qu'on achète à un fournisseur", () => {
  const f = { id: "f1", nom: "Chine" };

  it("vient des achats rattachés à sa fiche, du plus récent au plus ancien, sans doublon", () => {
    expect(
      produitsAchetesA(f, [
        achat("Carton", "2026-10-01", "f1"),
        achat("Film", "2026-10-10", "f1"),
        achat("Carton", "2026-10-12", "f1"),
        achat("Riz", "2026-10-12", "f2"),
      ]),
    ).toBe("Carton, Film");
  });

  it("reprend les achats saisis sous son nom quand ils n'ont pas de fiche", () => {
    expect(produitsAchetesA(f, [achat("Sachet", "2026-10-01", null, " chine ")])).toBe("Sachet");
  });

  it("ne donne que les trois premiers, puis le reste en nombre", () => {
    const achats = ["A", "B", "C", "D", "E"].map((d, i) => achat(d, `2026-10-0${i + 1}`, "f1"));
    expect(produitsAchetesA(f, achats)).toBe("E, D, C +2");
  });

  it("reste vide quand rien ne lui a été acheté", () => {
    expect(produitsAchetesA(f, [])).toBe("");
  });
});
