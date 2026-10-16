import { describe, expect, it } from "vitest";
import { landingDepuisJson, lienWhatsapp } from "./landingMarque";

describe("landingDepuisJson", () => {
  it("rejette ce qui n'est pas une page", () => {
    expect(landingDepuisJson(null)).toBeNull();
    expect(landingDepuisJson([])).toBeNull();
    expect(landingDepuisJson({ sousTitre: "sans titre" })).toBeNull();
  });

  it("garde les blocs valides et ignore le reste", () => {
    const l = landingDepuisJson({
      titre: "  Produits et emballages  ",
      offres: {
        titre: "Offres",
        elements: [{ titre: "Cartons", texte: "x" }, { texte: "sans titre" }, 3],
      },
      arguments: { elements: [] },
      etapes: "pas un bloc",
      contact: { telephone: " ", email: "contact@kinvest.mg" },
    });
    expect(l?.titre).toBe("Produits et emballages");
    expect(l?.offres?.elements).toEqual([{ titre: "Cartons", texte: "x" }]);
    expect(l?.arguments).toBeNull();
    expect(l?.etapes).toBeNull();
    expect(l?.contact).toEqual({
      telephones: [],
      whatsapp: null,
      emails: ["contact@kinvest.mg"],
      adresse: null,
    });
  });

  it("accepte plusieurs téléphones et e-mails, et des photos sûres", () => {
    const l = landingDepuisJson({
      titre: "Catalogue",
      photo: "1769355104335-acef3aa4c9b6",
      catalogue: {
        elements: [
          { titre: "Bocaux", image: "javascript:alert(1)", formats: " 50 à 150 ml " },
          { titre: "Flacons", image: "/marques/k/flacon.jpg" },
        ],
      },
      contact: { telephones: ["+269 334 03 57", " ", "+269 334 03 57", "+261 34 19 600 15"] },
    });
    expect(l?.photo).toBe("1769355104335-acef3aa4c9b6");
    expect(l?.catalogue?.elements).toEqual([
      { titre: "Bocaux", texte: "", formats: "50 à 150 ml" },
      { titre: "Flacons", texte: "", image: "/marques/k/flacon.jpg" },
    ]);
    expect(l?.contact?.telephones).toEqual(["+269 334 03 57", "+261 34 19 600 15"]);
  });

  it("tronque les textes trop longs", () => {
    const l = landingDepuisJson({ titre: "x".repeat(500) });
    expect(l?.titre).toHaveLength(120);
  });
});

describe("lienWhatsapp", () => {
  it("ne garde que les chiffres", () => {
    expect(lienWhatsapp("+261 34 00 000 00")).toBe("https://wa.me/261340000000");
    expect(lienWhatsapp("12")).toBeNull();
  });
});
