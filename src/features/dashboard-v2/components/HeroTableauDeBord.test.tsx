import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { HeroTableauDeBord } from "./HeroTableauDeBord";
import {
  HERO_PAYSAGES_JOUR,
  HERO_PAYSAGES_SOIR,
  HERO_PHOTOS,
  PHOTOS_PLANTES,
  indexDuJour,
  paysagesDuMoment,
  plantesDuJour,
} from "../assets/images";
import type { ChiffresDuJour, ChiffresStock } from "../lib/chiffres";

// Les photos importées vivent dans Supabase : ici, celles du dossier.
vi.mock("../lib/photosInspiration", async () => {
  const { PHOTOS_PLANTES: photos } =
    await vi.importActual<typeof import("../assets/images")>("../assets/images");
  return { usePhotosInspiration: () => photos };
});

// Les photos importées vivent dans Supabase : ici, aucune.
vi.mock("../lib/photosHautDePage", () => ({
  usePhotosHautDePage: () => ({ jour: [], soir: [] }),
}));

// Les phrases ajoutées vivent dans Supabase : ici, aucune.
vi.mock("../lib/phrasesTableau", async () => {
  const { REGLAGES_PAR_DEFAUT } =
    await vi.importActual<typeof import("../lib/phrases")>("../lib/phrases");
  return {
    usePhrasesAjoutees: () => ({ ajoutees: { jour: [], soir: [] }, reglages: REGLAGES_PAR_DEFAUT }),
  };
});

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
  const plantes = [...rendu.container.querySelectorAll("#inspiration img, .pf img")].map((i) =>
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

  it("le thème sombre ne met pas la nuit en plein jour : les photos suivent l'heure", () => {
    expect(afficher("2026-09-28T10:00:00", true).hero.classList.contains("night")).toBe(false);
  });

  it("un mois de photos : une photo de tête nouvelle chaque jour, puis la boucle", () => {
    for (const [serie, heure] of [
      [HERO_PAYSAGES_JOUR, 10],
      [HERO_PAYSAGES_SOIR, 20],
    ] as const) {
      expect(serie.length).toBeGreaterThanOrEqual(30);
      expect(new Set(serie.map((p) => p.id)).size).toBe(serie.length);
      const jours = Array.from({ length: serie.length }, (_, j) =>
        paysagesDuMoment(new Date(2026, 9, 11 + j, heure)),
      );
      // Une photo de tête différente chaque jour du mois.
      expect(new Set(jours.map((l) => l[0].id)).size).toBe(serie.length);
      // Deux jours qui se suivent ne partagent aucune photo.
      for (let j = 1; j < jours.length; j++) {
        const hier = new Set(jours[j - 1].map((p) => p.id));
        expect(jours[j].some((p) => hier.has(p.id))).toBe(false);
      }
      // Le mois passé, la boucle recommence.
      expect(paysagesDuMoment(new Date(2026, 9, 11 + serie.length, heure))).toEqual(jours[0]);
    }
  });

  it("les photos importées prennent la suite de la boucle", () => {
    const importee = { id: "importee", cadrage: "50% 50%", url: "https://exemple/photo.webp" };
    const vues = new Set<string>();
    for (let j = 0; j < 40; j++)
      paysagesDuMoment(new Date(2026, 9, 11 + j, 10), { jour: [importee], soir: [] }).forEach((p) =>
        vues.add(p.id),
      );
    expect(vues.has("importee")).toBe(true);
  });

  it("de vraies photos du soir le soir, de jour le jour, et d'autres demain", () => {
    const soir = paysagesDuMoment(new Date(2026, 9, 11, 20, 0));
    const jour = paysagesDuMoment(new Date(2026, 9, 11, 10, 0));
    expect(soir).toHaveLength(5);
    expect(jour).toHaveLength(5);
    expect(soir.every((p) => HERO_PAYSAGES_SOIR.includes(p))).toBe(true);
    expect(jour.every((p) => HERO_PAYSAGES_JOUR.includes(p))).toBe(true);
    expect(new Set(soir.map((p) => p.id)).size).toBe(5);
    // Avant 6 h, c'est encore la nuit de la veille.
    expect(paysagesDuMoment(new Date(2026, 9, 12, 3, 0))).toEqual(soir);
    // Le lendemain, une autre combinaison.
    expect(paysagesDuMoment(new Date(2026, 9, 12, 20, 0))).not.toEqual(soir);
    expect(paysagesDuMoment(new Date(2026, 9, 12, 10, 0))).not.toEqual(jour);
  });

  it("l'inspiration du moment n'est plus dans le haut de page : elle a sa section", () => {
    const { plantes } = afficher("2026-10-04T10:00:00");
    expect(plantes).toHaveLength(0);
  });

  it("chaque jour prend les trois photos suivantes du dossier", () => {
    const dossier = ["a", "b", "c", "d", "e", "f", "g"];
    const lundi = plantesDuJour(new Date(2026, 8, 28), dossier);
    const mardi = plantesDuJour(new Date(2026, 8, 29), dossier);
    expect(new Set(lundi).size).toBe(3);
    expect(lundi.filter((p) => mardi.includes(p))).toEqual([]);
    // Le même jour donne toujours le même trio.
    expect(plantesDuJour(new Date(2026, 8, 29, 23, 0), dossier)).toEqual(mardi);
  });
});
