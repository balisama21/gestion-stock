import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FacturesAchatView } from "./FacturesAchatView";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../features/documents/lib/reglages";
import type { Database } from "../lib/database.types";

/**
 * L'ÉCRAN DES FACTURES REÇUES.
 *
 * Deux promesses à tenir, et elles portent sur de l'argent. Le total
 * est celui du PAPIER, saisi à la main : il ne doit jamais être
 * remplacé en douce par la somme des lignes. Et cet écran ne touche à
 * rien d'autre — ni caisse, ni stock, ni achats — ce que la charge
 * utile envoyée doit refléter.
 */

const FOURNISSEURS = [
  { id: "f1", nom: "Rasoa", entreprise: "Distri Nord" },
] as unknown as Database["public"]["Tables"]["suppliers"]["Row"][];

function afficher() {
  const onAdd = vi.fn().mockResolvedValue({ error: null });
  render(
    <FacturesAchatView
      factures={[]}
      lignes={[]}
      fournisseurs={FOURNISSEURS}
      products={[]}
      reglagesDocuments={REGLAGES_DOCUMENTS_PAR_DEFAUT}
      storeId="s1"
      onAdd={onAdd}
      onUpdate={vi.fn()}
      onRetour={vi.fn()}
    />,
  );
  return onAdd;
}

const ouvrir = () =>
  fireEvent.click(screen.getByRole("button", { name: /Enregistrer une facture/ }));

const valider = () =>
  fireEvent.click(screen.getByRole("button", { name: /Enregistrer la facture/ }));

afterEach(cleanup);

describe("le total vient du papier", () => {
  it("part tel qu'il a été saisi, même si les lignes disent autre chose", async () => {
    const onAdd = afficher();
    ouvrir();
    fireEvent.change(screen.getByLabelText("Nom du fournisseur"), {
      target: { value: "Distri Nord" },
    });
    fireEvent.change(screen.getByLabelText(/Désignation/), { target: { value: "Ciment" } });
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/Prix unitaire/), { target: { value: "40000" } });
    // Les lignes totalisent 400 000 ; le papier en porte 460 000.
    fireEvent.change(screen.getByLabelText(/Total de la facture/), { target: { value: "460000" } });
    valider();
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(onAdd.mock.calls[0][0]).toMatchObject({ total: 460000 });
  });

  it("signale l'écart plutôt que de le corriger", () => {
    afficher();
    ouvrir();
    fireEvent.change(screen.getByLabelText(/Désignation/), { target: { value: "Ciment" } });
    fireEvent.change(screen.getByLabelText(/Prix unitaire/), { target: { value: "40000" } });
    fireEvent.change(screen.getByLabelText(/Total de la facture/), { target: { value: "460000" } });
    expect(screen.getByText(/Les lignes totalisent/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reprendre ce montant/ })).toBeTruthy();
  });
});

describe("ce que l'écran refuse", () => {
  it("une facture sans fournisseur", async () => {
    const onAdd = afficher();
    ouvrir();
    fireEvent.change(screen.getByLabelText(/Total de la facture/), { target: { value: "1000" } });
    valider();
    expect((await screen.findByRole("alert")).textContent).toMatch(/de quel fournisseur/i);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("un règlement supérieur au total", async () => {
    const onAdd = afficher();
    ouvrir();
    fireEvent.change(screen.getByLabelText("Nom du fournisseur"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText(/Total de la facture/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/Déjà réglé/), { target: { value: "2000" } });
    valider();
    expect((await screen.findByRole("alert")).textContent).toMatch(/dépasse le total/i);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
