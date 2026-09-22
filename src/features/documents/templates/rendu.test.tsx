import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Bandeau } from "./Bandeau";
import { Classique } from "./Classique";
import { Compact } from "./Compact";
import { Epure } from "./Epure";
import { documentDeVente } from "../lib/buildDocument";
import { BOUTIQUE, CLIENT, PAIEMENT, PRODUITS, TICKET_TROIS_LIGNES } from "../lib/fixtures";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../lib/reglages";

/**
 * LE FILET DE NON-RÉGRESSION DE LA REFONTE « DOCUMENTS V3 ».
 *
 * Une boutique qui ne personnalise rien doit obtenir, à la fin de la
 * refonte, exactement le document qu'elle imprimait avant qu'elle
 * commence. Ces empreintes sont prises sur le rendu d'origine : toute
 * étape suivante qui déplacerait une ligne, un séparateur ou une
 * classe les fera tomber, et il faudra le justifier.
 *
 * Elles ont été vérifiées contre le code d'AVANT l'étape 1 : prises
 * sur la version modifiée, puis rejouées sur le dépôt remisé. Une
 * empreinte qu'on n'a pas vue confirmer ne prouve rien.
 */

const MODELES = { Classique, Bandeau, Epure, Compact };

const document = documentDeVente({
  ventes: TICKET_TROIS_LIGNES,
  produits: PRODUITS,
  client: CLIENT,
  paiements: [PAIEMENT],
  boutique: BOUTIQUE,
  reglages: REGLAGES_DOCUMENTS_PAR_DEFAUT,
});

describe("le modèle par défaut, sans aucune personnalisation", () => {
  for (const [nom, Modele] of Object.entries(MODELES)) {
    it(`rend ${nom} à l'identique`, () => {
      const { container } = render(
        <Modele document={document} lignes={document.lignes} premiere derniere pagination={null} />,
      );
      expect(container.innerHTML).toMatchSnapshot();
    });
  }

  it("ne pose ni bloc ni intitulé de paiement quand rien n'est saisi", () => {
    const { container } = render(
      <Classique
        document={document}
        lignes={document.lignes}
        premiere
        derniere
        pagination={null}
      />,
    );
    expect(container.querySelector(".doc-paiement")).toBeNull();
    expect(container.innerHTML).not.toContain("Coordonnées de paiement");
  });
});
