import { describe, expect, it } from "vitest";
import {
  aimanterDeplacement,
  aimanterRedimension,
  basculerSection,
  ciblesAimant,
  colonneResolue,
  deplacerSection,
  MARGES,
  ORDRE_TICKET,
  redimensionner,
  TAILLE_MIN,
  BLOCS,
  blocsDeDepart,
  blocsResolus,
  contraindre,
  creerDisposition,
  dispositionDuType,
  dupliquerDisposition,
  FEUILLE,
  lireLibre,
  poserBloc,
  reinitialiserDisposition,
  type ReglagesLibres,
} from "./disposition";
import {
  lireReglagesDocuments,
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ModeleDocument,
} from "./reglages";

const MODELES: ModeleDocument[] = ["classique", "bandeau", "epure", "compact"];

const dansLaFeuille = (b: { x: number; y: number; l: number; h: number }) =>
  b.x >= 0 && b.y >= 0 && b.x + b.l <= FEUILLE.l && b.y + b.h <= FEUILLE.h;

describe("sauvegarde et relecture", () => {
  it("une disposition se recharge à l'identique", () => {
    let d = creerDisposition("facture", "bandeau", "Ma facture");
    d = poserBloc(d, "logo", { x: 150, y: 20, l: 40, h: 20, align: "droite" });
    d = poserBloc(d, "signatures", { masque: true });
    d = poserBloc(d, "pied", { repete: false });
    const libre: ReglagesLibres = { dispositions: { [d.id]: d }, parType: { facture: d.id } };
    const reglages = { ...REGLAGES_DOCUMENTS_PAR_DEFAUT, libre };

    const relu = lireReglagesDocuments(JSON.parse(JSON.stringify(reglages)));

    expect(relu.libre).toEqual(libre);
    expect(dispositionDuType(relu.libre, "facture")).toEqual(d);
  });

  it("sans éditeur, aucun type n'a de disposition", () => {
    const r = lireReglagesDocuments(undefined);
    expect(r.libre).toEqual({ dispositions: {}, parType: {} });
    expect(dispositionDuType(r.libre, "facture")).toBeNull();
  });

  it("une boutique enregistrée avant le mode libre se relit sans rien changer d'autre", () => {
    const avant = { modele: "epure", couleur: "#123456", pages: { facture: {} } };
    const r = lireReglagesDocuments(avant);
    expect(r.modele).toBe("epure");
    expect(r.libre.parType).toEqual({});
  });

  it("écarte ce qui ne tient pas debout", () => {
    const lu = lireLibre({
      dispositions: {
        a: {
          type: "facture",
          base: "classique",
          nom: "A",
          blocs: { logo: { x: 1, y: 2, l: 30, h: 10 }, inconnu: { x: 0, y: 0, l: 5, h: 5 } },
        },
        b: { type: "facture", base: "rococo", blocs: {} },
        c: "n'importe quoi",
      },
      parType: { facture: "a", devis: "a", recu: "fantome" },
    });
    expect(Object.keys(lu.dispositions)).toEqual(["a"]);
    expect(Object.keys(lu.dispositions.a.blocs)).toEqual(["logo"]);
    // Une disposition de facture ne s'applique pas à un devis.
    expect(lu.parType).toEqual({ facture: "a" });
  });
});

describe("le cadre A4", () => {
  it("aucun bloc ne sort de la feuille, quoi qu'on y écrive", () => {
    for (const b of [
      { x: -40, y: -10, l: 50, h: 20 },
      { x: 200, y: 290, l: 50, h: 20 },
      { x: 0, y: 0, l: 900, h: 900 },
      { x: 10, y: 10, l: 0, h: -3 },
    ]) {
      expect(dansLaFeuille(contraindre(b))).toBe(true);
    }
  });

  it("les positions de départ des quatre modèles tiennent dans la feuille", () => {
    for (const m of MODELES) {
      for (const b of Object.values(blocsDeDepart(m))) expect(dansLaFeuille(b)).toBe(true);
    }
  });

  it("un bloc glissé hors de la feuille est ramené au bord", () => {
    const d = poserBloc(creerDisposition("facture", "classique", "x"), "totaux", {
      x: 500,
      y: 500,
    });
    const t = blocsResolus(d).totaux;
    expect(t.x + t.l).toBe(FEUILLE.l);
    expect(t.y + t.h).toBe(FEUILLE.h);
  });
});

describe("les mentions obligatoires", () => {
  const obligatoires = BLOCS.filter((b) => b.verrouille).map((b) => b.cle);

  it("sont le nom, le numéro et la date, le tableau et les totaux", () => {
    expect(obligatoires).toEqual(["nom", "reperes", "tableau", "totaux"]);
  });

  it("ne se masquent pas, ni depuis l'éditeur ni depuis la base", () => {
    let d = creerDisposition("facture", "classique", "x");
    for (const cle of obligatoires) d = poserBloc(d, cle, { masque: true, x: 3, y: 250 });
    const brut = JSON.parse(JSON.stringify(d));
    for (const cle of obligatoires) brut.blocs[cle].masque = true;
    const relu = lireLibre({ dispositions: { [d.id]: brut } }).dispositions[d.id];

    for (const r of [blocsResolus(d), blocsResolus(relu)]) {
      for (const cle of obligatoires) {
        expect(r[cle].masque).toBeUndefined();
        expect(r[cle].x).toBe(3);
      }
    }
  });
});

