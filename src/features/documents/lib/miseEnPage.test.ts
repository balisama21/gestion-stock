import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  elementsDe,
  estVerrouille,
  lireMiseEnPage,
  prereglage,
  resoudrePage,
} from "./miseEnPage";
import { resoudreMiseEnPage } from "./resolveur";
import { documentDeDevis, documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES, V024 } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT, type ReglagesDocuments } from "./reglages";
import type { Database } from "../../../lib/database.types";

/**
 * LE NIVEAU 3, ET LA PROMESSE QU'IL NE S'INVITE PAS.
 *
 * Un document dont la boutique n'a pas ouvert l'éditeur doit sortir
 * exactement comme avant. Les empreintes de `templates/rendu.test.tsx`
 * le tiennent sur le rendu entier ; ce fichier le tient sur chaque
 * décision prise en chemin.
 */

const R = REGLAGES_DOCUMENTS_PAR_DEFAUT;
const base = {
  produits: PRODUITS,
  boutique: BOUTIQUE,
  client: CLIENT,
  paiements: [PAIEMENT],
  reglages: R,
};

const avec = (page: Record<string, unknown>): ReglagesDocuments => ({
  ...R,
  pages: { facture: lireMiseEnPage(page) },
});

const DEVIS: Database["public"]["Tables"]["quotes"]["Row"] = {
  client_id: null,
  client_nom: "Rakoto",
  created_at: "2026-03-02T08:00:00Z",
  created_by: null,
  date: "2026-03-02",
  type: "devis",
  duree_validite_jours: null,
  id: "q1",
  note: null,
  numero: "DEV001",
  statut: "envoye",
  store_id: "s1",
  total: 1000,
  updated_at: "2026-03-02T08:00:00Z",
  valide_jusqu_au: "2026-04-01",
  vente_ticket_id: null,
};

describe("sans éditeur ouvert, rien ne change", () => {
  it("garde les quatre colonnes d'hier, dans l'ordre d'hier", () => {
    const d = documentDeVente({ ...base, ventes: TICKET_TROIS_LIGNES });
    expect(d.colonnes.map((c) => c.cle)).toEqual([
      "designation",
      "quantite",
      "prixUnitaire",
      "total",
    ]);
    expect(d.colonnes.map((c) => c.libelle)).toEqual([
      "Désignation",
      "Quantité",
      "Prix unitaire",
      "Total",
    ]);
  });

  it("garde les repères d'hier", () => {
    const d = documentDeVente({ ...base, ventes: [V024] });
    expect(d.meta.map((m) => m.libelle)).toEqual(["N°", "Date", "Échéance", "Vendeur"]);
  });

  it("suit encore les interrupteurs de la boutique", () => {
    const sansSignature = { ...R, options: { ...R.options, signature: false } };
    const d = documentDeVente({ ...base, ventes: [V024], reglages: sansSignature });
    expect(d.signatures).toBeNull();
    // Et la mise en page du type l'emporte quand elle dit le contraire.
    const rallumee: ReglagesDocuments = {
      ...sansSignature,
      pages: { facture: { "bas.signature": { visible: true } } },
    };
    expect(
      documentDeVente({ ...base, ventes: [V024], reglages: rallumee }).signatures,
    ).toBeTruthy();
  });
});

describe("masquer un élément ne laisse rien derrière", () => {
  it("retire une ligne de l'en-tête sans laisser de vide", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({ "entete.adresse": { visible: false } }),
    });
    expect(d.emetteur.lignes).toEqual(["0389723412 · balisamamamy2003@gmail.com"]);
  });

  it("retire un repère sans décaler les autres", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({ "infos.vendeur": { visible: false } }),
    });
    expect(d.meta.map((m) => m.libelle)).toEqual(["N°", "Date", "Échéance"]);
  });

  it("retire une colonne du tableau, en-tête compris", () => {
    const d = documentDeVente({
      ...base,
      ventes: TICKET_TROIS_LIGNES,
      reglages: avec({ "tableau.prixUnitaire": { visible: false } }),
    });
    expect(d.colonnes.map((c) => c.cle)).toEqual(["designation", "quantite", "total"]);
  });

  it("retire un bloc du bas sans laisser son intitulé", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({
        "bas.conditions": { visible: false },
        "bas.motDeFin": { visible: false },
        "bas.piedDePage": { visible: false },
      }),
    });
    expect(d.mentions).toBeNull();
    expect(d.motDeFin).toBeNull();
    expect(d.piedDePage).toBeNull();
  });

  it("efface l'intitulé du bloc client plutôt que de poser un titre vide", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({ "tiers.titre": { visible: false } }),
    });
    expect(d.destinataire.titre).toBe("");
    expect(d.destinataire.nom).toBe("Richie Balsama");
  });
});

describe("une mention obligatoire ne se masque pas", () => {
  it("garde le numéro, la date, le nom et le total d'une facture", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({
        "infos.numero": { visible: false },
        "infos.date": { visible: false },
        "entete.nom": { visible: false },
        "totaux.total": { visible: false },
      }),
    });
    expect(d.meta.map((m) => m.libelle)).toContain("N°");
    expect(d.meta.map((m) => m.libelle)).toContain("Date");
    expect(d.emetteur.nom).toBe("Ma Boutique");
    expect(d.totaux.total).toBe(300000);
  });

  it("le dit au catalogue, pour que l'éditeur puisse poser son cadenas", () => {
    const numero = CATALOGUE.find((e) => e.cle === "infos.numero")!;
    expect(estVerrouille(numero, "facture")).toBe(true);
    // Sur un reçu, ce n'est pas une obligation légale.
    expect(estVerrouille(numero, "recu")).toBe(false);
  });
});

