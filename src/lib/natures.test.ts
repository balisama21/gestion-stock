import { describe, expect, it } from "vitest";
import { NATURES, avecLInterieur, natureChoisissable, natureDe } from "./natures";
import type { Personnalisation } from "./personnalisation";

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

describe("l'intérieur d'une nature", () => {
  it("ne change rien pour une boutique standard", () => {
    const p = { modules: { ventes: { libelle: "Encaissements" } } };
    expect(avecLInterieur(p)).toBe(p);
  });

  it("habille un bar-karaoké sans écraser ses choix", () => {
    const p = avecLInterieur<Personnalisation>({
      nature: "karaoke",
      modules: { ventes: { libelle: "Comptoir" }, devis: { masque: false } },
    });
    expect(p.modules?.produits?.libelle).toBe("Carte");
    expect(p.modules?.dashboard?.libelle).toBe("Ce soir");
    // Un nom choisi par la boutique l'emporte.
    expect(p.modules?.ventes?.libelle).toBe("Comptoir");
    // Un écran réaffiché par la boutique reste affiché.
    expect(p.modules?.devis?.masque).toBe(false);
    expect(p.modules?.commandes?.masque).toBe(true);
  });
});
