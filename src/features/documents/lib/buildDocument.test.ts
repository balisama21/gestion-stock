import { describe, expect, it } from "vitest";
import { documentDeVente, libelleMethode, totauxDeVente } from "./buildDocument";
import {
  BOUTIQUE,
  BOUTIQUE_NUE,
  CLIENT,
  PAIEMENT,
  PRODUITS,
  TICKET_TROIS_LIGNES,
  V024,
  V025,
  V026,
} from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, lireReglagesDocuments, nuance } from "./reglages";

/**
 * CE QUE LE PAPIER DIT DE LA BASE.
 *
 * Les données viennent de la production (voir `fixtures.ts`) : ces
 * tests se cassent sur les mêmes cas que la vraie boutique, pas sur
 * une boutique imaginaire aux fiches bien remplies.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const base = { produits: PRODUITS, boutique: BOUTIQUE, reglages: R };

describe("les montants ne bougent pas", () => {
  it("reprend le total de la base sans le recalculer", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.totaux.total).toBe(300000);
    expect(d.lignes[0].total).toBe(300000);
  });

  it("additionne les lignes d'un ticket, comme la page Ventes", () => {
    const d = documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES });
    expect(d.totaux.total).toBe(300000 + 4500 + 3000);
    expect(d.totaux.paye).toBe(100000);
    expect(d.totaux.reste).toBe(200000 + 4500 + 3000);
  });

  it("ne touche à rien quand la vente est soldée", () => {
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.totaux.paye).toBe(3000);
    expect(d.totaux.reste).toBe(0);
  });
});

describe("la TVA est comprise, elle ne s'ajoute pas", () => {
  /*
   * Le seul écart assumé avec la maquette, et le plus important à
   * tenir : une facture qui ajouterait 20 % à une vente de 300 000
   * annoncerait 360 000, un montant que le client n'a jamais payé.
   */
  const avecTva = { ...R, options: { ...R.options, tva: true } };

  it("laisse le total intact", () => {
    const d = documentDeVente({ ...base, ventes: [V024], reglages: avecTva });
    expect(d.totaux.total).toBe(300000);
  });

  it("extrait la part de taxe du total", () => {
    const d = documentDeVente({ ...base, ventes: [V024], reglages: avecTva });
    // 300 000 TTC à 20 % : 250 000 HT et 50 000 de taxe.
    expect(d.totaux.tva).toEqual({ taux: 20, montant: 50000 });
    expect(d.totaux.horsTaxe).toBe(250000);
  });

  it("garde l'addition juste, même quand l'arrondi tombe mal", () => {
    // Le hors-taxe est obtenu par SOUSTRACTION et non par une seconde
    // division : sans cela, HT + TVA pourrait faire un ariary de plus
    // ou de moins que le total, sous les yeux du client.
    const d = documentDeVente({ ...base, ventes: [V025], reglages: avecTva });
    expect(d.totaux.horsTaxe! + d.totaux.tva!.montant).toBe(d.totaux.total);
  });

  it("ne montre rien quand la boutique n'a pas de taux", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V026],
      boutique: BOUTIQUE_NUE,
      reglages: avecTva,
    });
    expect(d.totaux.tva).toBeNull();
    expect(d.totaux.horsTaxe).toBeNull();
  });

  it("ne montre rien quand l'option est coupée", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.totaux.tva).toBeNull();
  });
});

describe("une donnée absente disparaît, elle ne s'invente pas", () => {
  it("n'affiche aucune adresse quand la boutique n'en a pas", () => {
    // Les documents actuels écrivent « Lot IVG 124, Antananarivo 101 »
    // et « +261 34 12 345 67 » : une facture part alors chez un client
    // avec l'adresse de personne.
    const d = documentDeVente({ ...base, ventes: [V026], boutique: BOUTIQUE_NUE });
    expect(d.emetteur.lignes).toEqual([]);
    expect(d.emetteur.nif).toBeNull();
    expect(d.emetteur.sousTitre).toBeNull();
  });

  it("ne met pas de référence quand le produit n'est plus au catalogue", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.lignes[0].detail).toBeNull();
    expect(d.lignes[0].designation).toBe("Huille");
  });

  it("met la référence quand elle existe", () => {
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.lignes[0].detail).toBe("réf. P024");
  });

  it("ne donne pas d'unité quand la fiche n'en porte pas", () => {
    expect(documentDeVente({ ...base, ventes: [V026] }).lignes[0].unite).toBeNull();
    expect(documentDeVente({ ...base, ventes: [V025] }).lignes[0].unite).toBe("pièce");
  });

  it("ne dit pas le mode de paiement quand aucun règlement n'est connu", () => {
    expect(documentDeVente({ ...base, ventes: [V026] }).totaux.modePaiement).toBeNull();
  });
});

