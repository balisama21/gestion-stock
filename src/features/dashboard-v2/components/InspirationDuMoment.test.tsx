import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InspirationDuMoment } from "./InspirationDuMoment";
import { PHOTOS_PLANTES, plantesDuJour } from "../assets/images";

// Les photos importées vivent dans Supabase : ici, celles du dossier.
vi.mock("../lib/photosInspiration", async () => {
  const { PHOTOS_PLANTES: photos } =
    await vi.importActual<typeof import("../assets/images")>("../assets/images");
  return { usePhotosInspiration: () => photos };
});

afterEach(cleanup);

/**
 * L'INSPIRATION DU MOMENT, EN SECTION
 *
 * Posée sur la page comme les autres sections : un titre, et les trois
 * photos du jour en tirages, celle du centre au premier plan.
 */
describe("l'inspiration du moment", () => {
  const jour = new Date(2026, 9, 4, 10, 0);

  it("est une section titrée, avec les trois photos du jour", () => {
    const { container } = render(<InspirationDuMoment maintenant={jour} />);
    expect(screen.getByRole("heading", { name: "Inspiration du moment" })).toBeTruthy();
    const photos = [...container.querySelectorAll(".tirage img")].map((i) => i.getAttribute("src"));
    expect(photos).toHaveLength(3);
    expect(new Set(photos)).toEqual(new Set(plantesDuJour(jour)));
    expect(PHOTOS_PLANTES.length).toBeGreaterThanOrEqual(3);
  });

  it("un clic sur un tirage le met au premier plan", () => {
    const { container } = render(<InspirationDuMoment maintenant={jour} />);
    const tirages = [...container.querySelectorAll<HTMLButtonElement>(".tirage")];
    expect(tirages[0].classList.contains("centre")).toBe(true);
    fireEvent.click(tirages[2]);
    expect(tirages[2].classList.contains("centre")).toBe(true);
    expect(tirages[0].classList.contains("centre")).toBe(false);
  });

  it("« Voir toutes les photos » ouvre la galerie", () => {
    render(<InspirationDuMoment maintenant={jour} />);
    fireEvent.click(screen.getByRole("button", { name: /Voir toutes les photos/ }));
    expect(screen.getAllByText("Aujourd'hui").length).toBeGreaterThanOrEqual(1);
  });
});
