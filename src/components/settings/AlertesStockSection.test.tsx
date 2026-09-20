import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertesStockSection } from "./AlertesStockSection";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../lib/prealerteStock";

/**
 * L'écran de réglage de la préalerte.
 *
 * Ce qui est vérifié ici n'est pas l'apparence mais les quatre promesses
 * faites au client : éteinte, la fonction ne se voit pas ; un seul mode
 * est affiché à la fois ; l'exemple suit ce qu'on tape, arrondi compris ;
 * et une boutique verrouillée n'enregistre pas en silence.
 */

const enregistrer = vi.fn(async (_: ReglagesAlertesStock) => ({ error: null as string | null }));

/** Deux produits, dont un tout proche de son seuil : c'est lui l'exemple. */
const PRODUITS = [
  { nom: "Ciment", seuil: 10, stock: 40 },
  { nom: "Huile 1 L", seuil: 3, stock: 5 },
];

const afficher = () =>
  render(
    <AlertesStockSection
      reglages={REGLAGES_PAR_DEFAUT}
      produits={PRODUITS}
      chargement={false}
      enregistrer={enregistrer}
    />,
  );

/** La phrase d'exemple, quel que soit le découpage des <strong>. */
const exemple = () => screen.getByText(/vous serez prévenu/).textContent?.replace(/\s+/g, " ");

const allumer = () => fireEvent.click(screen.getByRole("switch", { name: "Préalerte de stock" }));

describe("les réglages de la préalerte de stock", () => {
  beforeEach(() => enregistrer.mockClear());
  afterEach(cleanup);

  it("éteinte, il n'y a rien d'autre à régler", () => {
    // Cinq lignes grisées sous un interrupteur fermé feraient croire à
    // un formulaire à remplir alors qu'il n'y a rien à faire.
    afficher();
    expect(screen.getByRole("switch", { name: "Préalerte de stock" })).toBeTruthy();
    expect(screen.queryByText("Mode de déclenchement")).toBeNull();
    expect(screen.queryByText("Fréquence")).toBeNull();
    expect(screen.queryByText("Par e-mail")).toBeNull();
  });

  it("allumée, elle montre ses réglages", () => {
    afficher();
    allumer();
    expect(screen.getByText("Mode de déclenchement")).toBeTruthy();
    expect(screen.getByText("Fréquence")).toBeTruthy();
    expect(screen.getByText("Par e-mail")).toBeTruthy();
  });

  it("n'affiche que le champ du mode choisi", () => {
    afficher();
    allumer();
    expect(screen.getByLabelText("Unités au-dessus du seuil")).toBeTruthy();
    expect(screen.queryByLabelText("Pourcentage au-dessus du seuil")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pourcentage" }));
    expect(screen.getByLabelText("Pourcentage au-dessus du seuil")).toBeTruthy();
    expect(screen.queryByLabelText("Unités au-dessus du seuil")).toBeNull();
  });

  it("l'exemple part d'un vrai produit, le plus proche de son seuil", () => {
    afficher();
    allumer();
    expect(exemple()).toContain("Huile 1 L");
    expect(exemple()).toContain("seuil est de 3");
    expect(exemple()).toContain("5 unités"); // 3 + 2
  });

  it("l'exemple suit ce qu'on tape", () => {
    afficher();
    allumer();
    fireEvent.change(screen.getByLabelText("Unités au-dessus du seuil"), {
      target: { value: "4" },
    });
    expect(exemple()).toContain("7 unités"); // 3 + 4
  });

  it("l'exemple suit le changement de mode, arrondi compris", () => {
    afficher();
    allumer();
    fireEvent.click(screen.getByRole("button", { name: "Pourcentage" }));
    // 3 × 1,5 = 4,5, et l'arrondi est au supérieur : c'est exactement ce
    // qu'on ne devine pas en lisant « 50 % » dans une case.
    expect(exemple()).toContain("5 unités");

    fireEvent.change(screen.getByLabelText("Pourcentage au-dessus du seuil"), {
      target: { value: "200" },
    });
    expect(exemple()).toContain("9 unités"); // 3 × 3
  });

  it("un champ vidé montre ce qui sera vraiment enregistré", () => {
    // La base refuse zéro : l'exemple doit décrire le réglage réel, pas
    // une saisie en cours qui n'aboutirait pas.
    afficher();
    allumer();
    fireEvent.change(screen.getByLabelText("Unités au-dessus du seuil"), { target: { value: "" } });
    expect(exemple()).toContain("4 unités"); // 3 + 1, le minimum
  });

  it("l'heure ne se demande qu'en résumé quotidien", () => {
    afficher();
    allumer();
    expect(screen.getByLabelText("Heure du résumé")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "À chaque mouvement" }));
    expect(screen.queryByLabelText("Heure du résumé")).toBeNull();
  });

  it("la notification dans l'application ne se débranche pas", () => {
    // Elle est toujours active : la montrer comme un interrupteur
    // laisserait croire qu'on peut l'éteindre.
    afficher();
    allumer();
    expect(screen.getByText("Toujours")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: /dans l'application/i })).toBeNull();
  });

  it("enregistre ce que l'écran affiche", async () => {
    afficher();
    allumer();
    fireEvent.click(screen.getByRole("button", { name: "Pourcentage" }));
    fireEvent.change(screen.getByLabelText("Pourcentage au-dessus du seuil"), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Préalerte par e-mail" }));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    expect(enregistrer.mock.calls[0][0]).toMatchObject({
      prealerteActive: true,
      mode: "pourcentage",
      pourcentage: 75,
      frequence: "quotidien",
      canaux: ["email"],
    });
  });

  it("une boutique verrouillée ne s'enregistre pas en silence", async () => {
    // Un refus de RLS sur un UPDATE ne lève rien : sans ce message, on
    // croirait avoir enregistré.
    enregistrer.mockResolvedValueOnce({
      error:
        "Ces réglages n'ont pas pu être enregistrés. Une boutique dont l'abonnement a expiré ne se modifie plus.",
    });
    afficher();
    allumer();
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));

    expect(await screen.findByText(/n'ont pas pu être enregistrés/)).toBeTruthy();
  });
});
