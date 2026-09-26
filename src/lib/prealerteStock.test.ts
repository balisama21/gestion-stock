import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BORNES,
  REGLAGES_PAR_DEFAUT,
  SEUIL_DEXEMPLE,
  calculerNiveauDePrealerte,
  etatDeStock,
  exempleDePrealerte,
  lireReglages,
  niveauDePrealerte,
  type ModePrealerte,
  type ReglagesAlertesStock,
} from "./prealerteStock";

/**
 * LES DEUX MONDES DOIVENT DIRE LA MÊME CHOSE.
 *
 * Le niveau de préalerte se calcule en SQL, pour que les notifications
 * partent application fermée, et en TypeScript, pour l'affichage et
 * l'export. Deux implémentations, donc — et ce fichier est ce qui les
 * empêche de dériver.
 *
 * `docs/prealerte/cas-de-calcul.json` est la source unique. Le premier
 * bloc de tests la rejoue contre le TypeScript ; le second vérifie que
 * le script de vérification SQL porte bien la même liste, et affiche le
 * texte à recopier quand ce n'est plus le cas.
 */

interface CasDeCalcul {
  nom: string;
  seuil: number;
  mode: ModePrealerte;
  ecart: number;
  pourcentage: number;
  attendu: number;
}

const lire = (chemin: string) =>
  readFileSync(new URL(chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const CAS: CasDeCalcul[] = JSON.parse(lire("../../docs/prealerte/cas-de-calcul.json")).cas;

/** Fabrique des réglages complets à partir de ce qui compte pour le test. */
const reglages = (patch: Partial<ReglagesAlertesStock> = {}): ReglagesAlertesStock => ({
  ...REGLAGES_PAR_DEFAUT,
  prealerteActive: true,
  ...patch,
});

describe("le niveau de préalerte, cas par cas", () => {
  it("la liste de cas est bien chargée", () => {
    // Sans cette garde, un chemin cassé ferait passer une boucle vide.
    expect(CAS.length).toBeGreaterThanOrEqual(12);
  });

  for (const c of CAS) {
    it(c.nom, () => {
      expect(calculerNiveauDePrealerte(c.seuil, c.mode, c.ecart, c.pourcentage)).toBe(c.attendu);
    });
  }
});

describe("le script de vérification SQL rejoue la même liste", () => {
  /** Le même format que celui posé dans le fichier .sql, à la lettre. */
  const blocAttendu = CAS.map(
    (c, i) =>
      `    (${i + 1}, ${c.seuil}, '${c.mode}', ${c.ecart}, ${c.pourcentage}, ${c.attendu}, ` +
      `'${c.nom.replace(/'/g, "''")}')`,
  ).join(",\n");

  it("le bloc engendré correspond au JSON", () => {
    const sql = lire("../../docs/prealerte/verification-du-calcul.sql");
    const debut = sql.indexOf("▼▼▼");
    const fin = sql.indexOf("▲▲▲");
    expect(debut, "marqueur de début du bloc engendré").toBeGreaterThan(-1);
    expect(fin, "marqueur de fin du bloc engendré").toBeGreaterThan(debut);

    // On repart de la fin de la LIGNE du marqueur, pas du marqueur.
    const bloc = sql
      .slice(sql.indexOf("\n", debut) + 1, sql.lastIndexOf("\n", fin))
      .replace(/\n$/, "");

    expect(
      bloc,
      "docs/prealerte/verification-du-calcul.sql a pris du retard sur le JSON.\n" +
        "Recopier ce bloc entre les deux marqueurs :\n\n" +
        blocAttendu +
        "\n",
    ).toBe(blocAttendu);
  });
});

describe("désactivée, la préalerte n'existe pas", () => {
  it("ne rend aucun niveau", () => {
    expect(niveauDePrealerte(3, REGLAGES_PAR_DEFAUT)).toBe(0);
  });

  it("aucun produit ne peut se retrouver en préalerte", () => {
    // Le stock qui aurait déclenché l'orange si la fonction était active.
    expect(etatDeStock(5, 3, REGLAGES_PAR_DEFAUT)).toBe("normal");
  });

  it("la règle du seuil, elle, ne change pas", () => {
    // C'est la garantie « rien ne change pour les boutiques qui
    // n'activent pas » : le rouge reste exactement ce qu'il était.
    expect(etatDeStock(3, 3, REGLAGES_PAR_DEFAUT)).toBe("sous_le_seuil");
    expect(etatDeStock(0, 3, REGLAGES_PAR_DEFAUT)).toBe("sous_le_seuil");
  });
});

describe("les trois états d'un produit", () => {
  const r = reglages({ mode: "ecart", ecart: 2 });

  it("au-dessus de tout", () => {
    expect(etatDeStock(6, 3, r)).toBe("normal");
  });

  it("dans la bande, au niveau exact", () => {
    expect(etatDeStock(5, 3, r)).toBe("prealerte");
  });

  it("dans la bande, juste au-dessus du seuil", () => {
    expect(etatDeStock(4, 3, r)).toBe("prealerte");
  });

  it("sous le seuil l'emporte : on ne dit pas « approche » de ce qui y est déjà", () => {
    expect(etatDeStock(3, 3, r)).toBe("sous_le_seuil");
    expect(etatDeStock(1, 3, r)).toBe("sous_le_seuil");
  });

  it("sans seuil, le produit reste hors du système", () => {
    expect(etatDeStock(0, 0, r)).toBe("normal");
    expect(etatDeStock(1, 0, r)).toBe("normal");
  });

  it("en pourcentage, la bande suit le volume", () => {
    const p = reglages({ mode: "pourcentage", pourcentage: 50 });
    expect(etatDeStock(300, 200, p)).toBe("prealerte");
    expect(etatDeStock(301, 200, p)).toBe("normal");
    expect(etatDeStock(200, 200, p)).toBe("sous_le_seuil");
  });
});

describe("lire ce que la base rend", () => {
  it("pas de ligne, donc fonction désactivée", () => {
    expect(lireReglages(null)).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it("borne les valeurs hors limites", () => {
    const lu = lireReglages({
      store_id: "s",
      prealerte_active: true,
      mode: "pourcentage",
      ecart: 99999,
      pourcentage: 0,
      frequence: "mouvement",
      heure_resume: 40,
      mis_a_jour_le: "2026-09-20T00:00:00Z",
      reappro_active: null,
      reappro_mode: null,
      reappro_valeur: null,
    });

    expect(lu.ecart).toBe(BORNES.ecart.max);
    expect(lu.pourcentage).toBe(BORNES.pourcentage.min);
    expect(lu.heureResume).toBe(BORNES.heureResume.max);
  });

  it("un mode ou une fréquence inconnus retombent sur le défaut", () => {
    const lu = lireReglages({
      store_id: "s",
      prealerte_active: true,
      mode: "autre",
      ecart: 2,
      pourcentage: 50,
      frequence: "autre",
      heure_resume: 8,
      mis_a_jour_le: "2026-09-20T00:00:00Z",
      reappro_active: null,
      reappro_mode: null,
      reappro_valeur: null,
    });

    expect(lu.mode).toBe("ecart");
    expect(lu.frequence).toBe("quotidien");
  });

  it("le canal d'envoi n'est plus un réglage de boutique", () => {
    // Il a déménagé sur la personne : `abonnements_alertes_stock`.
    // Le patron ne décide pas de ce qui arrive dans la boîte des
    // autres, et le type n'en porte donc plus la trace.
    expect(Object.keys(REGLAGES_PAR_DEFAUT)).not.toContain("canaux");
  });
});

describe("l'exemple montré sous le champ", () => {
  const catalogue = [
    { nom: "Ciment", seuil: 10, stock: 40 },
    { nom: "Huile 1 L", seuil: 3, stock: 5 },
    { nom: "Service de pose", seuil: 0, stock: 0 },
  ];

  it("prend le produit le plus proche de son seuil", () => {
    const e = exempleDePrealerte(catalogue, reglages({ mode: "ecart", ecart: 2 }));
    expect(e.produit).toBe("Huile 1 L");
    expect(e.seuil).toBe(3);
    expect(e.niveau).toBe(5);
  });

  it("suit le mode choisi, arrondi compris", () => {
    const e = exempleDePrealerte(catalogue, reglages({ mode: "pourcentage", pourcentage: 50 }));
    expect(e.niveau).toBe(5); // 3 × 1,5 = 4,5 → 5
  });

  it("décrit ce que le réglage fera, même avant qu'il soit actif", () => {
    // La phrase doit se mettre à jour pendant qu'on règle, y compris
    // avant d'avoir basculé l'interrupteur.
    const e = exempleDePrealerte(catalogue, { ...REGLAGES_PAR_DEFAUT, ecart: 4 });
    expect(e.niveau).toBe(7);
  });

  it("retombe sur un seuil parlant quand aucun produit n'en a", () => {
    const e = exempleDePrealerte([{ nom: "Service de pose", seuil: 0, stock: 0 }], reglages());
    expect(e.produit).toBeNull();
    expect(e.seuil).toBe(SEUIL_DEXEMPLE);
    expect(e.niveau).toBe(5);
  });

  it("ne change pas d'un rendu à l'autre quand deux produits sont à égalité", () => {
    const exaequo = [
      { nom: "Zébu séché", seuil: 4, stock: 6 },
      { nom: "Ampoule", seuil: 4, stock: 2 },
    ];
    expect(exempleDePrealerte(exaequo, reglages()).produit).toBe("Ampoule");
  });
});
