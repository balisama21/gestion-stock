import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Product, Sale } from "../../types";

/**
 * Une requête Supabase factice : chaque méthode chaîne, et l'attente
 * rend les lignes de la table demandée.
 */
const lignesBar = [
  {
    id: "l1",
    store_id: "s",
    note_id: "n1",
    product_id: "thb",
    designation: "THB",
    genre: "article",
    quantite: 3,
    prix_unit: "5000",
    offert: false,
    serveur: "Rado",
    annulee: false,
    motif: null,
    sale_id: null,
    cree_le: new Date().toISOString(),
  },
];
vi.mock("../../lib/supabase", () => {
  const requete = (table: string) => {
    const r: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "like", "order", "range", "limit", "in"])
      r[m] = () => r;
    r.then = (ok: (v: unknown) => void) =>
      ok({ data: table === "bar_note_lignes" ? lignesBar : [], error: null });
    return r;
  };
  return { supabase: { from: requete } };
});

import { HabituesView } from "./HabituesView";
import { EquipeBarView } from "./EquipeBarView";
import { BilanBarView } from "./BilanBarView";
import { dateDuJour } from "../../lib/dates";
import { useBonsDePreparation } from "./BonsDePreparation";
import { enregistrerReglagesBons } from "../../lib/bonsBar";

afterEach(cleanup);

const aujourdhui = dateDuJour();
const vente = (p: Partial<Sale>): Sale => ({
  id: "v",
  numero: "V1",
  date: aujourdhui,
  productId: "thb",
  designation: "THB",
  quantite: 2,
  prixVenteUnit: 5000,
  totalVente: 10000,
  prixAchatUnitRef: 3500,
  totalAchatRef: 7000,
  margeTotale: 3000,
  vendeur: "Lova",
  commission: 0,
  montantPaye: 4000,
  montantRembourse: 0,
  montantAvoire: 0,
  soldeDu: 6000,
  statutCredit: "Partiel",
  clientId: "c1",
  ...p,
});

const client = {
  id: "c1",
  nom: "Rakoto",
  prenom: "Rado",
  telephone: "034 00 000 00",
} as never;

describe("les pages Plus du bar", () => {
  it("Habitués : montre l'ardoise et la règle, la plus ancienne d'abord", async () => {
    const paiement = vi.fn().mockResolvedValue({ error: null });
    render(
      <HabituesView
        clients={[client]}
        sales={[vente({})]}
        onAddClient={vi.fn()}
        onUpdateClient={vi.fn()}
        onDeleteClient={vi.fn()}
        onAddPaymentToSale={paiement}
      />,
    );
    expect(screen.getByText("Ardoises à récupérer")).toBeTruthy();
    fireEvent.click(screen.getByText("Rado Rakoto"));
    fireEvent.click(screen.getByRole("button", { name: "Encaisser" }));
    await waitFor(() =>
      expect(paiement).toHaveBeenCalledWith("v", {
        montant: 6000,
        methode: "especes",
        note: "Règlement d'ardoise",
      }),
    );
  });

  it("Équipe : lit ce que chaque serveur a servi", async () => {
    render(
      <EquipeBarView
        storeId="s"
        sales={[vente({})]}
        membres={[{ nom: "Lova", mention: "Responsable" }]}
        serveursSansCompte={[{ id: "p1", nom: "Rado", telephone: null }]}
        estProprietaire
      />,
    );
    await waitFor(() => expect(screen.getByText("15 000 Ar", { exact: false })).toBeTruthy());
    expect(screen.getByText("3 articles · 1 table")).toBeTruthy();
  });

  it("Bilan : fait le compte de la semaine et ouvre la vue comptable", () => {
    render(
      <BilanBarView
        storeId="s"
        sales={[vente({})]}
        expenses={[]}
        products={[{ id: "thb", categoryId: "bi", prixAchat: 3500 } as Product]}
        categories={[{ id: "bi", nom: "Bières", usage: "produit" } as never]}
        vueComptable={<p>Bilan comptable</p>}
      />,
    );
    expect(screen.getByText("Ce qui se vend")).toBeTruthy();
    expect(screen.getAllByText("Bières").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Vue comptable/ }));
    expect(screen.getByText("Bilan comptable")).toBeTruthy();
  });
});

describe("les bons de préparation", () => {
  it("imprime un bon par poste, seul sur le papier", () => {
    enregistrerReglagesBons("s", { actif: true, largeur: 58, postes: {} });
    let classePendantImpression = false;
    let contenu = "";
    const impression = vi.spyOn(window, "print").mockImplementation(() => {
      classePendantImpression = document.body.classList.contains("impression-bon");
      contenu = document.querySelector(".bon-impression")?.textContent ?? "";
    });
    const Essai = () => {
      const bons = useBonsDePreparation(
        "s",
        [{ id: "thb", categoryId: "bi" } as Product, { id: "broch", categoryId: "gr" } as Product],
        [
          { id: "bi", nom: "Bières" } as never,
          { id: "gr", nom: "Brochettes et grillades" } as never,
        ],
      );
      return (
        <>
          <button
            type="button"
            onClick={() =>
              bons.imprimer(
                [
                  { productId: "thb", designation: "THB", quantite: 3 },
                  { productId: "broch", designation: "Brochette zébu", quantite: 2 },
                ],
                { table: "Table 4", serveur: "Rado" },
              )
            }
          >
            Envoyer
          </button>
          {bons.portail}
        </>
      );
    };
    render(<Essai />);
    fireEvent.click(screen.getByText("Envoyer"));
    expect(impression).toHaveBeenCalledOnce();
    expect(classePendantImpression).toBe(true);
    expect(document.body.classList.contains("impression-bon")).toBe(false);
    expect(contenu).toContain("BAR");
    expect(contenu).toContain("CUISINE");
    expect(contenu).toContain("Table 4");
    expect(contenu).toContain("Brochette zébu");
    impression.mockRestore();
  });
});
