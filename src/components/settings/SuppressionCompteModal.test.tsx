// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Supprimer son compte n'emporte jamais des boutiques en bloc : la base
 * le refuse tant qu'il en possède une, et la fenêtre le dit avant même
 * qu'on tape son mot de passe.
 */

const auth = vi.hoisted(() => ({
  reauthenticate: vi.fn(async () => ({ error: null as string | null })),
  deleteAccount: vi.fn(async () => ({ error: null as string | null })),
}));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => auth }));

afterEach(() => {
  cleanup();
  auth.reauthenticate.mockClear();
  auth.deleteAccount.mockClear();
});

async function afficher(boutiques: { id: string; name: string }[]) {
  const { SuppressionCompteModal } = await import("./SuppressionCompteModal");
  render(<SuppressionCompteModal open onClose={() => {}} boutiques={boutiques} />);
}

describe("supprimer mon compte", () => {
  it("bloqué tant que le compte possède des boutiques : il les nomme", async () => {
    await afficher([
      { id: "a", name: "Boutique de Mamy" },
      { id: "b", name: "Vente en ligne" },
    ]);
    const fenetre = screen.getByRole("dialog");
    expect(fenetre.textContent).toContain("Boutique de Mamy");
    expect(fenetre.textContent).toContain("Vente en ligne");
    expect(fenetre.textContent).toContain("Supprimer cette boutique");
    expect(screen.queryByLabelText("Confirmez avec votre mot de passe")).toBeNull();
    expect(screen.queryByRole("button", { name: "Supprimer mon compte" })).toBeNull();
  });

  it("sans boutique : supprime après le mot de passe", async () => {
    const ancien = window.location;
    Object.defineProperty(window, "location", { value: { href: "" }, configurable: true });
    try {
      await afficher([]);
      fireEvent.change(screen.getByLabelText("Confirmez avec votre mot de passe"), {
        target: { value: "secret" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
      await waitFor(() => expect(auth.deleteAccount).toHaveBeenCalledTimes(1));
      expect(auth.reauthenticate).toHaveBeenCalledWith("secret");
    } finally {
      Object.defineProperty(window, "location", { value: ancien, configurable: true });
    }
  });

  it("affiche le refus de la base en clair", async () => {
    auth.deleteAccount.mockResolvedValueOnce({
      error: "Votre compte possède encore une boutique.",
    });
    await afficher([]);
    fireEvent.change(screen.getByLabelText("Confirmez avec votre mot de passe"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    expect(await screen.findByText("Votre compte possède encore une boutique.")).toBeTruthy();
  });
});
