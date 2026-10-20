// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountSection } from "./AccountSection";
import { AvatarsPersonnesContext } from "../../lib/avatarsPersonnes";

/** La photo de profil se règle dans « Mon compte », avec le choix d'avatar de l'application. */

window.matchMedia ??= (q: string) =>
  ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }) as unknown as MediaQueryList;

afterEach(cleanup);

function afficher(modifiable: boolean) {
  const rien = () => {};
  render(
    <AvatarsPersonnesContext.Provider value={{ regles: new Map(), modifiable }}>
      <AccountSection
        fullName="Mamy Rakoto"
        setFullName={rien}
        accountEmail="mamy@example.com"
        setAccountEmail={rien}
        accountPhone=""
        setAccountPhone={rien}
        baseline={{ fullName: "Mamy Rakoto", email: "mamy@example.com", phone: "" }}
        saving={false}
        saved={false}
        onSave={rien}
      />
    </AvatarsPersonnesContext.Provider>,
  );
}

describe("Mon compte — photo de profil", () => {
  it("montre l'avatar tiré du nom enregistré et ouvre le choix d'avatar", async () => {
    afficher(true);
    expect(screen.getByText("Photo de profil")).toBeTruthy();
    expect(document.querySelector(".avatar-personne")?.getAttribute("title")).toBe("Mamy Rakoto");
    fireEvent.click(screen.getByRole("button", { name: "Changer la photo" }));
    const fenetre = await screen.findByRole("dialog");
    expect(fenetre.textContent).toContain("Avatar");
  });

  it("garde l'avatar, sans bouton, quand la boutique ne peut pas l'enregistrer", () => {
    afficher(false);
    expect(document.querySelector(".avatar-personne")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Changer la photo" })).toBeNull();
  });
});
