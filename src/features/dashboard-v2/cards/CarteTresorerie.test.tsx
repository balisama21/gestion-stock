import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteTresorerie } from "./CarteTresorerie";
import type { CapitalSummary } from "../../../types";
import type { ChiffresFlux } from "../lib/chiffres";

/**
 * Les chiffres réels de « Ma Boutique » au 20/09/2026, plus un
 * remboursement inventé : c'est lui qui manquait à la composition, et
 * son absence faisait mentir l'addition.
 */
const CAPITAL: CapitalSummary = {
  capitalInitial: 50000,
  apportsTotal: 20000,
  ventesTotalEncaisse: 393200,
  achatsTotal: 33000,
  depensesVendeursTotal: 58000,
  remboursementsTotal: 12000,
  tresorerieGlobaleActuelle: 50000 + 20000 + 393200 - 33000 - 58000 - 12000,
  seuilAlerteTresorerie: 50000,
};

const FLUX = { encaisse: 146000, sorties: 33000 } as unknown as ChiffresFlux;

/** Les chiffres d'une ligne, sans les espaces ni l'unité. */
const chiffresDe = (texte: string) => texte.replace(/[^\d]/g, "");

function afficher(surcharge: Partial<React.ComponentProps<typeof CarteTresorerie>> = {}) {
  return render(
    <CarteTresorerie
      capital={CAPITAL}
      flux={FLUX}
      periode="1 – 20 sept."
      duParLesClients={0}
      montantVisible
      {...surcharge}
    />,
  );
}

describe("le détail du solde de trésorerie", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("arrive ouvert, sans qu'on ait à le demander", () => {
    afficher();
    expect(screen.getByText("Capital initial")).toBeTruthy();
    expect(screen.getByLabelText("Replier le détail du solde")).toBeTruthy();
  });

  it("montre les SIX postes du calcul, y compris ceux à zéro", () => {
    const { container } = afficher({
      capital: { ...CAPITAL, apportsTotal: 0, remboursementsTotal: 0 },
    });
    // Un état financier ne masque pas ses lignes vides : sans elles,
    // l'addition que le lecteur refait de tête ne tombe plus juste.
    expect(container.querySelectorAll(".compo-liste div")).toHaveLength(6);
  });

  it("affiche les remboursements — la ligne qui manquait", () => {
    const { container } = afficher();
    const ligne = [...container.querySelectorAll(".compo-liste div")].find((d) =>
      d.querySelector("dt")?.textContent?.includes("Remboursements"),
    );
    expect(ligne).toBeTruthy();
    expect(chiffresDe(ligne!.querySelector("dd")!.textContent ?? "")).toBe("12000");
  });

  it("referme l'addition : les six lignes signées donnent le total affiché", () => {
    const { container } = afficher();
    const somme = [...container.querySelectorAll(".compo-liste div")].reduce((acc, d) => {
      const texte = d.querySelector("dd")!.textContent ?? "";
      const valeur = Number(chiffresDe(texte));
      return texte.trimStart().startsWith("−") ? acc - valeur : acc + valeur;
    }, 0);
    const total = Number(chiffresDe(container.querySelector(".compo-total b")!.textContent ?? ""));
    expect(somme).toBe(total);
    expect(total).toBe(CAPITAL.tresorerieGlobaleActuelle);
  });

  it("se replie, et le chevron dit alors ce que le clic fera", () => {
    const { container } = afficher();
    fireEvent.click(screen.getByLabelText("Replier le détail du solde"));
    expect(container.querySelectorAll(".compo-liste div")).toHaveLength(0);
    expect(screen.getByLabelText("Déplier le détail du solde")).toBeTruthy();
    // Le choix se retient, sinon il faudrait le refaire à chaque visite.
    expect(window.localStorage.getItem("tantana.dash.tresorerie-detail")).toBe("1");
  });

  it("ne parle du crédit client que lorsqu'il y en a", () => {
    const { container: sans } = afficher();
    expect(sans.querySelector(".compo-note")).toBeNull();
    cleanup();
    const { container: avec } = afficher({ duParLesClients: 56800 });
    expect(avec.querySelector(".compo-note")?.textContent).toContain("encore chez vos clients");
  });

  it("ne détaille rien à qui n'a pas le droit de voir le solde", () => {
    // Masquer le total puis en donner la composition reviendrait à le
    // donner quand même.
    const { container } = afficher({ montantVisible: false });
    expect(container.querySelector(".compo")).toBeNull();
    expect(screen.getByText(/•••/)).toBeTruthy();
  });

  it("dit l'horizon de chaque chiffre — le solde court, la barre pas", () => {
    afficher();
    expect(screen.getByText("Toutes caisses, depuis l'ouverture")).toBeTruthy();
    expect(screen.getByText(/Entrées 1 – 20 sept\./)).toBeTruthy();
    expect(screen.getByText(/Sorties 1 – 20 sept\./)).toBeTruthy();
  });
});
