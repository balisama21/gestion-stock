import { describe, expect, it } from "vitest";
import {
  cleDeListe,
  correspond,
  libelleEffectuePar,
  lireNomsCsv,
  lireReglagesListes,
  valeurEquivalente,
  valeursDeLaListe,
  type ValeurDeListe,
} from "./listes";

/**
 * L'ANTI-DOUBLON DOIT DIRE LA MÊME CHOSE QUE LA BASE.
 *
 * `cleDeListe` ici et `cle_de_liste(text)` en base portent la même
 * règle : c'est la seconde qui tient l'index unique. Si elles
 * divergeaient, l'écran proposerait d'ajouter une valeur que la base
 * refuserait, et le message d'erreur serait incompréhensible pour le
 * commerçant qui vient juste de taper un nom.
 */
describe("la clé de comparaison", () => {
  it("ignore la casse", () => {
    expect(cleDeListe("GROSSISTE")).toBe("grossiste");
  });

  it("ignore les accents", () => {
    expect(cleDeListe("Électricité et eau")).toBe("electricite et eau");
    expect(cleDeListe("Détaillant")).toBe("detaillant");
  });

  it("réduit les espaces, en bout comme au milieu", () => {
    expect(cleDeListe("  Taxes   et   impôts ")).toBe("taxes et impots");
  });

  it("rend une chaîne vide pour un texte qui n'a que des espaces", () => {
    expect(cleDeListe("   ")).toBe("");
  });
});

describe("la recherche du sélecteur", () => {
  it("trouve dès la première lettre, sans accent ni majuscule", () => {
    expect(correspond("Électricité et eau", "e")).toBe(true);
    expect(correspond("Électricité et eau", "ELECTR")).toBe(true);
    expect(correspond("Électricité et eau", "eau")).toBe(true);
  });

  it("ne trouve pas ce qui n'y est pas", () => {
    expect(correspond("Loyer", "transport")).toBe(false);
  });
});

describe("l'anti-doublon", () => {
  const liste = [{ nom: "Grossiste" }, { nom: "Détaillant" }];

  it("reconnaît la même valeur écrite autrement", () => {
    expect(valeurEquivalente(liste, "grossiste")?.nom).toBe("Grossiste");
    expect(valeurEquivalente(liste, "  DETAILLANT ")?.nom).toBe("Détaillant");
  });

  it("laisse passer une valeur réellement nouvelle", () => {
    expect(valeurEquivalente(liste, "Importateur")).toBeUndefined();
  });

  it("ne voit pas de doublon dans un texte vide", () => {
    expect(valeurEquivalente(liste, "   ")).toBeUndefined();
  });
});

/* ── Ce que le sélecteur montre ── */

const valeur = (p: Partial<ValeurDeListe> & { id: string; nom: string }): ValeurDeListe =>
  ({
    actif: true,
    created_at: "",
    created_by: null,
    ordre: 0,
    parent_id: null,
    store_id: "b",
    taux_marge: null,
    updated_at: "",
    usage: "produit",
    ...p,
  }) as ValeurDeListe;

describe("les valeurs d'une liste", () => {
  const toutes = [
    valeur({ id: "1", nom: "Boissons", ordre: 20 }),
    valeur({ id: "2", nom: "Alimentation", ordre: 10 }),
    valeur({ id: "3", nom: "Ancien poste", ordre: 30, actif: false }),
    valeur({ id: "4", nom: "Loyer", usage: "depense" }),
  ];

  it("ne retient que celles de l'usage demandé", () => {
    expect(valeursDeLaListe(toutes, "depense").map((v) => v.nom)).toEqual(["Loyer"]);
  });

  it("suit l'ordre choisi par la boutique, pas l'alphabet", () => {
    expect(valeursDeLaListe(toutes, "produit").map((v) => v.nom)).toEqual([
      "Alimentation",
      "Boissons",
    ]);
  });

  it("cache les archivées", () => {
    expect(valeursDeLaListe(toutes, "produit").map((v) => v.id)).not.toContain("3");
  });

  /**
   * Le cas qui compte vraiment : on ouvre une vieille dépense dont le
   * poste a été archivé depuis. S'il disparaissait du sélecteur,
   * enregistrer la moindre correction le remplacerait par du vide.
   */
  it("garde l'archivée que l'enregistrement ouvert porte encore", () => {
    expect(valeursDeLaListe(toutes, "produit", "3").map((v) => v.id)).toContain("3");
  });
});

/* ── Les réglages ── */

describe("qui peut ajouter une valeur", () => {
  it("vaut « tout le monde » quand rien n'est réglé", () => {
    expect(lireReglagesListes({}).ajoutDepuisFormulaire).toBe("tous");
  });

  it("lit le réglage restrictif quand il est posé", () => {
    expect(
      lireReglagesListes({ listes: { ajoutDepuisFormulaire: "responsables" } })
        .ajoutDepuisFormulaire,
    ).toBe("responsables");
  });

  it("ignore une valeur qu'elle ne connaît pas plutôt que de fermer la porte", () => {
    expect(
      lireReglagesListes({ listes: { ajoutDepuisFormulaire: "n'importe quoi" } })
        .ajoutDepuisFormulaire,
    ).toBe("tous");
  });
});

describe("le nom du champ « Effectué par »", () => {
  it("est celui du logiciel tant que la boutique n'en choisit pas un", () => {
    expect(libelleEffectuePar({})).toBe("Effectué par");
  });

  it("est celui de la boutique quand elle en a choisi un", () => {
    expect(libelleEffectuePar({ libelles: { effectuePar: "Exécutant" } })).toBe("Exécutant");
  });

  it("ignore un libellé qui n'est que des espaces", () => {
    expect(libelleEffectuePar({ libelles: { effectuePar: "   " } })).toBe("Effectué par");
  });
});

/* ── L'import ── */

describe("la lecture d'un fichier de noms", () => {
  it("prend un nom par ligne", () => {
    expect(lireNomsCsv("Doypacks\nSachets\nCartons")).toEqual(["Doypacks", "Sachets", "Cartons"]);
  });

  it("ne garde que la première colonne", () => {
    expect(lireNomsCsv("Doypacks;100g;vrac\nSachets,kraft")).toEqual(["Doypacks", "Sachets"]);
  });

  it("retire les guillemets et les lignes vides", () => {
    expect(lireNomsCsv('"Doypacks"\n\n  \nSachets\n')).toEqual(["Doypacks", "Sachets"]);
  });

  it("retire les doublons du fichier lui-même, accents compris", () => {
    expect(lireNomsCsv("Équipements\nequipements\nÉQUIPEMENTS")).toEqual(["Équipements"]);
  });

  it("accepte les fins de ligne Windows", () => {
    expect(lireNomsCsv("Doypacks\r\nSachets")).toEqual(["Doypacks", "Sachets"]);
  });
});