describe("le client", () => {
  it("se réduit à « Client comptoir » quand la vente n'en porte pas", () => {
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.destinataire.nom).toBe("Client comptoir");
    expect(d.destinataire.lignes).toEqual([]);
  });

  it("prend le nom libre saisi au comptoir", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.destinataire.nom).toBe("Dimby");
    expect(d.destinataire.lignes).toEqual([]);
  });

  it("sort enfin la fiche complète, que le papier n'imprimait jamais", () => {
    const d = documentDeVente({ ...base, ventes: [V024], client: CLIENT });
    expect(d.destinataire.nom).toBe("Richie Balsama");
    expect(d.destinataire.lignes).toEqual(["Analamahitsy", "Antananarivo", "0328740631"]);
  });

  it("facture l'entreprise, et range la personne en contact", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      client: { ...CLIENT, entreprise: "Épicerie Toky" },
    });
    expect(d.destinataire.nom).toBe("Épicerie Toky");
    expect(d.destinataire.lignes[0]).toBe("Richie Balsama");
  });
});

describe("le numéro imprimé reste celui de la base", () => {
  it("habille le numéro sans le remplacer", () => {
    // « FAC-V026 » et non « FAC-2026-0011 » : le client appelle avec
    // la référence du papier, et il faut pouvoir la chercher.
    expect(documentDeVente({ ...base, ventes: [V026] }).numero).toBe("FAC-V026");
  });

  it("suit le préfixe réglé par la boutique", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V026],
      reglages: { ...R, prefixeFacture: "F/2026/" },
    });
    expect(d.numero).toBe("F/2026/V026");
  });

  it("donne son propre préfixe au reçu", () => {
    const d = documentDeVente({ ...base, ventes: [V026], type: "recu" });
    expect(d.numero).toBe("REC-V026");
    expect(d.titre).toBe("REÇU");
  });

  it("nomme le fichier d'après le numéro, sans caractère interdit", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V026],
      reglages: { ...R, prefixeFacture: "F/2026/" },
    });
    expect(d.nomDeFichier).toBe("Facture_F_2026_V026");
  });
});

describe("l'échéance", () => {
  it("annonce une date, pas un délai à compter soi-même", () => {
    // « Sous 15 jours » ferait compter le lecteur depuis le jour où il
    // lit, et non depuis celui de la vente.
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.meta).toContainEqual({ libelle: "Échéance", valeur: "04/10/2026" });
  });

  it("dit le libellé seul quand aucune date n'est à attendre", () => {
    const comptant = { ...R, echeance: "comptant" as const };
    const d = documentDeVente({ ...base, ventes: [V026], reglages: comptant });
    expect(d.meta).toContainEqual({ libelle: "Règlement", valeur: "Payée comptant" });
  });

  it("n'apparaît pas sur un reçu, qui constate un paiement", () => {
    const d = documentDeVente({ ...base, ventes: [V026], type: "recu" });
    expect(d.meta.map((m) => m.libelle)).not.toContain("Échéance");
  });
});

describe("le tampon", () => {
  it("dit « Payé » quand il ne reste rien", () => {
    expect(documentDeVente({ ...base, ventes: [V026] }).tampon).toEqual({
      texte: "Payé",
      ton: "ok",
    });
  });

  it("dit « Reste à payer » quand il reste quelque chose", () => {
    const d = documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES });
    expect(d.tampon).toEqual({ texte: "Reste à payer", ton: "du" });
  });

  it("disparaît quand l'option est coupée", () => {
    const sansTampon = { ...R, options: { ...R.options, tamponPaiement: false } };
    expect(documentDeVente({ ...base, ventes: [V026], reglages: sansTampon }).tampon).toBeNull();
  });
});

describe("le montant en lettres", () => {
  it("reprend le total, avec la devise de la boutique", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.montantEnLettres).toBe("trois cent mille ariary");
  });

  it("disparaît quand l'option est coupée", () => {
    const sans = { ...R, options: { ...R.options, montantEnLettres: false } };
    expect(
      documentDeVente({ ...base, ventes: [V024], reglages: sans }).montantEnLettres,
    ).toBeNull();
  });
});

describe("le logo", () => {
  it("se replie sur les initiales quand la boutique n'en a pas", () => {
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.emetteur.logoUrl).toBeNull();
    expect(d.emetteur.initiales).toBe("MB");
  });

  it("prend le logo quand il existe", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V026],
      boutique: { ...BOUTIQUE, logoUrl: "https://exemple/logo.png" },
    });
    expect(d.emetteur.logoUrl).toBe("https://exemple/logo.png");
    expect(d.emetteur.initiales).toBeNull();
  });

  it("ne met rien du tout quand on le lui demande", () => {
    const d = documentDeVente({ ...base, ventes: [V026], reglages: { ...R, logo: "aucun" } });
    expect(d.emetteur.logoUrl).toBeNull();
    expect(d.emetteur.initiales).toBeNull();
  });
});

