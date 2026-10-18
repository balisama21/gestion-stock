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
  const ligne = (libelle: string) => screen.getByText(libelle).closest("tr") as HTMLElement;
  return { ligne };
}

describe("le Bilan dit la marge et le résultat, avec leur vrai signe", () => {
  afterEach(cleanup);

  it("retire les dépenses de la marge brute pour donner le résultat", () => {
    const { ligne } = afficher([vente(1500), vente(2000)], [depense(500)]);
    expect(within(ligne("Marge brute des ventes")).getAllByText(/\+3\s?500/).length).toBe(3);
    expect(within(ligne("Résultat (marge − dépenses)")).getAllByText(/\+3\s?000/).length).toBe(3);
  });

  it("une perte s'affiche en négatif et en rouge, jamais « +- »", () => {
    const { ligne } = afficher([vente(200)], [depense(1000)]);
    const resultat = ligne("Résultat (marge − dépenses)");
    const cellules = within(resultat).getAllByText(/−\s?800/);
    expect(cellules.length).toBe(3);
    expect(cellules[0].className).toContain("t-danger");
    expect(resultat.textContent).not.toContain("+-");
  });
});
