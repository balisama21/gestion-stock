import { describe, expect, it } from "vitest";
import { PHOTOS_SECTIONS, SECTIONS, photoDeSection } from "./images";

describe("les photos des bannières de section", () => {
  it("plusieurs photos différentes par section", () => {
    for (const { cle } of SECTIONS) {
      const ids = PHOTOS_SECTIONS[cle].map((p) => p.id);
      expect(ids.length).toBeGreaterThanOrEqual(5);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("en auto, une photo par jour, puis la série recommence", () => {
    const serie = PHOTOS_SECTIONS.ventes;
    const jours = serie.map((_, j) => photoDeSection("ventes", new Date(2026, 9, 11 + j)).id);
    expect(new Set(jours).size).toBe(serie.length);
    expect(photoDeSection("ventes", new Date(2026, 9, 11 + serie.length)).id).toBe(jours[0]);
  });

  it("les photos importées entrent dans la rotation", () => {
    const importee = { id: "importee", cadrage: "50% 50%", url: "https://exemple/p.webp" };
    const vues = new Set(
      Array.from(
        { length: 12 },
        (_, j) => photoDeSection("stock", new Date(2026, 9, 11 + j), [importee]).id,
      ),
    );
    expect(vues.has("importee")).toBe(true);
  });

  it("en manuel, la photo choisie reste ; disparue, on revient à l'auto", () => {
    const choisie = PHOTOS_SECTIONS.argent[3];
    for (let j = 0; j < 7; j++)
      expect(
        photoDeSection("argent", new Date(2026, 9, 11 + j), [], {
          mode: "manuel",
          photoId: choisie.id,
        }),
      ).toEqual(choisie);
    expect(
      photoDeSection("argent", new Date(2026, 9, 11), [], { mode: "manuel", photoId: "supprimee" }),
    ).toEqual(photoDeSection("argent", new Date(2026, 9, 11)));
  });
});