describe("le libellé personnalisé", () => {
  it("remplace le mot d'un repère", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({ "infos.vendeur": { libelle: "Votre conseiller" } }),
    });
    expect(d.meta.find((m) => m.valeur === "Lanto")?.libelle).toBe("Votre conseiller");
  });

  it("remplace le mot d'une colonne", () => {
    const d = documentDeVente({
      ...base,
      ventes: TICKET_TROIS_LIGNES,
      reglages: avec({ "tableau.designation": { libelle: "Article" } }),
    });
    expect(d.colonnes[0]).toMatchObject({ libelle: "Article", personnalise: true });
  });

  it("remplace le mot d'un total", () => {
    const d = documentDeVente({
      ...base,
      ventes: TICKET_TROIS_LIGNES,
      reglages: avec({ "totaux.reste": { libelle: "Solde dû" } }),
    });
    expect(d.totaux.libelleReste).toBe("Solde dû");
  });

  it("laisse le document choisir son mot quand la boutique n'en impose pas", () => {
    // L'échéance s'intitule « Règlement » faute de date à annoncer :
    // le défaut du catalogue ne doit pas écraser celui du document.
    const comptant = { ...R, types: { facture: { echeance: "comptant" as const } } };
    const d = documentDeVente({ ...base, ventes: [V024], reglages: comptant });
    expect(d.meta.map((m) => m.libelle)).toContain("Règlement");
  });
});

describe("l'ordre des éléments", () => {
  it("suit les rangs donnés, et le catalogue pour le reste", () => {
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: avec({
        "infos.vendeur": { ordre: 0 },
        "infos.numero": { ordre: 1 },
        "infos.date": { ordre: 2 },
        "infos.echeance": { ordre: 3 },
      }),
    });
    expect(d.meta.map((m) => m.libelle)).toEqual(["Vendeur", "N°", "Date", "Échéance"]);
  });

  it("garde l'ordre du catalogue quand deux rangs se valent", () => {
    const elements = resoudrePage({}, R.options, "facture");
    const entete = elements.filter((e) => e.zone === "entete").map((e) => e.cle);
    expect(entete).toEqual(elementsDe("entete", "facture").map((e) => e.cle));
  });
});

describe("une colonne vide sur tout le document disparaît", () => {
  it("garde la colonne d'unités quand les lignes en portent", () => {
    const d = documentDeVente({
      ...base,
      ventes: TICKET_TROIS_LIGNES,
      reglages: avec({ "tableau.unite": { visible: true } }),
    });
    expect(d.colonnes.map((c) => c.cle)).toContain("unite");
  });

  it("la retire d'un document dont aucune ligne n'en porte", () => {
    const reglages: ReglagesDocuments = {
      ...R,
      pages: { devis: { "tableau.unite": { visible: true } } },
    };
    const d = documentDeDevis({
      devis: DEVIS,
      lignes: [
        {
          id: "l1",
          quote_id: "q1",
          designation: "Prestation",
          quantite: 1,
          prix_unitaire: 1000,
          total: 1000,
          product_id: null,
          created_at: "2026-03-02T08:00:00Z",
        } as Database["public"]["Tables"]["quote_items"]["Row"],
      ],
      boutique: BOUTIQUE,
      reglages,
    });
    expect(d.colonnes.map((c) => c.cle)).not.toContain("unite");
    // Le réglage, lui, n'a pas bougé : le prochain document l'aura.
    expect(resoudreMiseEnPage(reglages, "devis").visible("tableau.unite")).toBe(true);
  });
});

describe("les préréglages", () => {
  it("« par défaut » n'écrit rien du tout", () => {
    expect(prereglage("defaut", "facture")).toEqual({});
  });

  it("« minimal » masque l'accessoire et respecte les verrous", () => {
    const page = prereglage("minimal", "facture");
    expect(page["bas.conditions"]).toEqual({ visible: false });
    expect(page["infos.numero"]).toBeUndefined();
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: { ...R, pages: { facture: page } },
    });
    expect(d.mentions).toBeNull();
    expect(d.signatures).toBeNull();
    expect(d.numero).toBe("FAC-V024");
  });

  it("« complet » allume ce que la boutique a renseigné", () => {
    const page = prereglage("complet", "facture");
    const d = documentDeVente({
      ...base,
      ventes: [V024],
      reglages: { ...R, options: { ...R.options, signature: false }, pages: { facture: page } },
    });
    expect(d.signatures).toBeTruthy();
    // Sans dédoubler l'unité, déjà collée à la quantité.
    expect(page["tableau.unite"]).toBeUndefined();
  });
});

describe("la lecture de la colonne JSON", () => {
  it("écarte une clé qui n'est pas au catalogue", () => {
    expect(lireMiseEnPage({ "entete.inventé": { visible: false } })).toEqual({});
  });

  it("écarte une valeur d'un type inattendu sans perdre le reste", () => {
    expect(lireMiseEnPage({ "entete.adresse": { visible: "non", libelle: "Adresse" } })).toEqual({
      "entete.adresse": { libelle: "Adresse" },
    });
  });
});
