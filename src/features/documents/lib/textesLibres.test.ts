import { describe, expect, it } from "vitest";
import { appliquerTextes, lignesSimples, textesDuBloc } from "./textesLibres";
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
      { cle: "titre", nom: "Titre", valeur: doc.titre, multiligne: true },
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

describe("retirer une ligne d'un bloc", () => {
  let r = creerDisposition("facture", "classique", "r");
  r = poserBloc(r, "reperes", { masquees: ["Vendeur", "N°"] });
  r = poserBloc(r, "totaux", { masquees: ["paye", "reste"] });
  r = poserBloc(r, "signatures", { masquees: ["gauche"] });
  r = poserBloc(r, "nom", { masquees: ["sousTitre"] });
  const retire = appliquerTextes(doc, blocsResolus(r));

  it("la ligne part, le numéro et la date restent quoi qu'on demande", () => {
    expect(doc.meta.map((m) => m.libelle)).toContain("Vendeur");
    expect(retire.meta.map((m) => m.libelle)).not.toContain("Vendeur");
    expect(retire.meta.map((m) => m.libelle)).toContain("N°");
    expect(retire.meta.map((m) => m.libelle)).toContain("Date");
  });

  it("déjà payé et reste à payer se retirent ; le total, jamais", () => {
    expect(retire.totaux.paye).toBeNull();
    expect(retire.totaux.reste).toBeNull();
    expect(retire.totaux.total).toBe(doc.totaux.total);
  });

  it("une signature retirée laisse l'autre à sa place", () => {
    expect(retire.signatures).toEqual({ gauche: "", droite: doc.signatures?.droite });
    expect(retire.emetteur.sousTitre).toBeNull();
  });

  it("le numéro et la date sont annoncés comme obligatoires", () => {
    const l = lignesSimples("reperes", doc);
    expect(l.filter((x) => x.obligatoire).map((x) => x.cle)).toEqual(["N°", "Date"]);
  });

  it("se relit à l'identique, et écarte ce qui n'est pas une ligne", () => {
    const relu = lireLibre(JSON.parse(JSON.stringify({ dispositions: { [r.id]: r } })))
      .dispositions[r.id];
    expect(relu).toEqual(r);
    const sale = lireLibre({
      dispositions: {
        a: {
          type: "facture",
          base: "classique",
          blocs: { reperes: { x: 1, y: 1, l: 50, h: 10, masquees: ["Vendeur", 3, ""] } },
        },
      },
    }).dispositions.a;
    expect(sale.blocs.reperes?.masquees).toEqual(["Vendeur"]);
  });
});
