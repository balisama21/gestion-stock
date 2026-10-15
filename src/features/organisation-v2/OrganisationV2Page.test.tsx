import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Tache } from "../../lib/taches";
import type { Rappel } from "../../lib/rappels";
import type { Evenement } from "../../lib/evenements";
import type { PermissionsMap } from "../../lib/permissions";
import { ajouterJours, dateDuJour } from "./lib/dates";

/**
 * CE QUE LA PAGE ÉCRIT, ET QUAND.
 *
 * Les sources sont des doublures des hooks de l'application : chaque
 * fonction d'écriture est espionnée. On vérifie qu'afficher, filtrer et
 * changer d'onglet n'écrivent rien, et que chaque action n'envoie que
 * les colonnes qu'elle doit toucher.
 */

// Le fil d'activité lit `journal_activite` : une réponse vide suffit.
vi.mock("../../lib/supabase", () => {
  const chaine: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "neq", "order"]) chaine[m] = () => chaine;
  chaine.limit = () => Promise.resolve({ data: [], error: null });
  return { supabase: chaine };
});

const { OrganisationV2Page } = await import("./OrganisationV2Page");

const MOI = "u-moi";
const LANTO = "u-lanto";
const AUJ = dateDuJour();
const HIER4 = ajouterJours(AUJ, -4);

const tache = (x: Partial<Tache>): Tache => ({
  id: "t1",
  store_id: "s1",
  numero: "TAC001",
  titre: "Relancer le fournisseur",
  description: null,
  assignee_id: MOI,
  createur_id: MOI,
  echeance: HIER4,
  priorite: "haute",
  statut: "a_faire",
  termine_le: null,
  created_at: `${HIER4}T08:00:00Z`,
  updated_at: `${HIER4}T08:00:00Z`,
  ...x,
});

const rappel = (x: Partial<Rappel>): Rappel => ({
  id: "r1",
  store_id: "s1",
  createur_id: MOI,
  destinataire_id: MOI,
  titre: "Faire la caisse",
  recurrence: "quotidien",
  heure: "16:45:00",
  declenche_le: null,
  jour_semaine: null,
  jour_mois: null,
  actif: true,
  evenement_id: null,
  tache_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...x,
});

const ok = () => vi.fn(async () => ({ error: null as string | null }));

function monter({
  onglet = "taches" as "apercu" | "taches" | "agenda" | "rappels",
  taches = [
    tache({}),
    tache({ id: "t2", numero: "TAC002", titre: "Inventaire", assignee_id: LANTO, echeance: AUJ }),
  ],
  rappels = [rappel({})],
  evenements = [] as Evenement[],
  permissions = null as PermissionsMap | null,
} = {}) {
  const sourceTaches = {
    taches,
    chargement: false,
    erreur: null,
    recharger: vi.fn(async () => {}),
    creer: ok(),
    modifier: ok(),
    changerStatut: ok(),
    supprimer: ok(),
  };
  const sourceEvenements = {
    evenements,
    chargement: false,
    erreur: null,
    recharger: vi.fn(async () => {}),
    creer: ok(),
    supprimer: ok(),
  };
  const sourceRappels = {
    rappels,
    chargement: false,
    erreur: null,
    recharger: vi.fn(async () => {}),
    creer: ok(),
    basculer: ok(),
    supprimer: ok(),
  };
  const changerOnglet = vi.fn();
  const utils = render(
    <OrganisationV2Page
      onglet={onglet}
      onglets={["apercu", "taches", "agenda", "rappels"]}
      onChangerOnglet={changerOnglet}
      storeId="s1"
      moiId={MOI}
      membres={[
        { user_id: MOI, full_name: "Moi", email: "moi@x" },
        { user_id: LANTO, full_name: "Lanto", email: "lanto@x" },
      ]}
      permissions={permissions}
      taches={sourceTaches}
      evenements={sourceEvenements}
      rappels={sourceRappels}
      purchases={[]}
      quotes={[]}
      deliveries={[]}
      delaisRappel={{ veilleHeure: 18, memeJourMinutes: 60 }}
      onNaviguer={vi.fn()}
    />,
  );
  const ecritures = () =>
    [
      sourceTaches.creer,
      sourceTaches.modifier,
      sourceTaches.changerStatut,
      sourceTaches.supprimer,
      sourceEvenements.creer,
      sourceEvenements.supprimer,
      sourceRappels.creer,
      sourceRappels.basculer,
      sourceRappels.supprimer,
    ].reduce((n, f) => n + f.mock.calls.length, 0);
  return { ...utils, sourceTaches, sourceEvenements, sourceRappels, changerOnglet, ecritures };
}

