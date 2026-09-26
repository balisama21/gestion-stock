import { describe, expect, it } from "vitest";
import { figer, lireCopieFigee } from "./copieFigee";
import {
  blocsResolus,
  cleCachet,
  creerDisposition,
  dispositionDuType,
  placerCachet,
  poserBloc,
} from "./disposition";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./fixtures";
import type { Cachet } from "./cachets";

const cachet: Cachet = {
  id: "c1",
  nom: "Cachet officiel",
  chemin: "43fc454f-ae66-48cd-af23-a46c0857a527/c1.png",
  largeur: 1200,
  hauteur: 1200,
  opacite: 0.9,
  creeLe: "",
};

let disposition = creerDisposition("facture", "bandeau", "Factures");
disposition = poserBloc(disposition, "logo", { x: 150, y: 20 });
disposition = placerCachet(disposition, cachet);

const AU_DEPART: ReglagesDocuments = {
  ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
  identite: { ...REGLAGES_DOCUMENTS_PAR_DEFAUT.identite, siteWeb: "boutique.mg" },
  libre: { dispositions: { [disposition.id]: disposition }, parType: { facture: disposition.id } },
  cachets: [cachet],
};

/** Ce que la base rend : du JSON, pas des objets. */
const commeEnBase = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("un document déjà émis", () => {
  const copie = commeEnBase(figer(AU_DEPART, BOUTIQUE, "facture", "2026-09-26"));

  // Tout change ensuite : disposition, identité, cachets, titre, adresse.
  const autre = creerDisposition("facture", "compact", "Nouvelle");
  const AUJOURDHUI: ReglagesDocuments = {
    ...AU_DEPART,
    identite: { ...AU_DEPART.identite, siteWeb: "nouveau.mg" },
    types: { facture: { titre: "NOTE" } },
    libre: {
      dispositions: {
        [disposition.id]: poserBloc(disposition, "logo", { x: 20, y: 200 }),
        [autre.id]: autre,
      },
      parType: { facture: autre.id },
    },
    cachets: [],
  };

  const relue = lireCopieFigee(copie, AUJOURDHUI, "facture")!;

  it("garde sa disposition figée", () => {
    expect(dispositionDuType(relue.reglages.libre, "facture")).toEqual(disposition);
    expect(blocsResolus(dispositionDuType(relue.reglages.libre, "facture")!).logo.x).toBe(150);
  });

  it("garde ses cachets, même retirés de la liste depuis", () => {
    expect(relue.reglages.cachets).toEqual([cachet]);
    const d = dispositionDuType(relue.reglages.libre, "facture")!;
    expect(d.blocs[cleCachet("c1")]).toBeDefined();
  });

  it("garde l'identité et les réglages du jour d'émission", () => {
    expect(relue.reglages.identite.siteWeb).toBe("boutique.mg");
    const doc = documentDeVente({
      ventes: TICKET_TROIS_LIGNES,
      produits: PRODUITS,
      client: CLIENT,
      paiements: [PAIEMENT],
      boutique: { ...BOUTIQUE, storeName: "Nouveau nom", address: "Ailleurs", ...relue.boutique },
      reglages: relue.reglages,
    });
    expect(doc.titre).toBe("FACTURE");
    expect(doc.emetteur.nom).toBe(BOUTIQUE.storeName);
    expect(doc.emetteur.lignes.join(" ")).toContain(BOUTIQUE.address);
  });

  it("ne recopie ni le logo ni les réglages des autres documents", () => {
    expect(copie.boutique).not.toHaveProperty("logoUrl");
    expect(Object.keys(copie.reglages.types)).toEqual(["facture"]);
  });

  it("se construit comme un document neuf quand rien ne la distingue", () => {
    const neuf = documentDeVente({
      ventes: TICKET_TROIS_LIGNES,
      produits: PRODUITS,
      client: CLIENT,
      paiements: [PAIEMENT],
      boutique: BOUTIQUE,
      reglages: AU_DEPART,
    });
    const refait = documentDeVente({
      ventes: TICKET_TROIS_LIGNES,
      produits: PRODUITS,
      client: CLIENT,
      paiements: [PAIEMENT],
      boutique: { ...BOUTIQUE, ...relue.boutique },
      reglages: relue.reglages,
    });
    expect(refait).toEqual(neuf);
  });
});

describe("les copies d'avant le mode libre", () => {
  it("s'appliquent en mode simple, avec leur identité et leur titre", () => {
    const v1 = {
      version: 1,
      emisLe: "2026-09-22",
      identite: { ...REGLAGES_DOCUMENTS_PAR_DEFAUT.identite, siteWeb: "ancien.mg" },
      type: {
        type: "facture",
        titre: "FACTURE",
        prefixe: "F-",
        modele: "epure",
        couleur: "#0E7C5A",
      },
      page: null,
    };
    const relue = lireCopieFigee(commeEnBase(v1), AU_DEPART, "facture")!;
    expect(relue.reglages.identite.siteWeb).toBe("ancien.mg");
    expect(relue.reglages.types.facture?.prefixe).toBe("F-");
    expect(dispositionDuType(relue.reglages.libre, "facture")).toBeNull();
  });

  it("rien à relire : pas de copie", () => {
    expect(lireCopieFigee(null, AU_DEPART, "facture")).toBeNull();
    expect(lireCopieFigee({ version: 9 }, AU_DEPART, "facture")).toBeNull();
  });
});
