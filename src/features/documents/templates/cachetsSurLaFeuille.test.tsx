import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Libre } from "./Libre";
import { DocumentPreview } from "../DocumentPreview";
import { documentDeVente } from "../lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "../lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "../lib/reglages";
import {
  blocsResolus,
  cleCachet,
  creerDisposition,
  FEUILLE,
  lireLibre,
  placerCachet,
  poserBloc,
  retirerCachet,
} from "../lib/disposition";
import { feuilleLibre, paginerLibre, zonesLibres } from "../lib/paginationLibre";
import { pppEffectif, PPP_MINIMUM, type Cachet } from "../lib/cachets";

const IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

vi.mock("../lib/traiterCachet", () => ({
  imageCachet: vi.fn(() => new Promise((ok) => setTimeout(() => ok(IMAGE), 30))),
}));

afterEach(cleanup);

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const cachet: Cachet = {
  id: "c1",
  nom: "Cachet officiel",
  chemin: "43fc454f-ae66-48cd-af23-a46c0857a527/c1.png",
  largeur: 1200,
  hauteur: 600,
  opacite: 0.85,
  creeLe: "",
};
const base = creerDisposition("facture", "classique", "x");
const avecCachet = placerCachet(base, cachet);
const cle = cleCachet("c1");

describe("placer un cachet", () => {
  it("à droite, sur la ligne des signatures, sans déformer l'image", () => {
    const b = blocsResolus(avecCachet)[cle];
    const sig = blocsResolus(avecCachet).signatures;
    expect(b.h / b.l).toBeCloseTo(600 / 1200, 2);
    expect(b.y + b.h).toBeCloseTo(sig.y + sig.h, 1);
    expect(b.x + b.l).toBeLessThanOrEqual(FEUILLE.l - 15 + 0.01);
  });

  it("ne mord sur aucune mention obligatoire, quel que soit le modèle", () => {
    for (const modele of ["classique", "bandeau", "epure", "compact"] as const) {
      for (const forme of [cachet, { ...cachet, id: "c2", hauteur: 1200 }]) {
        const d = placerCachet(creerDisposition("facture", modele, "x"), forme);
        const blocs = blocsResolus(d);
        const c = blocs[cleCachet(forme.id)];
        for (const k of ["nom", "reperes", "tableau", "totaux"] as const) {
          const o = blocs[k];
          const croise = c.x < o.x + o.l && c.x + c.l > o.x && c.y < o.y + o.h && c.y + c.h > o.y;
          expect(croise, `${modele} / ${k}`).toBe(false);
        }
      }
    }
  });

  it("se sauvegarde, se déplace, se retire", () => {
    const deplace = poserBloc(avecCachet, cle, { x: 20, y: 30 });
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { a: deplace } })))
      .dispositions.a;
    expect(blocsResolus(relu)[cle]).toMatchObject({ x: 20, y: 30 });
    expect(blocsResolus(retirerCachet(relu, "c1"))[cle]).toBeUndefined();
  });

  it("reste net : au moins 200 points par pouce à la taille posée", () => {
    const b = blocsResolus(avecCachet)[cle];
    expect(pppEffectif(cachet, b.l)).toBeGreaterThanOrEqual(PPP_MINIMUM);
    expect(pppEffectif({ largeur: 200 }, 60)).toBeLessThan(PPP_MINIMUM);
  });
});

describe("le cachet sur la feuille", () => {
  const poser = (
    d = avecCachet,
    images: Record<string, string> = { [cachet.chemin]: IMAGE },
    liste = [cachet],
  ) =>
    render(
      <Libre
        document={doc}
        base={d.base}
        blocs={blocsResolus(d)}
        lignes={doc.lignes}
        pagination={null}
        cachets={{ cachets: liste, images }}
      />,
    ).container;

  it("s'affiche avec son opacité, au-dessus du texte, sous les mentions obligatoires", () => {
    const c = poser();
    const bloc = c.querySelector<HTMLElement>(`[data-bloc="${cle}"]`)!;
    const img = bloc.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(IMAGE);
    expect(img.style.opacity).toBe("0.85");
    const z = (k: string) =>
      Number(c.querySelector<HTMLElement>(`[data-bloc="${k}"]`)!.style.zIndex);
    expect(z(cle)).toBeGreaterThan(z("signatures"));
    expect(z(cle)).toBeLessThan(z("totaux"));
  });

  it("ne laisse rien quand l'image manque ou que le cachet n'existe plus", () => {
    expect(poser(avecCachet, {}).querySelector(`[data-bloc="${cle}"]`)).toBeNull();
    expect(poser(avecCachet, undefined, []).querySelector(`[data-bloc="${cle}"]`)).toBeNull();
  });
});

describe("le cachet dans un document de plusieurs pages", () => {
  it("part sur la dernière page s'il est sous le tableau, sur toutes s'il est répété", () => {
    const lignes = { enTete: 8, lignes: Array.from({ length: 60 }, () => 10) };
    const z = zonesLibres(blocsResolus(avecCachet), "classique");
    const n = paginerLibre(lignes, z).length;
    expect(feuilleLibre(n - 1, n, z).cles).toContain(cle);
    expect(feuilleLibre(0, n, z).cles).not.toContain(cle);

    const repete = poserBloc(avecCachet, cle, { repete: true });
    const zr = zonesLibres(blocsResolus(repete), "classique");
    for (let r = 0; r < n; r++) expect(feuilleLibre(r, n, zr).cles).toContain(cle);
  });
});

describe("le cachet sur le document final", () => {
  const reglages: ReglagesDocuments = {
    ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
    libre: { dispositions: { [avecCachet.id]: avecCachet }, parType: { facture: avecCachet.id } },
    cachets: [cachet],
  };

  it("n'est photographié qu'une fois son image chargée", async () => {
    const onPret = vi.fn();
    render(<DocumentPreview document={doc} reglages={reglages} sansActions onPret={onPret} />);
    await waitFor(() => expect(onPret).toHaveBeenCalled());
    const [feuilles] = onPret.mock.calls[0] as [HTMLElement[]];
    const img = feuilles[0].querySelector<HTMLImageElement>(`[data-bloc="${cle}"] img`);
    expect(img?.getAttribute("src")).toBe(IMAGE);
  });
});
