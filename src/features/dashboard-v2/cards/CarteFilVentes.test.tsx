import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteFilVentes } from "./CarteFilVentes";
import { LIGNES_EN_APERCU } from "../lib/repli";
import type { Product, Sale } from "../../../types";

/** Cinq ventes sur trois jours : de quoi voir l'aperçu couper. */
const VENTES = [
  { id: "v1", date: "2026-09-19", totalVente: 12000, quantite: 2, statutCredit: "Payé" },
  { id: "v2", date: "2026-09-19", totalVente: 9000, quantite: 1, statutCredit: "Payé" },
  { id: "v3", date: "2026-09-18", totalVente: 6000, quantite: 1, statutCredit: "Partiel" },
  { id: "v4", date: "2026-09-18", totalVente: 4000, quantite: 1, statutCredit: "Payé" },
  { id: "v5", date: "2026-09-17", totalVente: 3000, quantite: 1, statutCredit: "Payé" },
].map((v) => ({
  ...v,
  productId: "p1",
  designation: "Savon",
  prixAchatUnitRef: 3000,
})) as unknown as Sale[];

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

const lignes = (c: HTMLElement) => c.querySelectorAll(".sale").length;

describe("le fil des ventes arrive replié, mais pas muet", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("montre un aperçu de trois lignes, et non un titre seul", () => {
    // Replié, il ne disait pas CE QU'il y avait dessous. Trois lignes
    // suffisent : la dernière vente répond souvent à la question.
    const { container } = afficher();
    expect(screen.getByLabelText("Déplier le fil des ventes")).toBeTruthy();
    expect(lignes(container)).toBe(LIGNES_EN_APERCU);
  });

  it("ne laisse jamais une date sans ligne en dessous", () => {
    // L'aperçu coupe au milieu du 18 : le 17 ne doit pas apparaître.
    const { container } = afficher();
    const jours = [...container.querySelectorAll(".day")];
    expect(jours).toHaveLength(2);
    for (const j of jours) expect(j.querySelectorAll(".sale").length).toBeGreaterThan(0);
  });

  it("garde le lien vers l'historique dans les deux états", () => {
    // C'est replié qu'on a le plus envie de voir la suite.
    afficher();
    expect(screen.getByText("Tout voir")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Déplier le fil des ventes"));
    expect(screen.getByText("Tout voir")).toBeTruthy();
  });

  it("déplié, montre tout le fil", () => {
    const { container } = afficher();
    fireEvent.click(screen.getByLabelText("Déplier le fil des ventes"));
    expect(lignes(container)).toBe(VENTES.length);
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
    expect(lignes(container)).toBe(VENTES.length);
  });
});
