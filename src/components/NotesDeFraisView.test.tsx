import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NotesDeFraisView } from "./NotesDeFraisView";
import type { NoteDeFrais } from "../hooks/useNotesDeFrais";
import type { Devise, DeviseBoutique } from "../lib/devises";

const note = (surcharge: Partial<NoteDeFrais>): NoteDeFrais => ({
  id: "n1",
  store_id: "s",
  created_by: "moi",
  numero: "NDF001",
  date: "2026-09-20",
  beneficiaire: "Lanto",
  membre_id: null,
  personne_id: null,
  category_id: null,
  motif: "Taxi",
  montant: 10000,
  devise: "MGA",
  taux: 1,
  montant_converti: 10000,
  justificatif: null,
  statut: "a_valider",
  decision_par: null,
  decision_le: null,
  motif_refus: null,
  depense_id: null,
  rembourse_le: null,
  created_at: "2026-09-20T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  ...surcharge,
});

const catalogue = [
  { id: "d1", code: "MGA", nom: "Ariary", symbole: "Ar", decimales: 0, store_id: null },
  { id: "d2", code: "EUR", nom: "Euro", symbole: "€", decimales: 2, store_id: null },
] as Devise[];
const devises = [
  { id: "b1", code: "MGA", principale: true, actif: true, taux: 1 },
  { id: "b2", code: "EUR", principale: false, actif: true, taux: 5000 },
] as DeviseBoutique[];

const actions = () => ({
  onCreer: vi.fn(async () => ({ error: null })),
  onModifier: vi.fn(async () => ({ error: null })),
  onSupprimer: vi.fn(async () => ({ error: null })),
  onDecider: vi.fn(async () => ({ error: null })),
  onRembourser: vi.fn(async () => ({ error: null })),
});

const afficher = (notes: NoteDeFrais[], peutGerer: boolean, a = actions()) => {
  render(
    <NotesDeFraisView
      notes={notes}
      peutGerer={peutGerer}
      moiId="moi"
      monNom="Moi"
      locale="FR"
      catalogue={catalogue}
      devises={devises}
      principale="MGA"
      postes={[]}
      personnes={[]}
      {...a}
    />,
  );
  return a;
};

describe("notes de frais", () => {
  afterEach(cleanup);

  it("liste les notes avec leur statut et le montant d'origine en devise étrangère", () => {
    afficher(
      [
        note({}),
        note({
          id: "n2",
          numero: "NDF002",
          devise: "EUR",
          montant: 10,
          taux: 5000,
          montant_converti: 50000,
          motif: "Hôtel",
        }),
      ],
      false,
    );
    expect(screen.getByText("Taxi")).toBeTruthy();
    expect(screen.getByText(/10,00.€/)).toBeTruthy();
    expect(screen.getAllByText("À valider").length).toBeGreaterThan(0);
  });

  it("un responsable rembourse une note validée", async () => {
    const a = afficher([note({ statut: "validee" })], true);
    fireEvent.click(screen.getByText("Taxi"));
    const dialogue = await screen.findByRole("dialog");
    fireEvent.click(within(dialogue).getByRole("button", { name: /Rembourser/ }));
    await waitFor(() => expect(a.onRembourser).toHaveBeenCalledWith("n1", expect.any(String)));
  });

  it("sans droit de gestion, pas de bouton Valider", async () => {
    afficher([note({})], false);
    fireEvent.click(screen.getByText("Taxi"));
    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).queryByRole("button", { name: /Valider/ })).toBeNull();
    expect(within(dialogue).getByRole("button", { name: /Modifier/ })).toBeTruthy();
  });

  it("le filtre ne garde que le statut choisi", () => {
    afficher([note({}), note({ id: "n2", motif: "Repas", statut: "refusee" })], true);
    fireEvent.click(screen.getByRole("button", { name: /Refusée/, pressed: false }));
    expect(screen.queryByText("Taxi")).toBeNull();
    expect(screen.getByText("Repas")).toBeTruthy();
  });
});
