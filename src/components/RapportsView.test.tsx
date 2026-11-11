import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RapportsView } from "./RapportsView";
import { dateDuJour } from "../lib/dates";
import type { Expense, Sale } from "../types";

const jour = dateDuJour();
const vente = (marge: number, total = 4500): Sale =>
  ({ id: `v${marge}`, date: jour, totalVente: total, margeTotale: marge }) as unknown as Sale;
const depense = (montant: number): Expense =>
  ({ id: `d${montant}`, date: jour, montant, type: "Autre dépense" }) as unknown as Expense;

function afficher(sales: Sale[], expenses: Expense[]) {
  render(
    <RapportsView
      sales={sales}
      purchases={[]}
      expenses={expenses}
      products={[]}
      postes={[]}
      locale={"fr" as never}
    />,
  );
  /** Une étape de la cascade du compte de résultat, par son libellé. */
  const etape = (libelle: string) =>
    screen.getByText(libelle).closest("[role=listitem]") as HTMLElement;
  return { etape };
}

describe("le Bilan dit la marge et le résultat, avec leur vrai signe", () => {
  afterEach(cleanup);

  const grandResultat = () => document.querySelector(".app-bilan-hero-valeur") as HTMLElement;

  it("retire les dépenses de la marge brute pour donner le résultat", () => {
    const { etape } = afficher([vente(1500), vente(2000)], [depense(500)]);
    expect(within(etape("Marge brute des ventes")).getByText(/3\s?500/)).toBeTruthy();
    expect(grandResultat().textContent).toMatch(/\+3\s?000/);
    // Les deux horizons non choisis disent leur résultat ; le choisi ne
    // le répète pas, il est juste en dessous.
    const horizons = within(screen.getByRole("tablist", { name: "Horizon" })).getAllByRole("tab");
    expect(horizons).toHaveLength(3);
    const autres = horizons.filter((o) => o.getAttribute("aria-selected") !== "true");
    expect(autres).toHaveLength(2);
    for (const onglet of autres) expect(onglet.textContent).toMatch(/\+3\s?000/);
  });

  it("une perte s'affiche en négatif et en rouge, jamais « +- »", () => {
    afficher([vente(200)], [depense(1000)]);
    const grand = grandResultat();
    expect(grand.className).toContain("t-danger");
    expect(grand.textContent).toMatch(/−\s?800/);
    expect(grand.textContent).not.toContain("+-");
    expect(screen.getByText("Perte sur la période")).toBeTruthy();
  });

  it("chaque chiffre du compte de résultat ne s'écrit qu'une fois", () => {
    afficher([vente(1500), vente(2000)], [depense(500)]);
    const carte = screen.getByRole("region", { name: "Compte de résultat" });
    const calcul = within(carte).getByRole("tabpanel");
    // Le résultat (+3 000) ne s'écrit qu'une fois sous les onglets.
    expect(calcul.textContent?.match(/3\s?000/g)?.length ?? 0).toBe(1);
    expect(screen.getAllByText(/Compte de résultat/)).toHaveLength(1);
  });
});