describe("le mode de règlement", () => {
  it("traduit le code de la base", () => {
    const d = documentDeVente({ ...base, ventes: [V026], paiements: [PAIEMENT] });
    expect(d.totaux.modePaiement).toBe("Espèces");
  });

  it("présente proprement un code qu'il ne connaît pas", () => {
    expect(libelleMethode("cheque_certifie")).toBe("Cheque certifie");
    expect(libelleMethode(null)).toBeNull();
    expect(libelleMethode("  ")).toBeNull();
  });
});

describe("le pied de page", () => {
  it("reprend l'identité de la boutique quand rien n'est réglé", () => {
    const d = documentDeVente({ ...base, ventes: [V026] });
    expect(d.piedDePage).toBe("Ma Boutique · 105 Ambohidratrimo · 0389723412");
  });

  it("laisse la boutique écrire le sien", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V026],
      reglages: { ...R, piedDePage: "À bientôt" },
    });
    expect(d.piedDePage).toBe("À bientôt");
  });
});

describe("un ticket vide ne fait pas tomber le document", () => {
  it("se rend quand même, à zéro", () => {
    const d = documentDeVente({ ...base, ventes: [] });
    expect(d.totaux.total).toBe(0);
    expect(d.lignes).toEqual([]);
    expect(d.numero).toBe("");
  });
});

describe("la lecture des réglages", () => {
  it("part des valeurs par défaut quand la clé n'existe pas", () => {
    expect(lireReglagesDocuments(undefined)).toEqual(REGLAGES_DOCUMENTS_PAR_DEFAUT);
    expect(lireReglagesDocuments(null)).toEqual(REGLAGES_DOCUMENTS_PAR_DEFAUT);
    expect(lireReglagesDocuments("bandeau")).toEqual(REGLAGES_DOCUMENTS_PAR_DEFAUT);
  });

  it("garde ce qu'elle reconnaît et jette le reste", () => {
    const lu = lireReglagesDocuments({
      modele: "bandeau",
      couleur: "#1F4E79",
      inconnu: "peu importe",
      options: { tva: true, nif: "oui" },
      ticket: { largeur: 58 },
    });
    expect(lu.modele).toBe("bandeau");
    expect(lu.couleur).toBe("#1F4E79");
    expect(lu.options.tva).toBe(true);
    // « oui » n'est pas un booléen : on retombe sur le défaut.
    expect(lu.options.nif).toBe(true);
    expect(lu.ticket.largeur).toBe(58);
    expect(lu.ticket.detailLignes).toBe(true);
  });

  it("refuse une couleur qui n'en est pas une", () => {
    expect(lireReglagesDocuments({ couleur: "rouge" }).couleur).toBe("#0E7C5A");
    expect(lireReglagesDocuments({ couleur: "#GGG" }).couleur).toBe("#0E7C5A");
  });

  it("refuse un modèle inventé", () => {
    expect(lireReglagesDocuments({ modele: "gothique" }).modele).toBe("classique");
  });
});

describe("les nuances de la couleur du document", () => {
  it("éclaircissent et assombrissent la teinte de base", () => {
    // Les valeurs attendues sont celles que la maquette CALCULE, pas
    // celles qu'elle déclare dans `:root` — son `--doc-soft: #E1F1E9`
    // est écrasé au premier rendu par ce même calcul. C'est donc bien
    // cette teinte-ci que vous avez vue à l'écran.
    expect(nuance("#0E7C5A", 0.88)).toBe("#e2efeb");
    expect(nuance("#0E7C5A", -0.18)).toBe("#0b664a");
  });

  it("ne débordent jamais de l'intervalle", () => {
    expect(nuance("#ffffff", 0.88)).toBe("#ffffff");
    expect(nuance("#000000", -0.5)).toBe("#000000");
  });
});

describe("le libellé du total dit la vérité sur la pièce", () => {
  it("« Total à payer » seulement quand il reste à payer", () => {
    const du = documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES });
    expect(du.totaux.libelleTotal).toBe("Total à payer");
  });

  it("« Total » tout court sur une vente soldée", () => {
    // Sinon la mention contredit le tampon « PAYÉ » posé au-dessus.
    const solde = documentDeVente({ ...base, ventes: [V026] });
    expect(solde.totaux.libelleTotal).toBe("Total");
  });

  it("« Total réglé » sur un reçu, qui constate de l'argent reçu", () => {
    const recu = documentDeVente({ ...base, ventes: [V026], type: "recu" });
    expect(recu.totaux.libelleTotal).toBe("Total réglé");
    expect(recu.totaux.libellePaye).toBe("Réglé");
  });
});
