// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreSettings } from "../types";

/**
 * Le menu du profil : la roue dentée de la barre du haut y est entrée.
 * « Paramètres » garde la règle de l'ancienne roue (permission
 * « settings »), « Mon profil » mène à « Mon compte », et la
 * déconnexion demande confirmation.
 */

// Objets stables : un objet neuf à chaque rendu relancerait les effets.
const auth = {
  user: { id: "u1", email: "mamy@example.com" },
  profile: { full_name: "Mamy Rakoto", email: "mamy@example.com" },
  signOut: vi.fn(),
};
const workspace = {
  isOwner: true,
  memberPermissions: null as string[] | null,
  activeStore: { id: "s1", name: "Boutique" },
  accessibleStores: [],
  accesMarque: { marqueId: null, proprietaire: true },
  refreshStores: vi.fn(),
  switchStore: vi.fn(),
  createStore: vi.fn(),
  copyStore: vi.fn(),
};
vi.mock("../hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../hooks/useWorkspace", () => ({ useWorkspace: () => workspace }));
vi.mock("../hooks/useMarque", () => ({ useMarque: () => ({ nom: "Tantana" }) }));
vi.mock("../hooks/useBarresAuDefilement", () => ({ useBarresAuDefilement: () => false }));
vi.mock("../lib/notificationsLues", () => ({
  useNotificationsLues: () => ({
    etats: new Map(),
    marquerVues: () => {},
    marquerLues: () => {},
  }),
  compterNonVues: () => 0,
  estNonLue: () => false,
}));
vi.mock("../lib/supabase", () => ({ supabase: {} }));

window.matchMedia ??= (q: string) =>
  ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }) as unknown as MediaQueryList;

afterEach(() => {
  cleanup();
  workspace.memberPermissions = null;
  auth.signOut.mockReset();
});

async function afficher(props: { onOuvrirMonCompte?: () => void } = {}) {
  const { Header } = await import("./Header");
  const setActiveTab = vi.fn();
  render(
    <Header
      activeTab="dashboard"
      setActiveTab={setActiveTab}
      settings={{ storeName: "Boutique" } as StoreSettings}
      tresorerie={0}
      seuilAlerte={0}
      onOuvrirIdentiteBoutique={() => {}}
      notifications={[]}
      theme="light"
      setTheme={() => {}}
      sidebarCollapsed={false}
      onToggleSidebar={() => {}}
      {...props}
    />,
  );
  return { setActiveTab };
}

describe("barre du haut — menu du profil", () => {
  it("n'a plus de roue dentée : les Paramètres sont dans le menu de l'avatar", async () => {
    const { setActiveTab } = await afficher();
    expect(screen.queryByRole("button", { name: "Paramètres" })).toBeNull();
    const avatar = screen.getByRole("button", { name: "Menu du profil" });
    expect(avatar.textContent).toContain("MR");

    fireEvent.click(avatar);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Paramètres" }));
    expect(setActiveTab).toHaveBeenCalledWith("settings");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("cache « Paramètres » sans la permission, garde « Mon profil »", async () => {
    workspace.memberPermissions = ["ventes"];
    const onOuvrirMonCompte = vi.fn();
    await afficher({ onOuvrirMonCompte });
    fireEvent.click(screen.getByRole("button", { name: "Menu du profil" }));
    expect(screen.queryByRole("menuitem", { name: "Paramètres" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Mon profil" }));
    expect(onOuvrirMonCompte).toHaveBeenCalledTimes(1);
  });

  it("se referme sur Échap", async () => {
    await afficher();
    fireEvent.click(screen.getByRole("button", { name: "Menu du profil" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ne déconnecte qu'après confirmation", async () => {
    await afficher();
    fireEvent.click(screen.getByRole("button", { name: "Menu du profil" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    expect(auth.signOut).not.toHaveBeenCalled();
    const confirmer = await screen.findByRole("button", { name: "Se déconnecter" });
    fireEvent.click(confirmer);
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  });
});
