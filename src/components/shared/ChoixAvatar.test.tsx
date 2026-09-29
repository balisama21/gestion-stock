import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AvatarModifiable } from "./ChoixAvatar";
import { AvatarPersonne } from "./AvatarPersonne";
import { AvatarsPersonnesContext, type AvatarsPersonnes } from "../../lib/avatarsPersonnes";
import { traitsDe } from "../../lib/avatarPersonne";

afterEach(cleanup);

function avec(valeur: Partial<AvatarsPersonnes>, enfant: React.ReactNode) {
  return render(
    <AvatarsPersonnesContext.Provider value={{ regles: new Map(), modifiable: true, ...valeur }}>
      {enfant}
    </AvatarsPersonnesContext.Provider>,
  );
}

describe("l'avatar réglé à la main", () => {
  it("montre la photo enregistrée pour ce nom, quelle que soit la casse", () => {
    const regles = new Map([
      ["lova nirina", { traits: null, photoChemin: "s/p/a.webp", photoUrl: "https://x/a.webp" }],
    ]);
    const { container } = avec({ regles }, <AvatarPersonne nom="Lova Nirina" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://x/a.webp");
  });

  it("retombe sur le dessin quand la photo ne se charge pas", () => {
    const regles = new Map([
      ["hery", { traits: null, photoChemin: "s/p/b.webp", photoUrl: "https://x/b.webp" }],
    ]);
    const { container } = avec({ regles }, <AvatarPersonne nom="Hery" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("ignore un trait enregistré inconnu au lieu de casser le visage", () => {
    const regles = new Map([
      [
        "mamy",
        { traits: { coiffure: "iroquois", lunettes: true }, photoChemin: null, photoUrl: null },
      ],
    ]);
    const { container } = avec({ regles }, <AvatarPersonne nom="Mamy" />);
    expect(container.querySelector("svg")).toBeTruthy();
    // Les lunettes, elles, sont bien prises.
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(1);
  });
});

describe("choisir le visage", () => {
  it("enregistre la coiffure choisie, en gardant le reste du visage", async () => {
    const enregistrerVisage = vi.fn().mockResolvedValue({ error: null });
    avec({ enregistrerVisage }, <AvatarModifiable nom="Lanto" />);
    fireEvent.click(screen.getByLabelText("Changer l'avatar de Lanto"));
    fireEvent.click(screen.getByRole("button", { name: /Chignon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerVisage).toHaveBeenCalledTimes(1));
    const [nom, traits] = enregistrerVisage.mock.calls[0];
    expect(nom).toBe("Lanto");
    expect(traits).toEqual({ ...traitsDe("Lanto"), coiffure: "chignon" });
  });

  it("n'offre rien à modifier tant que la boutique ne peut pas l'enregistrer", () => {
    avec({ modifiable: false }, <AvatarModifiable nom="Lanto" />);
    expect(screen.queryByLabelText("Changer l'avatar de Lanto")).toBeNull();
  });
});
