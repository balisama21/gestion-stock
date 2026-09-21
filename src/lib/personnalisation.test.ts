import { describe, expect, it } from "vitest";
import { libelleModule, lirePersonnalisation, moduleMasque } from "./personnalisation";

/**
 * LA COLONNE `personnalisation` EST PARTAGÉE.
 *
 * Plusieurs écrans de réglages y rangent leurs propres clés, et tous
 * passent par cette lecture avant de réenregistrer. Une clé qu'elle
 * oublierait de recopier disparaîtrait au premier enregistrement
 * d'un autre écran — sans message, et sans moyen de la retrouver.
 * C'est ce que ces tests empêchent.
 */

describe("les clés inconnues survivent à l'aller-retour", () => {
  it("recopie une clé que ce module ne connaît pas", () => {
    const lu = lirePersonnalisation({ documents: { modele: "bandeau" } });
    expect(lu.documents).toEqual({ modele: "bandeau" });
  });

  it("les garde toutes, même à côté des clés connues", () => {
    const brut = {
      modules: { ventes: { masque: true } },
      rappels: { veilleHeure: 18 },
      documents: { couleur: "#1F4E79" },
      unAutreEcranPlusTard: { quelqueChose: 1 },
    };
    const lu = lirePersonnalisation(brut);
    expect(lu.documents).toEqual({ couleur: "#1F4E79" });
    expect(lu.unAutreEcranPlusTard).toEqual({ quelqueChose: 1 });
    expect(lu.rappels).toEqual({ veilleHeure: 18 });
    expect(moduleMasque(lu, "ventes")).toBe(true);
  });

  it("survit à un aller-retour complet", () => {
    // Le geste exact que fait un écran de réglages : il lit, modifie
    // sa propre clé, et réenregistre le tout.
    const enBase = { documents: { modele: "epure" }, modules: {} };
    const lu = lirePersonnalisation(enBase);
    const reecrit = { ...lu, rappels: { veilleHeure: 7 } };
    expect(lirePersonnalisation(reecrit).documents).toEqual({ modele: "epure" });
  });
});

describe("ce qu'elle borne quand même", () => {
  it("remplace des modules mal formés par un objet vide", () => {
    expect(lirePersonnalisation({ modules: "non" }).modules).toEqual({});
    expect(lirePersonnalisation({}).modules).toEqual({});
  });

  it("ne rend rien d'utile d'une valeur qui n'est pas un objet", () => {
    expect(lirePersonnalisation(null)).toEqual({});
    expect(lirePersonnalisation("texte")).toEqual({});
    expect(lirePersonnalisation([1, 2])).toEqual({});
  });

  it("laisse les libellés se lire comme avant", () => {
    const lu = lirePersonnalisation({
      modules: { ventes: { libelle: "Encaissements" } },
      documents: { modele: "compact" },
    });
    expect(libelleModule(lu, "ventes")).toBe("Encaissements");
    expect(libelleModule(lu, "achats")).toBe("Achats");
  });
});
