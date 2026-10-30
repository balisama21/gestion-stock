import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DUREE_TOUR, SectionOperations } from "./SectionOperations";

/**
 * LE BLOC-NOTES
 *
 * Chaque carte est une page du bloc. On tourne la page par son coin :
 * sur ordinateur, d'un double à l'autre ; sur téléphone, d'une page à
 * l'autre, la page ne tournant qu'au passage d'un double au suivant.
 */
const matchMedia = window.matchMedia;
const telephone = (oui: boolean) => {
  window.matchMedia = ((q: string) => ({
    matches: oui && q.includes("max-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.useFakeTimers();
  telephone(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = matchMedia;
});

const feuilles = ["Agenda", "À faire", "Commandes", "Livraisons"].map((nom, i) => ({
  cle: `f${i}`,
  nom,
  carte: <article className="op-carte">{nom}</article>,
}));

const bande = () => document.querySelector<HTMLElement>(".op-bande")!;
const camera = () => document.querySelector<HTMLElement>(".op-camera")!;
const coins = () => screen.queryAllByRole("button").map((b) => b.getAttribute("aria-label"));
const finDuTour = () =>
  act(() => {
    vi.advanceTimersByTime(DUREE_TOUR);
  });

describe("SectionOperations, sur ordinateur", () => {
  it("ouvre le premier double, avec le coin pour tourner la page", () => {
    render(<SectionOperations feuilles={feuilles} />);
    expect(document.querySelectorAll(".op-bande > .op-carte")).toHaveLength(4);
    expect(bande().dataset.double).toBe("0");
    expect(coins()).toEqual(["Tourner la page : Commandes et Livraisons"]);
    // Plus d'onglets sous le bloc.
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("le coin tourne la page, puis le coin d'en face la ramène", () => {
    render(<SectionOperations feuilles={feuilles} />);
    fireEvent.click(screen.getByRole("button", { name: /Tourner la page/ }));
    expect(bande().dataset.sens).toBe("avant");
    expect(bande().dataset.double).toBeUndefined();
    expect(camera().dataset.tourne).toBe("");

    finDuTour();
    expect(bande().dataset.sens).toBeUndefined();
    expect(bande().dataset.double).toBe("1");
    expect(coins()).toEqual(["Revenir à la page : Agenda et À faire"]);

    fireEvent.click(screen.getByRole("button", { name: /Revenir/ }));
    expect(bande().dataset.sens).toBe("arriere");
    finDuTour();
    expect(bande().dataset.double).toBe("0");
  });

  it("un glissement vers la gauche tourne la page ; un geste vertical, non", () => {
    render(<SectionOperations feuilles={feuilles} />);
    const cadre = document.querySelector<HTMLElement>(".op-cadre")!;
    fireEvent.pointerDown(cadre, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(cadre, { clientX: 250, clientY: 300 });
    expect(bande().dataset.sens).toBeUndefined();
    fireEvent.pointerDown(cadre, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(cadre, { clientX: 200, clientY: 110 });
    expect(bande().dataset.sens).toBe("avant");
  });
});

describe("SectionOperations, sur téléphone", () => {
  it("le coin mène à la page voisine : on glisse dans le double, on tourne au suivant", () => {
    telephone(true);
    render(<SectionOperations feuilles={feuilles} />);
    expect(coins()).toEqual(["Tourner la page : À faire"]);

    fireEvent.click(screen.getByRole("button", { name: "Tourner la page : À faire" }));
    expect(camera().dataset.cote).toBe("droite");
    expect(bande().dataset.sens).toBeUndefined();
    expect(coins()).toEqual(["Revenir à la page : Agenda", "Tourner la page : Commandes"]);

    fireEvent.click(screen.getByRole("button", { name: "Tourner la page : Commandes" }));
    expect(bande().dataset.sens).toBe("avant");
    finDuTour();
    expect(camera().dataset.cote).toBe("gauche");
    expect(bande().dataset.double).toBe("1");
  });

  it("une seule carte : aucun coin à tourner", () => {
    telephone(true);
    render(<SectionOperations feuilles={feuilles.slice(0, 1)} />);
    expect(coins()).toEqual([]);
  });
});
