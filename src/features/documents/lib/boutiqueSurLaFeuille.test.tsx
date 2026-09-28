import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Libre } from "../templates/Libre";
import { documentDeVente } from "./buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "./fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import { blocsResolus, creerDisposition, poserBloc, type Disposition } from "./disposition";
import { appliquerBoutique } from "./boutiqueSurLaFeuille";
import { uneParLigne } from "./coordonnees";

const doc = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

const emetteur = (d: Disposition, document = doc) =>
  render(
    <Libre
      document={document}
      base={d.base}
      blocs={blocsResolus(d)}
      lignes={document.lignes}
      pagination={null}
    />,
  ).container.querySelector('[data-bloc="emetteur"]')!;

describe("le modèle Compact : tout sur une ligne, sauf si l'on veut", () => {
  it("par défaut, rien ne change : une seule ligne", () => {
    const em = emetteur(creerDisposition("facture", "compact", "x"));
    expect(em.querySelectorAll("[data-ligne]")).toHaveLength(1);
    expect(em.querySelector("br")).toBeNull();
  });

  it("« Une par ligne » passe chaque coordonnée à la ligne", () => {
    let d = creerDisposition("facture", "compact", "x");
    d = poserBloc(d, "emetteur", {
      coordonnees: uneParLigne(doc.emetteur.champs ?? [], undefined, true),
    });
    const em = emetteur(d);
    expect([...em.querySelectorAll("[data-ligne]")].map((l) => l.textContent)).toEqual([
      BOUTIQUE.address,
      BOUTIQUE.phone,
      BOUTIQUE.email,
      `NIF/STAT ${BOUTIQUE.nifStat}`,
    ]);
  });
});

describe("les valeurs de la boutique écrites sur la feuille", () => {
  it("remplacent celles de la fiche, et une valeur vidée disparaît", () => {
    const vu = appliquerBoutique(doc, {
      phone: "034 00 000 00",
      email: "  ",
      storeName: "Boutique Tana",
      subtitle: "Pièces auto",
    });
    expect(vu.emetteur.nom).toBe("Boutique Tana");
    expect(vu.emetteur.sousTitre).toBe("Pièces auto");
    expect(vu.emetteur.champs?.find((c) => c.cle === "entete.telephone")?.valeur).toBe(
      "034 00 000 00",
    );
    expect(vu.emetteur.champs?.some((c) => c.cle === "entete.email")).toBe(false);
    const em = emetteur(creerDisposition("facture", "classique", "x"), vu);
    expect(em.textContent).toContain("034 00 000 00");
    expect(em.textContent).not.toContain(BOUTIQUE.email!);
  });

  it("sans modification, le document est celui de la fiche", () => {
    expect(appliquerBoutique(doc, {})).toBe(doc);
  });
});
