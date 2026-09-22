import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReglagesParDocument } from "./ReglagesParDocument";
import {
  REGLAGES_DOCUMENTS_PAR_DEFAUT,
  type ReglagesDocuments,
} from "../../features/documents/lib/reglages";
import type { ReglagesParType, TypeDocumentV3 } from "../../features/documents/lib/typesDocument";

/**
 * L'ÉCRAN DU NIVEAU 2.
 *
 * Ce qu'il faut qu'il tienne : ne rien écrire tant qu'on n'a pas
 * demandé à personnaliser, et tout retirer d'un clic. Entre les deux,
 * l'écran montre ce qui s'imprimera — un champ qui affiche « FAC- »
 * alors que le document sortira « FAC-2026- » vaut mieux ne pas
 * exister.
 */

/**
 * Le type réglé est désormais tenu par l'écran parent, pour que
 * l'aperçu montre le même document. Ce banc joue ce rôle.
 */
function afficher(reglages: ReglagesDocuments = REGLAGES_DOCUMENTS_PAR_DEFAUT) {
  const onChange = vi.fn();
  const Banc = () => {
    const [type, setType] = useState<TypeDocumentV3>("facture");
    return (
      <ReglagesParDocument
        reglages={reglages}
        onChange={onChange}
        onChangePages={vi.fn()}
        type={type}
        onType={setType}
      />
    );
  };
  render(<Banc />);
  return onChange;
}

const dernier = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)?.[0] as ReglagesParType;

afterEach(cleanup);

describe("tant qu'on n'a pas personnalisé", () => {
  it("annonce que le document suit la boutique", () => {
    afficher();
    expect(screen.getAllByText(/Comme la boutique/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Personnaliser ce document/ })).toBeTruthy();
  });

  it("ne propose aucun champ à remplir", () => {
    afficher();
    expect(screen.queryByLabelText(/Titre imprimé/)).toBeNull();
  });

  it("recopie les valeurs héritées à l'ouverture", () => {
    const onChange = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Personnaliser ce document/ }));
    expect(dernier(onChange).facture).toMatchObject({
      titre: "FACTURE",
      prefixe: "FAC-",
      echeance: "sous_15_jours",
    });
  });
});

describe("une fois personnalisé", () => {
  const personnalise: ReglagesDocuments = {
    ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
    types: { facture: { titre: "NOTE", prefixe: "N-{AAAA}-" } },
  };

  it("montre le numéro tel qu'il sortira, année comprise", () => {
    afficher(personnalise);
    expect(screen.getByText(`N-${new Date().getFullYear()}-V026`)).toBeTruthy();
  });

  it("retire la clé du type, et d'aucun autre, quand on revient en arrière", () => {
    const onChange = afficher({
      ...personnalise,
      types: { ...personnalise.types, devis: { titre: "OFFRE" } },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revenir aux réglages de la boutique/ }));
    expect(dernier(onChange)).toEqual({ devis: { titre: "OFFRE" } });
  });
});

describe("ce qui est proposé dépend du document", () => {
  it("n'offre pas de préfixe au bon de commande fournisseur, qui n'a pas de numéro", () => {
    // Il ne naît d'aucune ligne de base : il se compose à la volée
    // depuis le catalogue. Lui tirer un numéro consommerait un
    // compteur à chaque aperçu.
    afficher({
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      types: { achat: { titre: "Bon de commande" } },
    });
    fireEvent.click(screen.getByRole("button", { name: /Bon de commande fournisseur/ }));
    expect(screen.queryByLabelText(/Préfixe de numérotation/)).toBeNull();
    // Le modèle, lui, s'applique depuis qu'il est passé sur le moteur
    // commun.
    expect(screen.getByText("Modèle")).toBeTruthy();
  });

  it("n'offre l'échéance qu'à la facture, et la validité qu'au devis", () => {
    afficher({
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      types: { facture: { titre: "FACTURE" }, devis: { titre: "DEVIS" } },
    });
    expect(screen.getByLabelText(/Échéance/)).toBeTruthy();
    expect(screen.queryByLabelText(/Durée de validité/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Devis/ }));
    expect(screen.getByLabelText(/Durée de validité/)).toBeTruthy();
    expect(screen.queryByLabelText(/Échéance/)).toBeNull();
  });
});

describe("les neuf types ont leur éditeur", () => {
  it("le bon de commande fournisseur a rejoint le moteur commun", () => {
    // Il était le dernier à garder son implémentation d'origine : son
    // éditeur de mise en page n'allumait rien, et n'était donc pas
    // proposé. Ce n'est plus le cas.
    afficher();
    expect(screen.getByRole("button", { name: /Personnaliser la mise en page/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Bon de commande fournisseur/ }));
    expect(screen.getByRole("button", { name: /Personnaliser la mise en page/ })).toBeTruthy();
    expect(screen.queryByText(/ne passe pas encore par le moteur commun/)).toBeNull();
  });
});
