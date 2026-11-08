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
  vi.useRealTimers();
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
