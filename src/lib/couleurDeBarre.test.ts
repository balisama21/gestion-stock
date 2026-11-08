import { afterEach, expect, it, vi } from "vitest";
import { accorderLaBarreDEtat } from "./couleurDeBarre";

afterEach(() => {
  document.head.replaceChildren();
  document.documentElement.removeAttribute("style");
  vi.unstubAllGlobals();
});

it("transmet à Android la couleur de l’en-tête et ses changements", async () => {
  vi.stubGlobal("matchMedia", () => new EventTarget());
  const racine = document.documentElement;
  racine.style.setProperty("--fond-barre-etat", "#f7f8f5");
  const arreter = accorderLaBarreDEtat();
  try {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    expect(meta?.content).toBe("#f7f8f5");
    racine.style.setProperty("--fond-barre-etat", "#121418");
    await Promise.resolve();
    expect(meta?.content).toBe("#121418");
  } finally {
    arreter();
  }
});
