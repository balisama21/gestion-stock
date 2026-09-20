import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBarresAuDefilement } from "./useBarresAuDefilement";

/**
 * jsdom ne mesure rien : ni la hauteur du document, ni celle de
 * l'écran, et il ne connaît pas `ResizeObserver`. On les fournit, ce
 * qui a l'avantage de rendre chaque situation explicite — « page de
 * trois mille pixels », « page qui tient à l'écran ».
 */
let hauteurDuDocument = 3000;
let positionY = 0;
const observateurs: (() => void)[] = [];

class ResizeObserverFactice {
  constructor(rappel: () => void) {
    observateurs.push(rappel);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Le contenu a changé de hauteur sans qu'on ait défilé. */
const leContenuChangeDeHauteur = (hauteur: number) =>
  act(() => {
    hauteurDuDocument = hauteur;
    for (const o of observateurs) o();
  });

/** Un vrai geste de défilement, rendu synchrone. */
const defilerJusqua = (y: number) =>
  act(() => {
    positionY = y;
    window.dispatchEvent(new Event("scroll"));
  });

beforeEach(() => {
  hauteurDuDocument = 3000;
  positionY = 0;
  observateurs.length = 0;
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => hauteurDuDocument,
  });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => positionY });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  vi.stubGlobal("ResizeObserver", ResizeObserverFactice);
  // La frame d'animation s'exécute tout de suite : le test n'attend pas.
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => {
    f(0);
    return 0;
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("les barres s'effacent au défilement", () => {
  it("restent visibles tant qu'on n'a pas bougé", () => {
    const { result } = renderHook(() => useBarresAuDefilement(true, "produits"));
    expect(result.current).toBe(false);
  });

  it("s'effacent quand on descend franchement", () => {
    const { result } = renderHook(() => useBarresAuDefilement(true, "produits"));
    defilerJusqua(400);
    expect(result.current).toBe(true);
  });

  it("reviennent dès qu'on remonte", () => {
    const { result } = renderHook(() => useBarresAuDefilement(true, "produits"));
    defilerJusqua(400);
    defilerJusqua(380);
    expect(result.current).toBe(false);
  });
});

describe("une page où l'on ne peut pas défiler garde sa navigation", () => {
  it("ne masque jamais rien sur une page qui tient à l'écran", () => {
    hauteurDuDocument = 820; // 20 pixels de plus que l'écran
    const { result } = renderHook(() => useBarresAuDefilement(true, "prestataires"));
    defilerJusqua(20);
    expect(result.current).toBe(false);
  });

  it("LE BUG : on arrive sur une page courte, la navigation revient", () => {
    // Page longue, on descend, les barres s'effacent…
    const { result, rerender } = renderHook(({ onglet }) => useBarresAuDefilement(true, onglet), {
      initialProps: { onglet: "produits" },
    });
    defilerJusqua(400);
    expect(result.current).toBe(true);

    // …puis on ouvre « Prestataires », qui tient dans l'écran. Sans la
    // clé, l'état restait masqué et plus rien ne pouvait le défaire :
    // il n'y avait même pas de quoi remonter.
    hauteurDuDocument = 820;
    rerender({ onglet: "prestataires" });
    expect(result.current).toBe(false);
  });

  it("un filtre qui vide la liste rappelle les barres, sans défilement", () => {
    const { result } = renderHook(() => useBarresAuDefilement(true, "clients"));
    defilerJusqua(400);
    expect(result.current).toBe(true);

    leContenuChangeDeHauteur(820);
    expect(result.current).toBe(false);
  });

  it("garde ses barres même quand la page fait exactement l'écran", () => {
    // Cas limite : `course` vaut zéro, et `y >= course` est vrai. La
    // règle des pages courtes doit trancher avant cette garde.
    hauteurDuDocument = 800;
    const { result } = renderHook(() => useBarresAuDefilement(true, "prestataires"));
    defilerJusqua(0);
    expect(result.current).toBe(false);
  });
});

describe("un panneau ouvert rend la navigation", () => {
  it("montre les barres tant qu'un menu est déplié", () => {
    const { result, rerender } = renderHook(({ actif }) => useBarresAuDefilement(actif, "ventes"), {
      initialProps: { actif: true },
    });
    defilerJusqua(400);
    expect(result.current).toBe(true);

    rerender({ actif: false });
    expect(result.current).toBe(false);
  });
});
