import { describe, expect, it } from "vitest";
import {
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
