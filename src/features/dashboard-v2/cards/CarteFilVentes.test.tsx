import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteFilVentes } from "./CarteFilVentes";
import type { Product, Sale } from "../../../types";

const VENTES = [
  {
    id: "v1",
    date: "2026-09-19",
    productId: "p1",
    designation: "Savon",
    prixAchatUnitRef: 3000,
    quantite: 2,
    totalVente: 12000,
    statutCredit: "Payé",
  },
  {
    id: "v2",
    date: "2026-09-18",
    productId: "p1",
    designation: "Savon",
    prixAchatUnitRef: 3000,
    quantite: 1,
    totalVente: 6000,
    statutCredit: "Partiel",
  },
] as unknown as Sale[];

const PRODUITS = [{ id: "p1", designation: "Savon", prixAchat: 3000 }] as unknown as Product[];

function afficher(surcharge: Partial<React.ComponentProps<typeof CarteFilVentes>> = {}) {
  return render(
    <CarteFilVentes
      ventes={VENTES}
      produits={PRODUITS}
      images={[]}
      montantsVisibles
      onToutVoir={vi.fn()}
      {...surcharge}
    />,
  );
}

describe("le fil des ventes se replie, comme le journal", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("arrive replié : le titre et le chevron, rien d'autre", () => {
    const { container } = afficher();
    expect(screen.getByText("Fil des ventes")).toBeTruthy();
    expect(screen.getByLabelText("Déplier le fil des ventes")).toBeTruthy();
    expect(container.querySelector(".feed")).toBeNull();
  });

  it("ne propose pas « Tout voir » quand il n'y a rien à prolonger", () => {
    afficher();
    expect(screen.queryByText("Tout voir")).toBeNull();
  });

  it("se déplie, et le lien vers l'historique revient avec la liste", () => {
    const { container } = afficher();
    fireEvent.click(screen.getByLabelText("Déplier le fil des ventes"));
    expect(container.querySelector(".feed")).toBeTruthy();
    expect(container.querySelectorAll(".sale")).toHaveLength(2);
    expect(screen.getByText("Tout voir")).toBeTruthy();
    expect(screen.getByLabelText("Replier le fil des ventes")).toBeTruthy();
  });

  it("retient qu'on l'a déplié — sinon il faudrait le refaire chaque matin", () => {
    afficher();
    fireEvent.click(screen.getByLabelText("Déplier le fil des ventes"));
    expect(window.localStorage.getItem("tantana.dash.fil-replie")).toBe("0");
  });

  it("repart déplié quand le navigateur s'en souvient", () => {
    window.localStorage.setItem("tantana.dash.fil-replie", "0");
    const { container } = afficher();
    expect(container.querySelector(".feed")).toBeTruthy();
  });
});
