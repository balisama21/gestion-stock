import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CarteTaches } from "./CarteTaches";
import { CarteCommandes } from "./CarteCommandes";
import { CarteLivraisons } from "./CarteLivraisons";
import { CarteAgenda } from "./CarteAgenda";
import { dateDuJour } from "../../../lib/dates";

/**
 * LA SECTION « OPÉRATIONS » DIT CE QUI EST VRAI
 *
 * Les statuts viennent des colonnes de la tâche, les étapes ouvrent les
 * commandes concernées, une étape vide ne s'allume pas, et les dessins
 * reprennent les mêmes données que les listes.
 */
afterEach(cleanup);

const jour = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateDuJour(d);
};

describe("CarteTaches", () => {
  it("tire chaque statut des vraies colonnes de la tâche", () => {
    render(
      <CarteTaches
        taches={[
          { id: "1", titre: "Payer le loyer", statut: "a_faire", echeance: jour(-2) },
          {
            id: "2",
            titre: "Appeler Rabe",
            statut: "a_faire",
            echeance: jour(0),
            priorite: "urgente",
          },
          { id: "3", titre: "Inventaire", statut: "en_cours", echeance: jour(0) },
          { id: "4", titre: "Commander du riz", statut: "a_faire", echeance: jour(3) },
        ]}
        devis={[]}
      />,
    );
    expect(screen.getByText("En retard")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("À venir")).toBeTruthy();
    // Aucune tâche terminée : aucun « Terminé » inventé.
    expect(screen.queryByText("Terminé")).toBeNull();
    // Le presse-papiers dessiné liste les mêmes tâches.
    expect(document.querySelector(".ill3d")?.textContent).toContain("Payer le loyer");
  });

  it("montre une tâche terminée aujourd'hui, cochée", () => {
    render(
      <CarteTaches
        taches={[
          {
            id: "1",
            titre: "Vérifier le stock",
            statut: "termine",
            echeance: null,
            termine_le: new Date().toISOString(),
          },
        ]}
        devis={[]}
      />,
    );
    expect(screen.getByText("Terminé")).toBeTruthy();
    expect(
      (screen.getByLabelText("Terminer « Vérifier le stock »") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("cocher une tâche la termine par la fonction de l'application", () => {
    const terminer = vi.fn();
    render(
      <CarteTaches
        taches={[{ id: "t1", titre: "Ranger", statut: "a_faire", echeance: null }]}
        devis={[]}
        onTerminer={terminer}
      />,
    );
    fireEvent.click(screen.getByLabelText("Terminer « Ranger »"));
    expect(terminer).toHaveBeenCalledWith("t1");
  });

  it("sans tâche, l'état vide et un presse-papiers à jour", () => {
    render(<CarteTaches taches={[]} devis={[]} />);
    expect(screen.getByText("Rien à faire")).toBeTruthy();
    expect(document.querySelector(".ill3d")?.textContent).toContain("Tout est à jour");
  });
});

describe("CarteCommandes", () => {
  const commandes = { recues: 1, enPreparation: 2, enLivraison: 0, aEncaisser: 0, total: 3 };

  it("chaque étape ouvre les commandes concernées", () => {
    const etape = vi.fn();
    render(<CarteCommandes commandes={commandes} onEtape={etape} />);
    fireEvent.click(screen.getByLabelText("En préparation : 2 commandes"));
    expect(etape).toHaveBeenCalledWith("enPreparation");
    fireEvent.click(screen.getByLabelText("Reçues : 1 commande"));
    expect(etape).toHaveBeenCalledWith("recues");
  });

  it("une étape vide ne s'allume pas", () => {
    render(<CarteCommandes commandes={commandes} />);
    const allumees = document.querySelectorAll(".op-etape.on");
    expect(allumees).toHaveLength(2);
    expect(screen.getByText("2 commandes en cours de préparation")).toBeTruthy();
  });

  it("rien en cours : rien n'est coché pour faire joli", () => {
    render(
      <CarteCommandes
        commandes={{ recues: 0, enPreparation: 0, enLivraison: 0, aEncaisser: 0, total: 0 }}
      />,
    );
    expect(document.querySelectorAll(".op-etape.on")).toHaveLength(0);
    expect(screen.getByText("Aucune commande en cours")).toBeTruthy();
  });
});

describe("CarteLivraisons", () => {
  it("nomme la course par sa commande et ouvre sa fiche", () => {
    const ouvrir = vi.fn();
    render(
      <CarteLivraisons
        livraisons={[
          {
            id: "l1",
            destinataire: "Rabe",
            statut: "a_faire",
            date_prevue: jour(1),
            order_id: "o1",
          },
          { id: "l2", destinataire: "Soa", statut: "livree", date_prevue: jour(1) },
        ]}
        visible
        numerosCommandes={new Map([["o1", "C021"]])}
        onLivraison={ouvrir}
      />,
    );
    fireEvent.click(screen.getByText("Commande C021"));
    expect(ouvrir).toHaveBeenCalledWith("l1");
    // Une course livrée est close : elle n'est pas listée.
    expect(screen.queryByText(/Soa/)).toBeNull();
  });
});

describe("CarteAgenda", () => {
  it("le carnet du dessin lit ce qui est prévu aujourd'hui", () => {
    render(
      <CarteAgenda
        sources={{
          evenements: [
            {
              id: "e1",
              titre: "Réunion équipe",
              debut: `${jour(0)}T09:00:00`,
              journee_entiere: false,
            },
          ],
          taches: [],
          deliveries: [],
          rappels: [],
        }}
      />,
    );
    expect(screen.getByText("09:00")).toBeTruthy();
    expect(document.querySelector(".ill3d")?.textContent).toContain("Réunion équipe");
  });

  it("agenda vide : journée libre, sans rendez-vous inventé", () => {
    render(<CarteAgenda sources={{ evenements: [], taches: [], deliveries: [], rappels: [] }} />);
    expect(screen.getByText("Rien de prévu")).toBeTruthy();
    expect(document.querySelector(".ill3d")?.textContent).toContain("Journée libre");
  });
});
