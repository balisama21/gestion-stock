import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { HeroTableauDeBord } from "./HeroTableauDeBord";
import { HERO_PHOTOS, PLANTES, indexDuJour } from "../assets/images";
import type { ChiffresDuJour, ChiffresStock } from "../lib/chiffres";

const JOUR = {
  jour: "2026-09-28",
  hier: "2026-09-27",
  ventes: 0,
  tickets: 0,
  ventesHier: 0,
  dernierJourVendu: null,
  encaisse: 0,
  encaisseDuMois: 0,
  encaisseParJourDuMois: [],
  sorties: 0,
  achatsDuMois: 0,
  depensesDuMois: 0,
  prochaineEcheance: null,
  entreesStock: 0,
  sortiesStock: 0,
} as unknown as ChiffresDuJour;

const STOCK = {
  valeur: 0,
  aRecommander: [],
  enPrealerte: [],
  enRupture: [],
  etagere: [],
} as unknown as ChiffresStock;

function afficher(instant: string, sombre = false) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
  const rendu = render(
    <HeroTableauDeBord
      prenom="Mamy"
      sombre={sombre}
      chargeA={null}
      onRafraichir={() => {}}
      boutonRafraichir={createRef()}
      tuiles={["ventes", "entrees", "sorties", "stock", "activite"]}
      jour={JOUR}
      stock={STOCK}
      journal={[]}
      valeurStockVisible
      montantsAchatVisibles
      montantsVentesVisibles
      onOuvrir={() => {}}
    />,
  );
  act(() => {});
  const hero = rendu.container.querySelector(".tb-hero") as HTMLElement;
  const fond = rendu.container.querySelector(".tb-hero-bg") as HTMLElement;
  const plantes = [...rendu.container.querySelectorAll(".pf img")].map((i) =>
    i.getAttribute("src"),
  );
  return { hero, fond, plantes };
}

describe("le haut du tableau de bord", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("sept catégories de photos, une par jour, lundi en premier", () => {
    expect(HERO_PHOTOS).toHaveLength(7);
    expect(PLANTES).toHaveLength(7);
    expect(indexDuJour(new Date(2026, 8, 28))).toBe(0); // lundi
    expect(indexDuJour(new Date(2026, 9, 4))).toBe(6); // dimanche
  });

  it("le jour, la photo de jour", () => {
    const { hero, fond } = afficher("2026-09-28T10:00:00");
    expect(hero.classList.contains("night")).toBe(false);
    expect(fond.style.backgroundImage).toContain(HERO_PHOTOS[0].jour);
  });

  it("après 18 h et avant 6 h, la photo de nuit", () => {
    expect(afficher("2026-09-28T18:30:00").hero.classList.contains("night")).toBe(true);
    cleanup();
    const { hero, fond } = afficher("2026-09-29T05:10:00");
    expect(hero.classList.contains("night")).toBe(true);
    expect(fond.style.backgroundImage).toContain(HERO_PHOTOS[1].nuit);
  });

  it("le thème sombre de l'application passe aussi le ciel en nuit", () => {
    expect(afficher("2026-09-28T10:00:00", true).hero.classList.contains("night")).toBe(true);
  });

  it("l'inspiration du moment montre les trois photos de la catégorie du jour", () => {
    const { plantes } = afficher("2026-10-04T10:00:00"); // dimanche
    expect(plantes).toHaveLength(3);
    expect(new Set(plantes)).toEqual(new Set(PLANTES[6]));
  });
});
