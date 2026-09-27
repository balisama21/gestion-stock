import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Libre } from "../templates/Libre";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import {
  ajouterElement,
  blocsResolus,
  creerDisposition,
  habiller,
  imagesPosees,
  lireLibre,
  niveauDuBloc,
  poserBloc,
  retirerElement,
  type Disposition,
} from "./disposition";
import { zonesLibres } from "./paginationLibre";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const IMAGE = { chemin: "boutique-1/abc.png", largeur: 400, hauteur: 200 };

const feuille = (d: Disposition, images: Record<string, string> = {}) =>
  render(
    <Libre
      document={doc}
      base={d.base}
      blocs={blocsResolus(d)}
      lignes={doc.lignes}
      pagination={null}
      cachets={{ cachets: [], images }}
    />,
  ).container;

const relire = (d: Disposition) =>
  lireLibre(JSON.parse(JSON.stringify({ dispositions: { [d.id]: d } }))).dispositions[d.id];

describe("ajouter des éléments sur la feuille", () => {
  it("un texte libre s'écrit, et vide il ne laisse rien", () => {
    const depart = creerDisposition("facture", "classique", "x");
    const { disposition, cle } = ajouterElement(depart, { genre: "texte" });
    expect(feuille(disposition).querySelector(`[data-bloc="${cle}"]`)).toBeNull();
    const ecrit = poserBloc(disposition, cle, { textes: { texte: "Livraison offerte\nà Tana" } });
    const bloc = feuille(ecrit).querySelector<HTMLElement>(`[data-bloc="${cle}"]`)!;
    expect(bloc.textContent).toBe("Livraison offerte\nà Tana");
    expect(bloc.className).toContain("bl-el-texte");
  });

  it("un trait suit la forme de son cadre, dans la couleur et l'épaisseur choisies", () => {
    const ajout = ajouterElement(creerDisposition("facture", "classique", "x"), {
      genre: "trait",
    });
    const cle = ajout.cle;
    let d = ajout.disposition;
    d = habiller(d, cle, { bordure: 1, bordureCouleur: "#8E2F3C" });
    let trait = feuille(d).querySelector<HTMLElement>(`[data-bloc="${cle}"] .doc-libre-trait`)!;
    expect(trait.style.height).toBe("1mm");
    expect(trait.style.width).toBe("100%");
    expect(trait.style.background).toMatch(/142, 47, 60|#8E2F3C/i);
    // Le trait ne porte pas de bordure autour de lui.
    expect(trait.parentElement?.style.border).toBe("");

    d = poserBloc(d, cle, { l: 4, h: 80 });
    trait = feuille(d).querySelector<HTMLElement>(`[data-bloc="${cle}"] .doc-libre-trait`)!;
    expect(trait.style.width).toBe("1mm");
    expect(trait.style.height).toBe("100%");
  });

  it("un cadre naît avec un trait fin et passe sous le texte", () => {
    const { disposition: d, cle } = ajouterElement(creerDisposition("facture", "classique", "x"), {
      genre: "cadre",
    });
    const cadre = feuille(d).querySelector<HTMLElement>(`[data-bloc="${cle}"]`)!;
    expect(cadre.style.border).toContain("0.3mm solid");
    expect(cadre.style.zIndex).toBe("0");
    expect(niveauDuBloc(cle, blocsResolus(d)[cle])).toBe(0);
  });

  it("une image garde ses proportions et s'affiche une fois chargée", () => {
    const { disposition: d, cle } = ajouterElement(creerDisposition("facture", "classique", "x"), {
      genre: "image",
      image: IMAGE,
    });
    const b = blocsResolus(d)[cle];
    expect(b.h / b.l).toBeCloseTo(0.5, 1);
    expect(imagesPosees(d)).toEqual([IMAGE.chemin]);
    expect(feuille(d).querySelector(`[data-bloc="${cle}"]`)).toBeNull();
    const img = feuille(d, { [IMAGE.chemin]: "data:image/png;base64,AA" }).querySelector(
      `[data-bloc="${cle}"] img`,
    );
    expect(img?.getAttribute("src")).toBe("data:image/png;base64,AA");
  });

  it("se retire sans toucher au reste", () => {
    const depart = creerDisposition("facture", "classique", "x");
    const { disposition, cle } = ajouterElement(depart, { genre: "cadre" });
    expect(retirerElement(disposition, cle)).toEqual(depart);
  });

  it("se pagine comme un bloc : sous le tableau, il va sur la dernière page", () => {
    const { disposition, cle } = ajouterElement(creerDisposition("facture", "classique", "x"), {
      genre: "texte",
    });
    const d = poserBloc(disposition, cle, { y: 250, textes: { texte: "Bas" } });
    expect(zonesLibres(blocsResolus(d), d.base).apres).toContain(cle);
  });
});

describe("sauvegarde des éléments", () => {
  it("se relisent à l'identique", () => {
    let d = creerDisposition("facture", "classique", "x");
    d = ajouterElement(d, { genre: "texte" }).disposition;
    d = ajouterElement(d, { genre: "trait" }).disposition;
    d = ajouterElement(d, { genre: "cadre" }).disposition;
    d = ajouterElement(d, { genre: "image", image: IMAGE }).disposition;
    expect(relire(d)).toEqual(d);
  });

  it("écarte un élément inconnu, ou une image qui ne vient pas du seau", () => {
    const relu = lireLibre({
      dispositions: {
        a: {
          type: "facture",
          base: "classique",
          blocs: {
            "el:a": { x: 1, y: 1, l: 20, h: 20, element: { genre: "video" } },
            "el:b": {
              x: 1,
              y: 1,
              l: 20,
              h: 20,
              element: {
                genre: "image",
                image: { chemin: "https://x.io/a.png", largeur: 1, hauteur: 1 },
              },
            },
            "el:c": { x: 1, y: 1, l: 20, h: 20 },
            "el:d": { x: 1, y: 1, l: 20, h: 20, element: { genre: "cadre" } },
            "autre:e": { x: 1, y: 1, l: 20, h: 20, element: { genre: "cadre" } },
          },
        },
      },
    }).dispositions.a;
    expect(Object.keys(relu.blocs)).toEqual(["el:d"]);
  });
});
