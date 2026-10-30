import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DUREE_TOUR, SectionOperations } from "./SectionOperations";

/**
 * LE BLOC-NOTES
 *
 * Chaque carte est une page du bloc, et chacune a son onglet. Dans un
 * même double, on glisse d'une page à l'autre ; d'un double à l'autre, on
 * tourne la page, le temps du tour, avant d'ouvrir le nouveau double.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const feuilles = ["Agenda", "À faire", "Commandes", "Livraisons"].map((nom, i) => ({
  cle: `f${i}`,
  nom,
  carte: <article className="op-carte">{nom}</article>,
}));

const bande = () => document.querySelector<HTMLElement>(".op-bande")!;
const camera = () => document.querySelector<HTMLElement>(".op-camera")!;
const courant = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "true")
    .map((b) => b.textContent);

describe("SectionOperations", () => {
  it("met chaque carte dans le bloc, avec son onglet, le premier double ouvert", () => {
    render(<SectionOperations feuilles={feuilles} />);
    expect(document.querySelectorAll(".op-bande > .op-carte")).toHaveLength(4);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Agenda",
      "À faire",
      "Commandes",
      "Livraisons",
    ]);
    expect(courant()).toEqual(["Agenda"]);
    expect(bande().dataset.double).toBe("0");
    expect(camera().dataset.cote).toBe("gauche");
  });

  it("dans un même double, la vue glisse sans tourner la page", () => {
    render(<SectionOperations feuilles={feuilles} />);
    fireEvent.click(screen.getByRole("button", { name: "À faire" }));
    expect(courant()).toEqual(["À faire"]);
    expect(camera().dataset.cote).toBe("droite");
    expect(bande().dataset.sens).toBeUndefined();
    expect(bande().dataset.double).toBe("0");
  });

  it("vers le double suivant, la page tourne, puis le nouveau double s'ouvre", () => {
    render(<SectionOperations feuilles={feuilles} />);
    fireEvent.click(screen.getByRole("button", { name: "Commandes" }));
    expect(courant()).toEqual(["Commandes"]);
    expect(bande().dataset.sens).toBe("avant");
    expect(bande().dataset.double).toBeUndefined();

    // Pendant le tour, un autre onglet n'interrompt pas la page.
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(courant()).toEqual(["Commandes"]);

    act(() => {
      vi.advanceTimersByTime(DUREE_TOUR);
    });
    expect(bande().dataset.sens).toBeUndefined();
    expect(bande().dataset.double).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "À faire" }));
    expect(bande().dataset.sens).toBe("arriere");
  });

  it("un glissement du doigt vers la gauche passe à la page suivante", () => {
    render(<SectionOperations feuilles={feuilles} />);
    const cadre = document.querySelector<HTMLElement>(".op-cadre")!;
    fireEvent.pointerDown(cadre, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(cadre, { clientX: 200, clientY: 110 });
    expect(courant()).toEqual(["À faire"]);
    // Un geste surtout vertical laisse la page défiler.
    fireEvent.pointerDown(cadre, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(cadre, { clientX: 250, clientY: 300 });
    expect(courant()).toEqual(["À faire"]);
  });

  it("une seule carte : pas d'onglets", () => {
    render(<SectionOperations feuilles={feuilles.slice(0, 1)} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