describe("revenir, dupliquer", () => {
  it("revenir au modèle d'origine remet les positions sans toucher au nom", () => {
    const d = poserBloc(creerDisposition("devis", "compact", "Devis chantier"), "logo", { x: 100 });
    const r = reinitialiserDisposition(d);
    expect(r.nom).toBe("Devis chantier");
    expect(r.id).toBe(d.id);
    expect(blocsResolus(r)).toEqual(blocsResolus(creerDisposition("devis", "compact", "")));
  });

  it("dupliquer donne une variante indépendante", () => {
    const d = creerDisposition("facture", "classique", "A");
    const copie = poserBloc(dupliquerDisposition(d, "B"), "logo", { x: 120 });
    expect(copie.id).not.toBe(d.id);
    expect(blocsResolus(d).logo.x).toBe(15);
    expect(blocsResolus(copie).logo.x).toBe(120);
  });
});

describe("redimensionner par un coin", () => {
  const b = { x: 50, y: 50, l: 40, h: 20 };

  it("le coin opposé ne bouge pas", () => {
    const r = redimensionner(b, "no", -10, -5);
    expect(r).toMatchObject({ x: 40, y: 45, l: 50, h: 25 });
  });

  it("garde une taille minimale sans faire glisser le bloc", () => {
    const r = redimensionner(b, "se", -100, -100);
    expect(r).toMatchObject({ x: 50, y: 50, l: TAILLE_MIN, h: TAILLE_MIN });
  });

  it("ne tire jamais un bord hors de la feuille", () => {
    for (const p of ["no", "ne", "so", "se"] as const) {
      expect(dansLaFeuille(redimensionner(b, p, 500, 500))).toBe(true);
      expect(dansLaFeuille(redimensionner(b, p, -500, -500))).toBe(true);
    }
  });
});

describe("l'aimantation", () => {
  const d = creerDisposition("facture", "classique", "x");
  const cibles = ciblesAimant(blocsResolus(d), "logo", "classique");

  it("colle un bloc à la marge quand il en passe près", () => {
    const r = aimanterDeplacement({ x: 16.2, y: 100.3, l: 13, h: 13 }, cibles, 1.5);
    expect(r.bloc.x).toBe(MARGES.classique.x);
    expect(r.guides).toContainEqual({ axe: "x", pos: 15 });
  });

  it("aligne le milieu sur le milieu de la feuille", () => {
    const r = aimanterDeplacement({ x: 90, y: 150, l: 31, h: 7 }, cibles, 1.5);
    expect(r.bloc.x + r.bloc.l / 2).toBe(105);
  });

  it("colle au bord d'un autre bloc", () => {
    const t = blocsResolus(d).tableau;
    const r = aimanterDeplacement({ x: 60, y: t.y + t.h + 0.7, l: 20, h: 3 }, cibles, 1.5);
    expect(r.bloc.y).toBe(t.y + t.h);
  });

  it("laisse le bloc où il est au-delà du seuil, ou quand l'aimant est coupé", () => {
    const loin = { x: 40.3, y: 120.3, l: 13, h: 13 };
    expect(aimanterDeplacement(loin, cibles, 1.5)).toEqual({ bloc: loin, guides: [] });
    expect(aimanterDeplacement({ ...loin, x: 15.4 }, cibles, 0).bloc.x).toBe(15.4);
  });

  it("n'aimante que les bords qu'on tire", () => {
    const r = aimanterRedimension({ x: 20, y: 60, l: 174.4, h: 10 }, "se", cibles, 1.5);
    expect(r.bloc.x).toBe(20);
    expect(r.bloc.x + r.bloc.l).toBe(195);
  });

  it("ignore un bloc masqué", () => {
    const t = blocsResolus(d).tampon;
    const c = ciblesAimant(
      blocsResolus(poserBloc(d, "tampon", { masque: true })),
      "logo",
      "classique",
    );
    expect(c.y).not.toContain(t.y + t.h);
  });
});

describe("le ticket, en colonne", () => {
  it("part de l'ordre actuel du ticket", () => {
    const t = creerDisposition("ticket", "classique", "Caisse");
    expect(colonneResolue(t)).toEqual({ ordre: ORDRE_TICKET, masques: [] });
  });

  it("déplace une section et se recharge à l'identique", () => {
    let t = creerDisposition("ticket", "classique", "Caisse");
    t = deplacerSection(t, "codeBarres", 0);
    t = basculerSection(t, "codeBarres");
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { [t.id]: t } })));
    expect(relu.dispositions[t.id]).toEqual(t);
    expect(colonneResolue(t).ordre[0]).toBe("codeBarres");
  });

  it("ne masque aucune mention obligatoire du ticket", () => {
    let t = creerDisposition("ticket", "classique", "Caisse");
    for (const cle of ["entete", "infos", "articles", "totaux", "pied"] as const) {
      t = basculerSection(t, cle);
    }
    expect(colonneResolue(t).masques).toEqual([]);
    const lu = lireLibre({
      dispositions: {
        a: {
          type: "ticket",
          base: "classique",
          blocs: {},
          colonne: { ordre: ["pied", "pied", "x"], masques: ["pied", "codeBarres"] },
        },
      },
    }).dispositions.a;
    expect(colonneResolue(lu).masques).toEqual(["codeBarres"]);
    expect([...colonneResolue(lu).ordre].sort()).toEqual([...ORDRE_TICKET].sort());
  });

  it("revenir au modèle d'origine remet l'ordre du ticket", () => {
    const t = deplacerSection(creerDisposition("ticket", "classique", "c"), "pied", 0);
    expect(colonneResolue(reinitialiserDisposition(t)).ordre).toEqual(ORDRE_TICKET);
  });
});
