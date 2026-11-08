import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InstallPrompt } from "./InstallPrompt";

vi.mock("../../hooks/useMarque", () => ({
  useMarque: () => ({ parDefaut: true, nom: "Tantana" }),
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each(["Android", "iPhone"])("simplifie la bannière sur %s", async (agent) => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent);
  render(<InstallPrompt />);
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole("dialog").textContent).toContain(
    agent === "Android" ? "Télécharger l’APK Android" : "Sur l'écran d'accueil",
  );
  expect(screen.queryByText("Continuer sur le web")).toBeNull();
  expect(screen.queryByText("J’ai déjà installé l’application")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ne plus proposer pour l'instant" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("propose la version PC même sans événement d’installation et respecte la fermeture", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  localStorage.setItem("balsama-installation-refusee", String(Date.now()));
  const vue = render(<InstallPrompt />);
  await act(() => vi.advanceTimersByTimeAsync(3000));
  fireEvent.click(screen.getByRole("button", { name: "Télécharger l’application" }));
  expect(screen.getByRole("status").textContent).toMatch(/installer cette page/);
  fireEvent.click(screen.getByRole("button", { name: "Continuer sur le web" }));
  vue.unmount();
  render(<InstallPrompt />);
  await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(screen.queryByRole("dialog")).toBeNull();
});
