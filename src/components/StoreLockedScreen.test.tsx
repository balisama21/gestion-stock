import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StoreLockedScreen, type BoutiqueJoignable } from "./StoreLockedScreen";

const seDeconnecter = vi.fn(() => Promise.resolve());

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ signOut: seDeconnecter }) }));
vi.mock("../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const AUTRES: BoutiqueJoignable[] = [
  { id: "id-ma-boutique", nom: "Ma Boutique", verrouillee: false },
  { id: "id-balsama-dg", nom: "Balsama DG", verrouillee: false },
  { id: "id-fermee", nom: "Boutique fermée", verrouillee: true },
];

function afficher(surcharge: Partial<React.ComponentProps<typeof StoreLockedScreen>> = {}) {
  const props = {
    storeName: "Boutique de Mamy",
    storeId: "id-boutique-de-mamy",
    onActivated: vi.fn(),
    autresBoutiques: AUTRES,
    onChangerDeBoutique: vi.fn(),
    onOuvrirLeCompte: vi.fn(),
    ...surcharge,
  };
  render(<StoreLockedScreen {...props} />);
  return props;
}

describe("l'écran d'une boutique verrouillée n'est pas une impasse", () => {
  beforeEach(() => seDeconnecter.mockClear());
  afterEach(cleanup);

  it("nomme la boutique concernée", () => {
    afficher();
    expect(screen.getByText("Boutique de Mamy")).toBeTruthy();
  });

  it("propose les autres boutiques du compte, avec leur état", () => {
    afficher();
    expect(screen.getByText("Ma Boutique")).toBeTruthy();
    expect(screen.getByText("Balsama DG")).toBeTruthy();
    expect(screen.getByText("Boutique fermée")).toBeTruthy();
    // Deux ouvertes, une fermée : l'état se lit sans cliquer.
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getAllByText("Verrouillée")).toHaveLength(1);
  });

  it("change de boutique au clic, en passant le bon identifiant", () => {
    const props = afficher();
    fireEvent.click(screen.getByText("Ma Boutique"));
    expect(props.onChangerDeBoutique).toHaveBeenCalledWith("id-ma-boutique");
  });

  it("laisse rejoindre une autre boutique verrouillée si on le veut", () => {
    // On ne l'empêche pas : c'est peut-être celle qu'on vient régler.
    const props = afficher();
    fireEvent.click(screen.getByText("Boutique fermée"));
    expect(props.onChangerDeBoutique).toHaveBeenCalledWith("id-fermee");
  });

  it("garde l'accès au compte — profil, e-mail, support", () => {
    const props = afficher();
    fireEvent.click(screen.getByText("Mon compte"));
    expect(props.onOuvrirLeCompte).toHaveBeenCalled();
  });

  it("se déconnecte, et le montre pendant que ça travaille", async () => {
    let relacher: () => void = () => {};
    seDeconnecter.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          relacher = r;
        }),
    );
    afficher();

    fireEvent.click(screen.getByText("Me déconnecter"));
    expect(seDeconnecter).toHaveBeenCalled();
    // Sans ce témoin, un appel lent passerait pour un clic sans effet —
    // c'était précisément la plainte.
    expect(screen.getByText("Déconnexion…")).toBeTruthy();

    await act(async () => {
      relacher();
    });
    expect(screen.getByText("Me déconnecter")).toBeTruthy();
  });

  it("n'affiche pas de sélecteur quand il n'y a qu'une boutique", () => {
    afficher({ autresBoutiques: [] });
    expect(screen.queryByText("Changer de boutique")).toBeNull();
    // Les sorties par le compte, elles, restent là.
    expect(screen.getByText("Mon compte")).toBeTruthy();
    expect(screen.getByText("Me déconnecter")).toBeTruthy();
  });
});
