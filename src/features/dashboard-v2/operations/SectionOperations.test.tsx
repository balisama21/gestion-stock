import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionOperations } from "./SectionOperations";

/**
 * LES QUATRE FEUILLES
 *
 * Chaque carte est une feuille de la bande, et chacune a son onglet. Sur
 * téléphone, l'onglet de la feuille devant suit le doigt, et un onglet
 * touché amène sa feuille au milieu.
 */
afterEach(cleanup);

const feuilles = ["Agenda", "À faire", "Commandes", "Livraisons"].map((nom, i) => ({
  cle: `f${i}`,
  nom,
  carte: <article className="op-carte">{nom}</article>,
}));

/** Des feuilles de 300 px tous les 320 px, dans une bande de 375 px. */
const mesurer = (bande: HTMLElement) => {
  Object.defineProperty(bande, "clientWidth", { value: 375 });
  Array.from(bande.children).forEach((f, i) => {
    Object.defineProperty(f, "offsetLeft", { value: 16 + i * 320 });
    Object.defineProperty(f, "offsetWidth", { value: 300 });
  });
};

const courant = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "true")
    .map((b) => b.textContent);

describe("SectionOperations", () => {
  it("met chaque carte dans la bande, avec son onglet", () => {
    render(<SectionOperations feuilles={feuilles} />);
    expect(document.querySelectorAll(".op-bande > .op-carte")).toHaveLength(4);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Agenda",
      "À faire",
      "Commandes",
      "Livraisons",
    ]);
    expect(courant()).toEqual(["Agenda"]);
  });

  it("l'onglet suit la feuille amenée au milieu", () => {
    render(<SectionOperations feuilles={feuilles} />);
    const bande = document.querySelector<HTMLElement>(".op-bande")!;
    mesurer(bande);
    bande.scrollLeft = 640;
    fireEvent.scroll(bande);
    expect(courant()).toEqual(["Commandes"]);
  });

  it("un onglet touché centre sa feuille", () => {
    render(<SectionOperations feuilles={feuilles} />);
    const bande = document.querySelector<HTMLElement>(".op-bande")!;
    mesurer(bande);
    const scrollTo = vi.fn();
    bande.scrollTo = scrollTo;
    fireEvent.click(screen.getByRole("button", { name: "Livraisons" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 16 + 3 * 320 - 37.5 }));
  });

  it("une seule carte : pas d'onglets", () => {
    render(<SectionOperations feuilles={feuilles.slice(0, 1)} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
