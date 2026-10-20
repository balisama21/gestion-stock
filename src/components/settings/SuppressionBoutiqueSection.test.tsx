// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuppressionBoutiqueSection } from "./SuppressionBoutiqueSection";

/**
 * Supprimer UNE boutique ne doit jamais ressembler à supprimer le compte :
 * la fenêtre nomme la boutique, dit que le compte et les autres boutiques
 * restent, et ne supprime qu'après le mot de passe.
 */

afterEach(cleanup);

function afficher(peutSupprimer = true) {
  const reauthentifier = vi.fn(async () => ({ error: null as string | null }));
  const supprimer = vi.fn(async () => ({ error: null as string | null }));
  render(
    <SuppressionBoutiqueSection
      nomBoutique="Vente en ligne"
      peutSupprimer={peutSupprimer}
      reauthentifier={reauthentifier}
      supprimer={supprimer}
    />,
  );
  return { reauthentifier, supprimer };
}

const ouvrir = () => fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
const valider = () =>
  fireEvent.click(screen.getByRole("button", { name: "Supprimer la boutique" }));

describe("supprimer cette boutique", () => {
  it("nomme la boutique et rassure sur le compte et les autres boutiques", () => {
    afficher();
    ouvrir();
    const fenetre = screen.getByRole("dialog");
    expect(fenetre.textContent).toContain("Vente en ligne");
    expect(fenetre.textContent).toContain(
      "Votre compte et vos autres boutiques ne sont pas touchés.",
    );
  });

  it("ne supprime rien sans mot de passe", async () => {
    const { reauthentifier, supprimer } = afficher();
    ouvrir();
    valider();
    expect(await screen.findByText("Entrez votre mot de passe pour confirmer.")).toBeTruthy();
    expect(reauthentifier).not.toHaveBeenCalled();
    expect(supprimer).not.toHaveBeenCalled();
  });

  it("un mauvais mot de passe arrête tout", async () => {
    const { reauthentifier, supprimer } = afficher();
    reauthentifier.mockResolvedValueOnce({ error: "Mot de passe incorrect." });
    ouvrir();
    fireEvent.change(screen.getByLabelText("Confirmez avec votre mot de passe"), {
      target: { value: "faux" },
    });
    valider();
    expect(await screen.findByText("Mot de passe incorrect.")).toBeTruthy();
    expect(supprimer).not.toHaveBeenCalled();
  });

  it("supprime après le mot de passe, puis referme la fenêtre", async () => {
    const { reauthentifier, supprimer } = afficher();
    ouvrir();
    fireEvent.change(screen.getByLabelText("Confirmez avec votre mot de passe"), {
      target: { value: "secret" },
    });
    valider();
    await waitFor(() => expect(supprimer).toHaveBeenCalledTimes(1));
    expect(reauthentifier).toHaveBeenCalledWith("secret");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("la dernière boutique du compte ne se supprime pas d'ici", () => {
    afficher(false);
    const bouton = screen.getByRole("button", { name: "Supprimer" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    expect(screen.getByText(/seule boutique de votre compte/)).toBeTruthy();
  });
});
