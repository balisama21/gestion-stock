import { describe, expect, it } from "vitest";
import { appliquerTextes, textesDuBloc } from "./textesLibres";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import { blocsResolus, creerDisposition, lireLibre, poserBloc } from "./disposition";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

let d = creerDisposition("facture", "classique", "x");
d = poserBloc(d, "titre", { textes: { titre: "NOTE D'HONORAIRES" } });
d = poserBloc(d, "reperes", { textes: { Date: "Émise le" } });
d = poserBloc(d, "tableau", { textes: { designation: "Article" } });
d = poserBloc(d, "totaux", { textes: { libelleTotal: "Net à payer" } });
d = poserBloc(d, "motDeFin", { textes: { texte: "" } });
d = poserBloc(d, "signatures", { textes: { droite: "Le gérant" } });

const ecrit = appliquerTextes(doc, blocsResolus(d));

describe("réécrire les mots sur la feuille", () => {
  it("change ce que le document dit", () => {
    expect(ecrit.titre).toBe("NOTE D'HONORAIRES");
    expect(
      ecrit.meta.find((m) => m.valeur === doc.meta.find((x) => x.libelle === "Date")!.valeur)
        ?.libelle,
    ).toBe("Émise le");
    expect(ecrit.colonnes.find((c) => c.cle === "designation")).toMatchObject({
      libelle: "Article",
      personnalise: true,
    });
    expect(ecrit.totaux.libelleTotal).toBe("Net à payer");
    expect(ecrit.signatures?.droite).toBe("Le gérant");
    expect(ecrit.signatures?.gauche).toBe(doc.signatures?.gauche);
  });

  it("un texte vidé disparaît, sans laisser de ligne", () => {
    expect(doc.motDeFin).not.toBeNull();
    expect(ecrit.motDeFin).toBeNull();
  });

  it("ne touche à aucun chiffre ni à aucune donnée", () => {
    expect(ecrit.numero).toBe(doc.numero);
    expect(ecrit.lignes).toEqual(doc.lignes);
    expect(ecrit.emetteur.nom).toBe(doc.emetteur.nom);
    expect(ecrit.destinataire.nom).toBe(doc.destinataire.nom);
    expect(ecrit.meta.map((m) => m.valeur)).toEqual(doc.meta.map((m) => m.valeur));
    const { libelleTotal: _a, ...chiffres } = ecrit.totaux;
    const { libelleTotal: _b, ...avant } = doc.totaux;
    expect(chiffres).toEqual(avant);
  });

  it("sans texte réécrit, le document reste celui des réglages", () => {
    expect(appliquerTextes(doc, blocsResolus(creerDisposition("facture", "bandeau", "y")))).toEqual(
      doc,
    );
  });

  it("ne propose que ce qui s'écrit : ni le nom, ni le client, ni les lignes", () => {
    expect(textesDuBloc("nom", doc, "classique")).toEqual([]);
    expect(textesDuBloc("tableau", doc, "classique").map((t) => t.cle)).toEqual(
      doc.colonnes.map((c) => c.cle),
    );
    expect(textesDuBloc("titre", doc, "classique")).toEqual([
      { cle: "titre", nom: "Titre", valeur: doc.titre },
    ]);
  });
});

describe("sauvegarde", () => {
  it("les textes se relisent à l'identique", () => {
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { [d.id]: d } })))
      .dispositions[d.id];
    expect(relu).toEqual(d);
  });

  it("écarte ce qui n'est pas du texte, et borne la longueur", () => {
    const relu = lireLibre({
      dispositions: {
        a: {
          type: "facture",
          base: "classique",
          blocs: {
            titre: { x: 1, y: 1, l: 50, h: 10, textes: { titre: "x".repeat(5000), autre: 42 } },
          },
        },
      },
    }).dispositions.a;
    expect(relu.blocs.titre?.textes).toEqual({ titre: "x".repeat(2000) });
  });
});
