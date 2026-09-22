import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SettingsLayout } from "./SettingsLayout";

// La barre lit le profil connecté pour son sous-titre et son bouton de
// déconnexion ; ni l'un ni l'autre ne concerne ce qu'on vérifie ici.
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ signOut: vi.fn(), profile: { email: "essai@exemple.mg" } }),
}));

/**
 * LA BARRE DES RÉGLAGES NE DOIT PAS BÉGAYER.
 *
 * Un onglet déclaré deux fois s'affiche deux fois, et React se plaint
 * de deux clés identiques. C'est arrivé : l'onglet « Documents » est
 * parti en production en double, parce qu'un script de branchement a
 * été relancé après un échec partiel. Le défaut est invisible à la
 * relecture — deux blocs identiques et consécutifs se lisent comme un
 * seul — mais il saute aux yeux à l'écran.
 *
 * ── POURQUOI ON COMPTE JUSQU'À DEUX ────────────────────────────────
 *
 * Chaque onglet est rendu DEUX fois par construction : une fois dans
 * la bande défilante du téléphone, une fois dans la barre latérale du
 * bureau, et le CSS n'en montre qu'une selon la largeur. Deux
 * occurrences sont donc la normale ; quatre trahissent un doublon.
 *
 * On compte les LIBELLÉS et non le texte des boutons : celui de la
 * barre latérale porte aussi son sous-titre, si bien que les deux
 * rendus d'un même onglet n'ont pas la même chaîne. Une première
 * version de ce test comptait les boutons et ne voyait rien —
 * vérifié en réintroduisant le doublon exprès.
 */

const afficher = (isOwner = true) =>
  render(
    <SettingsLayout activeTab="paiement" onTabChange={vi.fn()} isOwner={isOwner}>
      <div />
    </SettingsLayout>,
  );

/** Les réglages personnels, visibles par tout le monde. */
const PERSONNELS = ["Mon compte", "Sécurité", "Notifications", "Préférences"];

/** Les réglages de boutique, réservés au propriétaire. */
const BOUTIQUE = [
  "Ma boutique",
  "Reçus et factures",
  "Documents",
  "Champs personnalisés",
  "Listes",
  "Vocabulaire et modules",
  "Rappels",
  "Alertes de stock",
  "Équipe",
];

/** Ouvert pendant le test : son libellé sert aussi de titre de page. */
const OUVERT = "Abonnement";

describe("aucun onglet n'apparaît deux fois", () => {
  afterEach(cleanup);

  it.each([...PERSONNELS, ...BOUTIQUE])("« %s » est rendu une seule fois", (libelle) => {
    afficher(true);
    expect(screen.getAllByText(libelle)).toHaveLength(2);
  });

  it("et la liste du collaborateur ne bégaie pas non plus", () => {
    afficher(false);
    // « Abonnement » ne lui est pas ouvert : la barre se rabat sur le
    // premier onglet, « Mon compte », dont le libellé sert alors aussi
    // de titre de page. On compte donc les trois autres.
    for (const libelle of PERSONNELS.filter((l) => l !== "Mon compte")) {
      expect(screen.getAllByText(libelle), libelle).toHaveLength(2);
    }
    expect(screen.getAllByText("Mon compte")).toHaveLength(3);
  });
});

describe("ce que chacun a le droit de voir", () => {
  afterEach(cleanup);

  it("le propriétaire atteint les réglages de documents", () => {
    afficher(true);
    expect(screen.getAllByText("Documents").length).toBeGreaterThan(0);
  });

  it("un collaborateur ne voit aucun réglage de boutique", () => {
    // Un vendeur imprime avec le modèle choisi, il ne le choisit pas.
    afficher(false);
    for (const libelle of [...BOUTIQUE, OUVERT]) {
      expect(screen.queryByText(libelle), libelle).toBeNull();
    }
    expect(screen.getAllByText("Mon compte").length).toBeGreaterThan(0);
  });
});
