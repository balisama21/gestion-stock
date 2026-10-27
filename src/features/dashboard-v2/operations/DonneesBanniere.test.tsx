import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DonneesBanniere } from "./DonneesBanniere";

/**
 * L'IMAGE DE LA BANNIÈRE DIT LE VRAI
 *
 * La date, le mois, les jours, les commandes en attente et les tâches
 * écrits sur l'image sont ceux de la boutique, pas ceux de la maquette.
 */
afterEach(cleanup);

const JOUR = new Date(2026, 9, 27); // mardi 27 octobre 2026
const RIEN = { recues: 0, enPreparation: 0, enLivraison: 0, aEncaisser: 0 };

const textes = () => [...document.querySelectorAll(".op-donnees text")].map((t) => t.textContent);

describe("DonneesBanniere", () => {
  it("écrit la vraie date et le vrai mois, jour par jour", () => {
    render(<DonneesBanniere jour={JOUR} joursCharges={new Set()} commandes={RIEN} taches={[]} />);
    const t = textes();
    expect(t).toContain("Mardi 27 octobre 2026");
    expect(t).toContain("Octobre 2026");
    expect(t).toContain("31");
    expect(t).not.toContain("32");
  });

  it("cercle aujourd'hui et pointe les jours chargés", () => {
    render(
      <DonneesBanniere
        jour={JOUR}
        joursCharges={new Set(["2026-10-15", "2026-10-30"])}
        commandes={RIEN}
        taches={[]}
      />,
    );
    // Le cercle du jour, plus un point par jour chargé.
    const ronds = document.querySelectorAll(".op-donnees g[clip-path] circle");
    expect(ronds).toHaveLength(3);
  });

  it("le nombre en attente remplace la coche, seulement s'il y en a", () => {
    render(
      <DonneesBanniere
        jour={JOUR}
        joursCharges={new Set()}
        commandes={{ recues: 2, enPreparation: 0, enLivraison: 0, aEncaisser: 140 }}
        taches={[]}
      />,
    );
    const t = textes();
    expect(t).toContain("2");
    expect(t).toContain("99+");
    // Deux étapes allumées (une coche blanche chacune), plus la coche du
    // presse-papiers « Tout est à jour ».
    expect(document.querySelectorAll('.op-donnees path[stroke="#fff"]')).toHaveLength(2 + 1);
  });

  it("le presse-papiers lit les tâches, la plus urgente d'abord", () => {
    render(
      <DonneesBanniere
        jour={JOUR}
        joursCharges={new Set()}
        commandes={RIEN}
        taches={[
          { id: "1", titre: "Inventaire", statut: "a_faire", echeance: "2026-10-30" },
          { id: "2", titre: "Payer le loyer", statut: "a_faire", echeance: "2026-10-26" },
          {
            id: "3",
            titre: "Ranger",
            statut: "termine",
            echeance: null,
            termine_le: new Date(2026, 9, 27, 10).toISOString(),
          },
          {
            id: "4",
            titre: "Vieille tâche",
            statut: "termine",
            echeance: null,
            termine_le: new Date(2026, 9, 20, 10).toISOString(),
          },
        ]}
      />,
    );
    const t = textes();
    expect(t.indexOf("Payer le loyer")).toBeLessThan(t.indexOf("Inventaire"));
    expect(t).toContain("Ranger");
    expect(t).not.toContain("Vieille tâche");
  });

  it("sans tâche, le presse-papiers est à jour", () => {
    render(<DonneesBanniere jour={JOUR} joursCharges={new Set()} commandes={RIEN} taches={[]} />);
    expect(textes()).toContain("Tout est à jour");
  });
});
