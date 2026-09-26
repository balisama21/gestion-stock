import { describe, expect, it } from "vitest";
import {
  blocsResolus,
  creerDisposition,
  FEUILLE,
  poserBloc,
  type Disposition,
} from "./disposition";
import { feuilleLibre, paginerLibre, zonesLibres, type ZonesLibres } from "./paginationLibre";

const zonesDe = (d: Disposition) => zonesLibres(blocsResolus(d), d.base);
const classique = creerDisposition("facture", "classique", "x");
const lignes = (n: number, h = 10) => ({ enTete: 8, lignes: Array.from({ length: n }, () => h) });

const aplatir = (pages: number[][]) => pages.flat();

describe("les zones d'une disposition", () => {
  const z = zonesDe(classique);

  it("sépare ce qui est au-dessus du tableau de ce qui est dessous", () => {
    expect(z.avant).toEqual(
      expect.arrayContaining(["logo", "nom", "titre", "reperes", "emetteur", "destinataire"]),
    );
    expect(z.apres).toEqual(expect.arrayContaining(["totaux", "lettres", "signatures"]));
    expect(z.repetes).toEqual(["pied"]);
  });

  it("le tableau des pages suivantes s'arrête au-dessus du pied répété", () => {
    const pied = blocsResolus(classique).pied;
    expect(z.suite.y + z.suite.h).toBeLessThanOrEqual(pied.y);
    expect(z.derniere.y + z.derniere.h).toBeLessThanOrEqual(blocsResolus(classique).totaux.y);
  });

  it("tous les cadres restent dans la feuille A4", () => {
    for (const base of ["classique", "bandeau", "epure", "compact"] as const) {
      const zz: ZonesLibres = zonesDe(creerDisposition("facture", base, "x"));
      for (const c of [zz.premiere, zz.suite, zz.derniere]) {
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.h).toBeGreaterThanOrEqual(0);
        expect(c.y + c.h).toBeLessThanOrEqual(FEUILLE.h);
      }
    }
  });
});

describe("la répartition des lignes", () => {
  const z = zonesDe(classique);

  it("une seule page quand tout tient dans le cadre dessiné", () => {
    expect(paginerLibre(lignes(5), z)).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("répartit sans perdre ni doubler une ligne, dans l'ordre", () => {
    for (const n of [10, 25, 60, 200]) {
      const pages = paginerLibre(lignes(n), z);
      expect(aplatir(pages)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(pages.length).toBeGreaterThan(1);
    }
  });

  it("la page 1 reste dans son cadre, la dernière laisse la place aux totaux", () => {
    const pages = paginerLibre(lignes(60), z);
    const hauteur = (p: number[]) => 8 + p.length * 10;
    expect(hauteur(pages[0])).toBeLessThanOrEqual(z.premiere.h);
    expect(hauteur(pages[pages.length - 1])).toBeLessThanOrEqual(z.derniere.h);
    for (const p of pages.slice(1, -1)) expect(hauteur(p)).toBeLessThanOrEqual(z.suite.h);
  });

  it("ne boucle pas quand la dernière page n'a plus de place pour le tableau", () => {
    const haut = poserBloc(classique, "tableau", { y: 14, l: 120 });
    const serre = poserBloc(haut, "totaux", { x: 150, y: 14 });
    expect(zonesDe(serre).derniere.h).toBe(0);
    const pages = paginerLibre(lignes(40), zonesDe(serre));
    expect(aplatir(pages)).toHaveLength(40);
    expect(pages[pages.length - 1]).toEqual([]);
  });

  it("pose une ligne plus haute qu'une page plutôt que de la perdre", () => {
    const pages = paginerLibre({ enTete: 8, lignes: [10, 500, 10] }, z);
    expect(aplatir(pages)).toEqual([0, 1, 2]);
  });
});

describe("ce que porte chaque feuille", () => {
  const z = zonesDe(classique);

  it("une page unique porte tout", () => {
    const f = feuilleLibre(0, 1, z);
    expect(f.cles).toEqual(expect.arrayContaining(["nom", "reperes", "tableau", "totaux", "pied"]));
    expect(f.cadre).toEqual(z.premiere);
  });

  it("la première porte l'en-tête, la dernière les totaux, toutes le pied", () => {
    const [p1, p2, p3] = [0, 1, 2].map((r) => feuilleLibre(r, 3, z));
    expect(p1.cles).toContain("reperes");
    expect(p1.cles).not.toContain("totaux");
    expect(p2.cles).toEqual(["tableau", "pied"]);
    expect(p3.cles).toContain("totaux");
    expect(p3.cles).not.toContain("reperes");
    for (const p of [p1, p2, p3]) expect(p.cles).toContain("pied");
  });

  it("un bloc masqué n'apparaît sur aucune page", () => {
    const zz = zonesDe(poserBloc(classique, "signatures", { masque: true }));
    for (const r of [0, 1, 2]) expect(feuilleLibre(r, 3, zz).cles).not.toContain("signatures");
  });
});
