import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationsSection } from "./NotificationsSection";

/**
 * L'ABONNEMENT AU RÉSUMÉ, ET À QUI IL APPARTIENT.
 *
 * Il est ici, dans la section personnelle que tout le monde voit, et
 * non dans « Alertes de stock » qui n'est ouverte qu'au propriétaire :
 * recevoir un e-mail est une décision de celui qui le reçoit.
 */

const basculer = vi.fn(async (_: boolean) => ({ error: null as string | null }));
let abonne = false;

vi.mock("../../hooks/useAbonnementAlertesStock", () => ({
  useAbonnementAlertesStock: () => ({ abonne, chargement: false, basculer }),
}));

const afficher = (surcharge: Partial<React.ComponentProps<typeof NotificationsSection>> = {}) =>
  render(
    <NotificationsSection storeId="une-boutique" userId="moi" prealerteActive {...surcharge} />,
  );

const interrupteur = () => screen.queryByRole("switch", { name: "Résumé de préalerte par e-mail" });

describe("chacun règle son propre e-mail", () => {
  beforeEach(() => {
    abonne = false;
    basculer.mockClear();
  });
  afterEach(cleanup);

  it("la ligne est proposée à qui que ce soit, propriétaire ou non", () => {
    // Cette section est dans le groupe « Personnel », que tout le
    // monde voit : il n'y a rien à filtrer par rôle.
    afficher();
    expect(interrupteur()).toBeTruthy();
  });

  it("personne n'est inscrit au départ", () => {
    afficher();
    expect(interrupteur()?.getAttribute("aria-checked")).toBe("false");
  });

  it("s'inscrire, puis se retirer", async () => {
    afficher();
    fireEvent.click(interrupteur()!);
    await waitFor(() => expect(basculer).toHaveBeenCalledWith(true));

    cleanup();
    abonne = true;
    afficher();
    fireEvent.click(interrupteur()!);
    await waitFor(() => expect(basculer).toHaveBeenLastCalledWith(false));
  });

  it("rien à proposer tant que la boutique n'a pas activé la préalerte", () => {
    // S'abonner à un e-mail que rien n'enverra ferait attendre pour
    // rien.
    afficher({ prealerteActive: false });
    expect(interrupteur()).toBeNull();
  });

  it("dit qu'un refus n'a pas enregistré", async () => {
    basculer.mockResolvedValueOnce({ error: "Une boutique expirée ne se modifie plus." });
    afficher();
    fireEvent.click(interrupteur()!);
    expect(await screen.findByText(/ne se modifie plus/)).toBeTruthy();
  });

  it("distingue ce qui vit sur l'appareil de ce qui suit le compte", () => {
    // Les trois premiers réglages sont dans le navigateur ; l'e-mail
    // part d'un serveur. Le pied de page ne peut pas dire la même
    // chose des deux.
    afficher();
    expect(
      screen.getByText(/Les trois premiers réglages sont enregistrés sur cet appareil/),
    ).toBeTruthy();
    expect(screen.getByText(/attaché à votre compte et vous suit partout/)).toBeTruthy();
  });
});
