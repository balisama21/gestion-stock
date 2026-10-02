// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOT_OFFRE } from "../lib/motsOffre";
import { marqueDepuisLigne } from "../lib/marque";

/** Rendu réel des écrans d'un domaine client : aucun mot de l'offre. */

const marqueCliente = marqueDepuisLigne({
  app_name: "Kinvest",
  short_name: null,
  tagline: null,
  page_title: null,
  logo_url: null,
  favicon_url: null,
  splash_logo_url: null,
  login_image_url: null,
  login_title: null,
  login_subtitle: null,
  primary_color: "#1D4ED8",
  primary_color_dark: null,
  splash_background: null,
});

const acces = { marqueId: "m-kinvest", proprietaire: false };

vi.mock("../hooks/useMarque", () => ({ useMarque: () => marqueCliente }));
// Objet stable : un objet neuf à chaque rendu relancerait les effets d'AuthPage.
const auth = {
  user: null,
  profile: { full_name: "Lova" },
  profileError: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  activateWithCode: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};
vi.mock("../hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    createStore: vi.fn(),
    refreshStores: vi.fn(),
    switchStore: vi.fn(),
    accesMarque: acces,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

// jsdom n'a ni matchMedia ni IntersectionObserver.
window.matchMedia ??= (q: string) =>
  ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }) as unknown as MediaQueryList;
window.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

afterEach(cleanup);

const texte = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

describe("domaine client — aucun mot de l'offre à l'écran", () => {
  it("connexion et inscription", async () => {
    const { AuthPage } = await import("./AuthPage");
    render(<AuthPage />);
    expect(texte()).not.toMatch(MOT_OFFRE);
    fireEvent.click(screen.getByRole("button", { name: "S'inscrire" }));
    expect(texte()).toContain("code d'invitation de votre responsable");
    expect(texte()).not.toMatch(MOT_OFFRE);
  });

  it("accueil sans boutique d'un utilisateur non listé : rejoindre seulement", async () => {
    const { CreateStoreOnboarding } = await import("./CreateStoreOnboarding");
    render(<CreateStoreOnboarding />);
    expect(texte()).toContain("code d'invitation");
    expect(texte()).not.toMatch(MOT_OFFRE);
  });

  it("accueil d'un propriétaire listé : créer, sans essai ni gratuité", async () => {
    acces.proprietaire = true;
    const { CreateStoreOnboarding } = await import("./CreateStoreOnboarding");
    render(<CreateStoreOnboarding />);
    expect(texte()).toContain("Créer ma boutique");
    expect(texte()).not.toMatch(/essai|gratuit|abonnement|tarif|paiement/i);
    acces.proprietaire = false;
  });
});
