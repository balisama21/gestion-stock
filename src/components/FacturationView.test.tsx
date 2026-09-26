import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { FacturationView } from "./FacturationView";
import type { Payment, StoreSettings } from "../types";
import type { DocumentCommercial } from "./facturation/documents";
import type { Facturation } from "../hooks/useFacturation";

/**
 * CE QUE LA PAGE MONTRE, ET CE QU'ELLE CACHE.
 *
 * Les calculs sont vérifiés ailleurs, sur des fonctions pures. Ce banc
 * tient les promesses que seule la page peut tenir : un vendeur ne voit
 * pas le classeur des factures reçues, un filtre laisse toujours de
 * quoi revenir en arrière, et une liste vide explique ce qui viendra
 * s'y ranger au lieu de rester blanche.
 */

const BOUTIQUE = {
  storeName: "Boutique d'essai",
  subtitle: "",
  suppliers: [],
  currencySymbol: "Ar",
  tvaRate: 0,
} as unknown as StoreSettings;

const AUJOURDHUI = "2026-09-22";

const facturation = (p: Partial<Facturation> = {}): Facturation => ({
  chargement: false,
  erreur: null,
  avoirs: [],
  lignesAvoir: [],
  envois: new Set(),
  recus: new Set(),
  relances: new Map(),
  aujourdhui: AUJOURDHUI,
  recharger: vi.fn().mockResolvedValue(undefined),
  marquerEmis: vi.fn().mockResolvedValue(undefined),
  lireCopie: vi.fn().mockResolvedValue(null),
  preparerLogo: vi.fn().mockResolvedValue(undefined),
  marquerEnvoye: vi.fn().mockResolvedValue({ error: null }),
  creerAvoir: vi.fn().mockResolvedValue({ avoir: null, error: null }),
  ...p,
});

const doc = (p: Partial<DocumentCommercial> & { cle: string }): DocumentCommercial => ({
  entite: "vente",
  entiteId: p.cle,
  type: "facture",
  numero: "FAC-V001",
  numeroBrut: "V001",
  date: "2026-09-20",
  echeance: "2026-10-05",
  tiers: "Rakoto",
  clientId: null,
  vendeur: "Hanta",
  auteurId: null,
  montant: 250_000,
  paye: 0,
  reste: 250_000,
  statut: "emise",
  avoirDe: null,
  ventes: [],
  devis: null,
  lignesDevis: [],
  factureAchat: null,
  avoir: null,
  reference: null,
  ...p,
});

const DOCS: DocumentCommercial[] = [
  doc({ cle: "vente:T1", numero: "FAC-V001", tiers: "Rakoto" }),
  doc({
    cle: "vente:T2",
    numero: "FAC-V002",
    numeroBrut: "V002",
    tiers: "Naina",
    statut: "retard",
    montant: 80_000,
    reste: 80_000,
  }),
  doc({
    cle: "facture_achat:F1",
    entite: "facture_achat",
    type: "facture_achat",
    numero: "FA-FA001",
    numeroBrut: "FA001",
    tiers: "Quincaillerie du Sud",
    statut: "a_payer",
    montant: 500_000,
    reste: 500_000,
    vendeur: "",
  }),
];

const PAIEMENTS: Payment[] = [
  {
    id: "p1",
    numero: "PAY001",
    orderId: null,
    saleId: "s1",
    montant: 120_000,
    methode: "especes",
    reference: null,
    note: null,
    createdAt: "2026-09-20T10:00:00+03:00",
  },
];

function afficher(p: Partial<React.ComponentProps<typeof FacturationView>> = {}) {
  return render(
    <FacturationView
      documents={DOCS}
      payments={PAIEMENTS}
      settings={BOUTIQUE}
      locale="FR"
      facturation={facturation()}
      moiNom="Hanta"
      voitTout
      peutCreer
      {...p}
    />,
  );
}

afterEach(cleanup);

describe("ce que la page montre", () => {
  it("liste chaque pièce une seule fois, avec son statut en toutes lettres", () => {
    afficher();
    expect(screen.getByText("FAC-V001")).toBeTruthy();
    expect(screen.getAllByText("FAC-V002")).toHaveLength(1);
    expect(screen.getAllByText("En retard").length).toBeGreaterThan(0);
  });

  it("annonce le nombre de pièces sur chaque onglet", () => {
    afficher();
    const onglets = screen.getByRole("tablist");
    expect(within(onglets).getByRole("tab", { name: /Tous/ })).toBeTruthy();
    expect(within(onglets).getByRole("tab", { name: /Factures d'achat/ })).toBeTruthy();
  });
});

describe("la portée", () => {
  it("un vendeur qui ne voit que ses pièces n'a pas le classeur des factures reçues", () => {
    afficher({ voitTout: false });
    expect(screen.queryByText("FA-FA001")).toBeNull();
    const onglets = screen.getByRole("tablist");
    expect(within(onglets).queryByRole("tab", { name: /Factures d'achat/ })).toBeNull();
  });
});

describe("les états de la page", () => {
  it("sans aucune pièce, elle explique ce qui viendra s'y ranger", () => {
    const onCreer = vi.fn();
    afficher({ documents: [], onCreerPremiere: onCreer });
    expect(screen.getByText(/se rangeront ici/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Créer ma première facture/ }));
    expect(onCreer).toHaveBeenCalled();
  });

  it("le bouton de création n'apparaît pas à qui n'a pas le droit d'établir une pièce", () => {
    afficher({ documents: [], peutCreer: false, onCreerPremiere: vi.fn() });
    expect(screen.queryByRole("button", { name: /Créer ma première facture/ })).toBeNull();
  });

  it("un filtre sans résultat propose toujours de revenir en arrière", () => {
    afficher();
    fireEvent.change(screen.getByPlaceholderText(/Numéro, client/i), {
      target: { value: "introuvable" },
    });
    expect(screen.getByText("Aucun document ne correspond.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Effacer les filtres/ }));
    expect(screen.getByText("FAC-V001")).toBeTruthy();
  });

  it("une erreur de chargement propose de réessayer", () => {
    const f = facturation({ erreur: "réseau coupé" });
    afficher({ documents: [], facturation: f });
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/ }));
    expect(f.recharger).toHaveBeenCalled();
  });
});

describe("les indicateurs filtrent la liste", () => {
  it("cliquer sur « En retard » ne laisse que les retards, et le dit en puce", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Ne montrer que les factures en retard/ }));
    expect(screen.getByText("FAC-V002")).toBeTruthy();
    expect(screen.queryByText("FAC-V001")).toBeNull();
    expect(screen.getByRole("button", { name: /Retirer le filtre En retard/ })).toBeTruthy();
  });

  it("la puce retire le filtre qu'elle nomme", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Ne montrer que les factures en retard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Retirer le filtre En retard/ }));
    expect(screen.getByText("FAC-V001")).toBeTruthy();
  });
});
