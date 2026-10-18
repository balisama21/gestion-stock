import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PanneauNotifications } from "./PanneauNotifications";
import type { Notification } from "../lib/activite";

/**
 * CE QUE LA PRÉALERTE A APPORTÉ AU PANNEAU.
 *
 * Deux choses, et elles vont ensemble : le détail ligne par ligne, et
 * un bouton pour agir sans quitter la cloche. Le reste du panneau
 * n'est pas couvert ici.
 */

const PREALERTE: Notification = {
  id: "alerte-prealerte-stock-2",
  genre: "alerte",
  titre: "2 produits approchent de leur seuil",
  detail: "Il reste de quoi vendre, mais plus pour longtemps.",
  lignes: [
    "Huile 1 L : 5 unités restantes, seuil défini à 3.",
    "Savon : 4 unités restantes, seuil défini à 3.",
  ],
  quand: "",
  ton: "warning",
  onglet: "produits",
  actions: ["preparer-la-commande"],
};

const SIMPLE: Notification = {
  id: "alerte-rupture-1",
  genre: "alerte",
  titre: "1 produit en rupture",
  detail: "Ciment",
  quand: "",
  ton: "danger",
  onglet: "produits",
};

function afficher(surcharge: Partial<React.ComponentProps<typeof PanneauNotifications>> = {}) {
  const props = {
    alertes: [PREALERTE],
    activites: [],
    etats: new Map(),
    nonLues: 1,
    onToutMarquerLu: vi.fn(),
    onOuvrir: vi.fn(),
    onAction: vi.fn(),
    onFermer: vi.fn(),
    ...surcharge,
  };
  render(<PanneauNotifications {...props} />);
  return props;
}

describe("une notification qui liste et qui agit", () => {
  afterEach(cleanup);

  it("montre le détail ligne par ligne, sans le tronquer", () => {
    // « 2 produits » dit combien, pas lesquels ni de combien — or
    // c'est ce qu'il faut pour décider quoi commander.
    afficher();
    expect(screen.getByText("Huile 1 L : 5 unités restantes, seuil défini à 3.")).toBeTruthy();
    expect(screen.getByText("Savon : 4 unités restantes, seuil défini à 3.")).toBeTruthy();
  });

  it("propose d'agir, et ferme le panneau ensuite", () => {
    const props = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Préparer la commande" }));

    expect(props.onAction).toHaveBeenCalledWith("preparer-la-commande");
    expect(props.onFermer).toHaveBeenCalled();
    // Le bouton agit, il ne navigue pas : les deux gestes seraient
    // concurrents, et c'est l'action qui a été demandée.
    expect(props.onOuvrir).not.toHaveBeenCalled();
  });

  it("le bouton d'action n'est pas DANS le bouton de la ligne", () => {
    // Un bouton dans un bouton : le navigateur casse l'imbrication, et
    // le clavier ne sait plus lequel des deux il active.
    afficher();
    const action = screen.getByRole("button", { name: "Préparer la commande" });
    expect(action.closest("button")).toBe(action);
  });

  it("une notification sans action garde exactement sa forme d'avant", () => {
    const props = afficher({ alertes: [SIMPLE], onAction: vi.fn() });
    expect(screen.queryByRole("button", { name: "Préparer la commande" })).toBeNull();

    fireEvent.click(screen.getByText("1 produit en rupture"));
    expect(props.onOuvrir).toHaveBeenCalledWith(SIMPLE);
  });

  it("sans gestionnaire d'action, aucun bouton n'est proposé", () => {
    // Mieux vaut pas de bouton qu'un bouton qui ne fait rien.
    afficher({ onAction: undefined });
    expect(screen.queryByRole("button", { name: "Préparer la commande" })).toBeNull();
  });
});

describe("lu, vu, non lu", () => {
  afterEach(cleanup);

  it("une notification ouverte n'est plus en gras ; une notification vue l'est encore", () => {
    afficher({
      alertes: [SIMPLE, PREALERTE],
      etats: new Map([
        [SIMPLE.id, "lu"],
        [PREALERTE.id, "vu"],
      ]),
    });
    expect(screen.getByText(SIMPLE.titre).className).not.toContain("font-semibold");
    expect(screen.getByText(PREALERTE.titre).className).toContain("font-semibold");
  });

  it("ses propres gestes ne sont jamais présentés comme nouveaux", () => {
    const moi: Notification = {
      id: "act-achat-1",
      genre: "activite",
      titre: "Achat 50 000 Ar",
      detail: "Carnet",
      quand: "2026-10-18",
      ton: "info",
      onglet: "achats",
      deMoi: true,
    };
    afficher({ alertes: [], activites: [moi] });
    expect(screen.getByText(moi.titre).className).not.toContain("font-semibold");
  });

  it("« Tout marquer lu » n'apparaît que s'il reste quelque chose à lire", () => {
    afficher({ nonLues: 0 });
    expect(screen.queryByText("Tout marquer lu")).toBeNull();
    cleanup();
    const props = afficher({ nonLues: 2 });
    fireEvent.click(screen.getByText("Tout marquer lu"));
    expect(props.onToutMarquerLu).toHaveBeenCalled();
  });
});