afterEach(cleanup);

describe("Organisation v2 — onglet Tâches", () => {
  it("n'écrit rien à l'affichage, au filtre ni au changement de vue", () => {
    const m = monter();
    fireEvent.click(screen.getByRole("button", { name: "En retard" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminées" }));
    fireEvent.click(screen.getByRole("button", { name: "Tout" }));
    fireEvent.click(screen.getByRole("button", { name: "Colonnes" }));
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    fireEvent.change(screen.getByLabelText("Chercher une tâche"), { target: { value: "inv" } });
    expect(m.ecritures()).toBe(0);
  });

  it("groupe les tâches et compte les retards", () => {
    monter();
    expect(screen.getByText("En retard", { selector: ".group-h span" })).toBeTruthy();
    expect(screen.getByText("Aujourd'hui", { selector: ".group-h span" })).toBeTruthy();
    expect(screen.getByText("échéance dépassée").previousElementSibling?.textContent).toBe("1");
  });

  it("cocher une tâche n'appelle que changerStatut(id, 'termine')", async () => {
    const m = monter();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Terminer Relancer le fournisseur" }));
    });
    expect(m.sourceTaches.changerStatut).toHaveBeenCalledTimes(1);
    expect(m.sourceTaches.changerStatut).toHaveBeenCalledWith("t1", "termine");
    expect(m.ecritures()).toBe(1);
  });

  it("« Reporter à demain » n'envoie que l'échéance", async () => {
    const m = monter();
    fireEvent.click(screen.getAllByRole("button", { name: "Actions" })[0]);
    await act(async () => {
      fireEvent.click(screen.getByText("Reporter à demain"));
    });
    expect(m.sourceTaches.modifier).toHaveBeenCalledTimes(1);
    expect(m.sourceTaches.modifier).toHaveBeenCalledWith("t1", { echeance: ajouterJours(AUJ, 1) });
    expect(m.ecritures()).toBe(1);
  });

  it("refuse un titre vide, puis crée la tâche par la fonction existante", async () => {
    const m = monter();
    fireEvent.click(screen.getByRole("button", { name: "Nouveau" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nouvelle tâche" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }));
    });
    expect(m.sourceTaches.creer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/titre/);

    fireEvent.change(screen.getByPlaceholderText("Ex. Relancer le fournisseur"), {
      target: { value: "Compter la caisse" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer la tâche" }));
    });
    expect(m.sourceTaches.creer).toHaveBeenCalledTimes(1);
    expect(m.sourceTaches.creer.mock.calls[0]).toEqual([
      expect.objectContaining({ titre: "Compter la caisse", echeance: AUJ, priorite: "moyenne" }),
    ]);
  });

  it("sans droit d'écriture, la page est en lecture seule", () => {
    monter({
      permissions: {
        taches: { visible: true, scope: "own", actions: [] },
        agenda: { visible: true, scope: "own" },
        rappels: { visible: true, actions: [] },
      } as PermissionsMap,
    });
    const coche = screen.getByRole("checkbox", { name: "Terminer Relancer le fournisseur" });
    expect((coche as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
    // Le menu « Nouveau » ne propose plus que l'événement (l'agenda n'a pas d'action dédiée).
    fireEvent.click(screen.getByRole("button", { name: "Nouveau" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Nouvelle tâche")).toBeNull();
    expect(within(menu).queryByText("Nouveau rappel")).toBeNull();
  });

  it("« Ce qui m'est assigné » est le filtre par défaut d'une portée réduite", () => {
    monter({
      permissions: {
        taches: { visible: true, scope: "own", actions: ["create", "edit"] },
      } as PermissionsMap,
    });
    expect(screen.getByText("Ce qui m'est assigné")).toBeTruthy();
    expect(screen.queryByText("Inventaire")).toBeNull();
  });

  it("changer d'onglet passe par la navigation, sans écrire", () => {
    const m = monter();
    fireEvent.click(screen.getByRole("tab", { name: /Agenda/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Rappels/ }));
    expect(m.changerOnglet).toHaveBeenCalledWith("agenda");
    expect(m.changerOnglet).toHaveBeenCalledWith("rappels");
    expect(m.ecritures()).toBe(0);
  });
});

describe("Organisation v2 — onglet Agenda", () => {
  it("change de vue et de période sans rien écrire", () => {
    const m = monter({ onglet: "agenda" });
    for (const nom of ["Jour", "Semaine", "Mois"]) {
      fireEvent.click(screen.getByRole("button", { name: nom }));
      fireEvent.click(screen.getByRole("button", { name: "Période suivante" }));
      fireEvent.click(screen.getByRole("button", { name: "Période précédente" }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Rappels$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aujourd'hui" }));
    expect(m.ecritures()).toBe(0);
  });

  it("fusionne échéance de tâche et occurrence de rappel dans le détail du jour", () => {
    monter({ onglet: "agenda" });
    const detail = screen.getAllByRole("article")[1];
    expect(within(detail).getByText("Inventaire")).toBeTruthy();
    expect(within(detail).getByText("Faire la caisse")).toBeTruthy();
    expect(within(detail).getByText("16:45")).toBeTruthy();
  });

  it("crée un événement par la fonction de l'agenda, privé par défaut", async () => {
    const m = monter({ onglet: "agenda" });
    fireEvent.click(screen.getByRole("button", { name: "+ Événement" }));
    fireEvent.change(screen.getByPlaceholderText("Ex. Fournisseur Distri Tana"), {
      target: { value: "Réunion équipe" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer l'événement" }));
    });
    expect(m.sourceEvenements.creer).toHaveBeenCalledTimes(1);
    expect(m.sourceEvenements.creer.mock.calls[0]).toEqual([
      expect.objectContaining({
        titre: "Réunion équipe",
        jour: AUJ,
        heure: "10:00",
        journeeEntiere: false,
        nature: "rendez_vous",
        visibilite: "prive",
      }),
    ]);
  });
});

describe("Organisation v2 — onglet Rappels", () => {
  it("l'interrupteur n'appelle que basculer(id, actif)", async () => {
    const m = monter({ onglet: "rappels" });
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: "Activer Faire la caisse" }));
    });
    expect(m.sourceRappels.basculer).toHaveBeenCalledTimes(1);
    expect(m.sourceRappels.basculer).toHaveBeenCalledWith("r1", false);
    expect(m.ecritures()).toBe(1);
  });

  it("montre les alertes automatiques en lecture seule, sans interrupteur", () => {
    monter({ onglet: "rappels" });
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(screen.getByText("Une échéance d'achat")).toBeTruthy();
  });

  it("une boutique vide affiche des états vides, pas une erreur", () => {
    monter({ onglet: "rappels", rappels: [], taches: [] });
    expect(screen.getByText("Aucun rappel")).toBeTruthy();
    expect(screen.getByText("Aucun rappel actif")).toBeTruthy();
  });
});

describe("Organisation v2 — Vue d'ensemble", () => {
  it("compte les tâches du jour et les retards, sans écrire", () => {
    const m = monter({ onglet: "apercu" });
    const tuiles = document.querySelectorAll(".tile .tv");
    expect(tuiles[0].textContent).toBe("1");
    expect(tuiles[1].textContent).toBe("1");
    expect(screen.getByText(/échéance dépassée depuis 4 jours/)).toBeTruthy();
    expect(screen.getByText("Qui porte quoi")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "aujourd'hui" })[0]);
    expect(m.ecritures()).toBe(0);
  });

  it("une boutique vide affiche des états vides, jamais d'exemple", () => {
    monter({ onglet: "apercu", taches: [], rappels: [] });
    expect(screen.getByText("Journée libre")).toBeTruthy();
    expect(screen.getByText("Aucun retard")).toBeTruthy();
    expect(screen.getByText("Rien à boucler avant ce soir.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/exemple/i);
  });
});
