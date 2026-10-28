import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Banniere, DELAI_SCENE } from "./Tn";

/**
 * UNE BANNIÈRE À SCÈNE DÉTOURÉE
 *
 * Avec une scène, la bannière pose l'image détourée à côté du titre :
 * ni photo plein cadre, ni voile.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const SCENE = {
  src: "/illustrations/ventes.webp",
  alt: "Au comptoir.",
  largeur: 1100,
  hauteur: 778,
};

describe("Banniere", () => {
  it("pose la scène détourée à la place de la photo", () => {
    render(
      <Banniere
        id="ventes-titre"
        image="/repli.webp"
        photo={{ id: "123", cadrage: "50% 50%" }}
        scene={SCENE}
        titre="Ventes"
      />,
    );
    expect(screen.getByRole("heading", { name: "Ventes" }).id).toBe("ventes-titre");
    expect(screen.getByRole("img", { name: "Au comptoir." }).getAttribute("src")).toBe(SCENE.src);
    expect(document.querySelector(".bn-photo")).toBeNull();
    expect(document.querySelector(".banner.full")).toBeNull();
  });

  it("sans scène, garde la photo plein cadre", () => {
    render(
      <Banniere
        id="argent-titre"
        image="/repli.webp"
        photo={{ id: "123", cadrage: "50% 50%" }}
        titre="L'argent"
      />,
    );
    expect(document.querySelector(".banner.full.photo .bn-photo")).not.toBeNull();
  });

  it("plusieurs scènes se relaient, une seule visible à la fois", () => {
    vi.useFakeTimers();
    render(
      <Banniere
        id="argent-titre"
        image="/repli.webp"
        scene={[SCENE, { ...SCENE, src: "/illustrations/argent.webp", alt: "La caisse." }]}
        titre="L'argent"
      />,
    );
    const visible = () => screen.getByRole("img").getAttribute("src");
    expect(document.querySelectorAll(".bn-scenes .bn-scene")).toHaveLength(2);
    expect(visible()).toBe(SCENE.src);
    act(() => vi.advanceTimersByTime(DELAI_SCENE));
    expect(visible()).toBe("/illustrations/argent.webp");
    act(() => vi.advanceTimersByTime(DELAI_SCENE));
    expect(visible()).toBe(SCENE.src);
  });

  it("sans animation demandée, la première scène reste", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    render(
      <Banniere
        id="argent-titre"
        image="/repli.webp"
        scene={[SCENE, { ...SCENE, src: "/illustrations/argent.webp", alt: "La caisse." }]}
        titre="L'argent"
      />,
    );
    act(() => vi.advanceTimersByTime(DELAI_SCENE * 3));
    expect(screen.getByRole("img").getAttribute("src")).toBe(SCENE.src);
  });
});
