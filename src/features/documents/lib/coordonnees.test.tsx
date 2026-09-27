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
  lireLibre,
  poserBloc,
  type Disposition,
} from "./disposition";
import {
  accolerChamp,
  deplacerChamp,
  lignesPresentees,
  lirePresentation,
  masquerChamp,
  type ChampTiers,
} from "./coordonnees";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const CHAMPS: ChampTiers[] = [
  { cle: "entete.adresse", nom: "Adresse", valeur: "105 Ambohidratrimo" },
  { cle: "entete.telephone", nom: "Téléphone", valeur: "0389723412" },
  { cle: "entete.email", nom: "E-mail", valeur: "a@b.mg" },
  { cle: "entete.nifStat", nom: "NIF/STAT", valeur: "123", obligatoire: true, fiscal: true },
];

const cles = (l: ChampTiers[][]) => l.map((x) => x.map((c) => c.cle.split(".")[1]).join("+"));

describe("les coordonnées, ligne par ligne", () => {
  it("par défaut, téléphone et e-mail restent sur la même ligne, comme avant", () => {
    expect(cles(lignesPresentees(CHAMPS, undefined))).toEqual([
      "adresse",
      "telephone+email",
      "nifStat",
    ]);
  });

  it("l'e-mail passe sur sa propre ligne, le téléphone descend, l'adresse se masque", () => {
    let p = accolerChamp(undefined, "entete.email", false);
    p = deplacerChamp(CHAMPS, p, "entete.telephone", 1);
    p = masquerChamp(p, "entete.adresse", true);
    expect(cles(lignesPresentees(CHAMPS, p))).toEqual(["email", "telephone", "nifStat"]);
  });

  it("le NIF/STAT ne se masque pas", () => {
    const p = masquerChamp(undefined, "entete.nifStat", true);
    expect(cles(lignesPresentees(CHAMPS, p))).toContain("nifStat");
  });

  it("la présentation relue écarte ce qui n'a pas sa forme", () => {
    expect(
      lirePresentation({
        ordre: ["entete.email", 3, "<script>"],
        masques: "tout",
        accole: { "entete.email": false, x: "oui" },
      }),
    ).toEqual({ ordre: ["entete.email"], accole: { "entete.email": false } });
  });
});

const feuille = (d: Disposition) =>
  render(
    <Libre
      document={doc}
      base={d.base}
      blocs={blocsResolus(d)}
      lignes={doc.lignes}
      pagination={null}
    />,
  ).container;

describe("sur la feuille", () => {
  it("chaque coordonnée porte son repère, et rien ne change sans réglage", () => {
    const racine = feuille(creerDisposition("facture", "classique", "x"));
    const em = racine.querySelector('[data-bloc="emetteur"]')!;
    expect(em.querySelector('[data-champ="entete.telephone"]')?.textContent).toBe(BOUTIQUE.phone);
    expect(em.querySelector('[data-ligne="entete.telephone entete.email"]')?.textContent).toBe(
      `${BOUTIQUE.phone} · ${BOUTIQUE.email}`,
    );
    expect(em.querySelector('[data-champ="entete.nifStat"]')?.textContent).toBe(
      `NIF/STAT ${BOUTIQUE.nifStat}`,
    );
  });

  it("libellé devant, ligne séparée, ligne masquée : tout se relit", () => {
    let d = creerDisposition("facture", "classique", "x");
    d = poserBloc(d, "emetteur", {
      coordonnees: masquerChamp(
        accolerChamp(undefined, "entete.email", false),
        "entete.adresse",
        true,
      ),
      textes: { "libelle:entete.telephone": "Tél. : ", "libelle:entete.email": "E-mail : " },
    });
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { [d.id]: d } })))
      .dispositions[d.id];
    expect(relu).toEqual(d);
    const em = feuille(relu).querySelector('[data-bloc="emetteur"]')!;
    expect(em.querySelector('[data-ligne="entete.telephone"]')?.textContent).toBe(
      `Tél. : ${BOUTIQUE.phone}`,
    );
    expect(em.querySelector('[data-ligne="entete.email"]')?.textContent).toBe(
      `E-mail : ${BOUTIQUE.email}`,
    );
    expect(em.textContent).not.toContain(BOUTIQUE.address);
  });

  it("une coordonnée détachée montre la valeur de la fiche, où qu'elle soit posée", () => {
    const { disposition, cle } = ajouterElement(creerDisposition("facture", "classique", "x"), {
      genre: "donnee",
      source: { bloc: "emetteur", champ: "entete.telephone" },
    });
    const d = poserBloc(disposition, cle, { textes: { libelle: "Tél. " } });
    expect(feuille(d).querySelector(`[data-bloc="${cle}"]`)?.textContent).toBe(
      `Tél. ${BOUTIQUE.phone}`,
    );
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { [d.id]: d } })))
      .dispositions[d.id];
    expect(relu.blocs[cle]?.element).toEqual({
      genre: "donnee",
      source: { bloc: "emetteur", champ: "entete.telephone" },
    });
  });
});
