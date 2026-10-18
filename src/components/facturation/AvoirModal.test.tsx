import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvoirModal } from "./AvoirModal";
import type { DocumentCommercial } from "./documents";

/**
 * Une case cochée puis grisée ne doit rien déclencher : sans ce garde,
 * un avoir partiel remettait en stock toutes les quantités de la facture.
 */
const doc = {
  numero: "FAC-V001",
  montant: 10000,
  paye: 10000,
  ventes: [{ id: "v1", productId: "p1", quantite: 4, designation: "Savon" }],
} as unknown as DocumentCommercial;

function ouvrir() {
  const onValider = vi.fn();
  render(
    <AvoirModal
      document={doc}
      devise="Ar"
      enCours={false}
      erreur={null}
      onFermer={vi.fn()}
      onValider={onValider}
    />,
  );
  return onValider;
}

const valider = () => fireEvent.submit(screen.getByLabelText(/Montant de l/).closest("form")!);

describe("l'avoir ne transmet que ce qui est permis", () => {
  afterEach(cleanup);

  it("avoir total : la remise en stock suit la case", () => {
    const onValider = ouvrir();
    fireEvent.click(screen.getByLabelText(/Remettre les articles en stock/));
    valider();
    expect(onValider).toHaveBeenCalledWith(expect.objectContaining({ remettreEnStock: true }));
  });

  it("case cochée, puis montant devenu partiel : rien ne revient en stock", () => {
    const onValider = ouvrir();
    fireEvent.click(screen.getByLabelText(/Remettre les articles en stock/));
    fireEvent.change(screen.getByLabelText(/Montant de l/), { target: { value: "4000" } });
    valider();
    expect(onValider).toHaveBeenCalledWith(
      expect.objectContaining({ montant: 4000, remettreEnStock: false }),
    );
  });
});
