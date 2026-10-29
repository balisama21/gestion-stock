import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { VendeursView } from "./VendeursView";
import type { Seller } from "../types";

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: null }) }));
vi.mock("../hooks/useWorkspace", () => ({
  useWorkspace: () => ({ activeStore: { id: "s1", name: "Boutique", owner_id: "u1" } }),
}));
vi.mock("../hooks/useMarque", () => ({ useMarque: () => ({ nom: "Tantana" }) }));
vi.mock("../lib/supabase", () => ({ supabase: {} }));

/**
 * LA PAGE VENDEURS
 *
 * Seul, le responsable n'y est pas présenté comme un vendeur : pas de
 * solde « en poche », un état vide qui dit quoi faire. Avec une équipe,
 * le solde est celui de l'équipe, chacun porte son rôle, et le
 * responsable vient à part, sans poche ni bouton « retirer ».
 */
afterEach(cleanup);

const vendeur = (p: Partial<Seller>): Seller => ({
  id: p.nom ?? "x",
  nom: "x",
  statut: "Actif",
  totalVentesMontant: 0,
  totalVentesNombre: 0,
  totalDepenses: 0,
  totalRemis: 0,
  totalAvancesSurCaisse: 0,
  soldeNetEnPoche: 0,
  ...p,
});

const MAMY = vendeur({
  id: "u1",
  nom: "Mamy Balsama",
  nature: "responsable",
  totalVentesMontant: 28_800,
  totalVentesNombre: 2,
  soldeNetEnPoche: 27_800,
});
const HANTA = vendeur({
  id: "m1",
  nom: "Hanta",
  nature: "membre",
  role: "vendeur",
  totalVentesMontant: 15_000,
  totalVentesNombre: 3,
  totalDepenses: 2_000,
  soldeNetEnPoche: 13_000,
});
const LANTO = vendeur({
  id: "V3",
  nom: "Lanto",
  nature: "sans_compte",
  totalVentesMontant: 5_000,
  totalVentesNombre: 1,
  soldeNetEnPoche: 5_000,
});

function afficher(sellers: Seller[], onVoirVentes = vi.fn()) {
  render(
    <VendeursView
      sellers={sellers}
      sales={[]}
      expenses={[]}
      products={[]}
      locale="FR"
      onAddSeller={vi.fn()}
      onDeleteSeller={vi.fn()}
      onVoirVentes={onVoirVentes}
    />,
  );
  return { onVoirVentes };
}

const texte = () => document.body.textContent ?? "";

describe("seul dans sa boutique", () => {
  it("ne présente pas le responsable comme un vendeur", () => {
    afficher([MAMY]);
    expect(screen.getByText(/Vous vendez seul/)).toBeTruthy();
    expect(texte()).not.toContain("en poche —");
    expect(texte()).not.toMatch(/27\s800/);
    expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Relevé/ })).toBeNull();
  });

  it("propose d'inviter un vendeur et d'ouvrir ses propres ventes", () => {
    const { onVoirVentes } = afficher([MAMY]);
    fireEvent.click(screen.getByRole("button", { name: /Voir mes ventes \(2\)/ }));
    expect(onVoirVentes).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Inviter un vendeur/ }));
    expect(screen.getByRole("dialog", { name: /Inviter un vendeur/ })).toBeTruthy();
  });
});

describe("avec une équipe", () => {
  it("le solde en poche est celui de l'équipe, sans le responsable", () => {
    afficher([MAMY, HANTA, LANTO]);
    expect(screen.getByText(/Argent détenu par l'équipe/)).toBeTruthy();
    // 13 000 + 5 000, et non 45 800 avec la caisse du responsable.
    expect(texte()).toMatch(/18\s000/);
    expect(texte()).not.toMatch(/45\s800/);
    expect(texte()).toContain("2 collaborateurs");
  });

  it("chacun porte son rôle réel ; seul un membre se retire de l'équipe", () => {
    afficher([MAMY, HANTA, LANTO]);
    expect(screen.getByText("Vendeur")).toBeTruthy();
    expect(screen.getByText("Sans compte")).toBeTruthy();
    expect(screen.getByText("Responsable")).toBeTruthy();
    const retirer = screen.getAllByRole("button", { name: /^Retirer / });
    expect(retirer).toHaveLength(1);
    expect(retirer[0].getAttribute("aria-label")).toBe("Retirer Hanta de l'équipe");
  });

  it("la fiche du responsable ne parle ni de poche ni de remise", () => {
    afficher([MAMY, HANTA]);
    fireEvent.click(screen.getByText("Mamy Balsama"));
    const fiche = screen.getByRole("dialog", { name: /Mamy Balsama/ });
    expect(within(fiche).queryByText("Solde en poche")).toBeNull();
    expect(within(fiche).queryByText("Rendu à la caisse")).toBeNull();
    expect(within(fiche).getByText(/rien à rendre/)).toBeTruthy();
  });
});
