import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { joursDuMois } from "../lib/agenda";
import { PhotoAgenda, PhotoTaches } from "./PhotosOperations";

/**
 * LES PHOTOS DISENT LE VRAI
 *
 * Le calendrier de la photo écrit le mois affiché, jour par jour, sur
 * autant de semaines qu'il en faut ; le bloc-notes coche ce qui est fait.
 */
afterEach(cleanup);

const lignesGrille = () => document.querySelectorAll(".op-photo polyline").length;
const textes = () => [...document.querySelectorAll(".op-photo text")].map((t) => t.textContent);

describe("PhotoAgenda", () => {
  it("octobre 2026 tient en cinq semaines, aujourd'hui cerclé", () => {
    render(
      <PhotoAgenda
        titreMois="Octobre 2026"
        jours={joursDuMois(2026, 9)}
        aujourdhui="2026-10-28"
        charges={new Set(["2026-10-15", "2026-10-28"])}
      />,
    );
    const t = textes();
    expect(t).toContain("Octobre 2026");
    expect(t).toContain("31");
    expect(t).not.toContain("32");
    // 8 traits de colonnes, 6 traits de lignes.
    expect(lignesGrille()).toBe(8 + 6);
    expect(document.querySelectorAll(".op-aujourdhui")).toHaveLength(1);
    // Le 28, déjà cerclé, n'est pas pointé en plus.
    expect(document.querySelectorAll(".op-charge")).toHaveLength(1);
  });

  it("novembre 2026 commence un dimanche : six semaines", () => {
    render(
      <PhotoAgenda
        titreMois="Novembre 2026"
        jours={joursDuMois(2026, 10)}
        aujourdhui="2026-10-28"
        charges={new Set()}
      />,
    );
    expect(textes()).toContain("30");
    expect(lignesGrille()).toBe(8 + 7);
    // Aujourd'hui n'est pas dans ce mois : rien n'est cerclé.
    expect(document.querySelectorAll(".op-aujourdhui")).toHaveLength(0);
  });
});

describe("PhotoTaches", () => {
  it("coche les tâches faites, et la case du titre quand tout est fait", () => {
    render(
      <PhotoTaches
        lignes={[
          { texte: "Payer le loyer", fait: false },
          { texte: "Ranger", fait: true },
        ]}
      />,
    );
    expect(textes()).toEqual(["Payer le loyer", "Ranger"]);
    expect(document.querySelectorAll(".op-case.cochee")).toHaveLength(1);
    cleanup();
    render(<PhotoTaches lignes={[{ texte: "Ranger", fait: true }]} />);
    // La tâche et le titre.
    expect(document.querySelectorAll(".op-case.cochee")).toHaveLength(2);
  });
});
