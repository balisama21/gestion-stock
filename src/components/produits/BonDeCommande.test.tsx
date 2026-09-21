import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BonDeCommande } from "./BonDeCommande";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../lib/prealerteStock";
import type { ProduitARecommander } from "../../lib/bonDeCommande";
import type { StoreSettings } from "../../types";

/**
 * LE DOCUMENT QUI PART CHEZ LE FOURNISSEUR.
 *
 * Le PDF est une photographie de ce bloc : ce qui est vérifié ici est
 * donc exactement ce qui sera imprimé. Ce que le test ne peut pas voir,
 * en revanche, c'est l'allure du résultat — seul un œil le dira.
 */

const ACTIVE: ReglagesAlertesStock = { ...REGLAGES_PAR_DEFAUT, prealerteActive: true, ecart: 2 };

const BOUTIQUE = {
  storeName: "Épicerie Tiko",
  subtitle: "Système boutique",
  // Le message des reçus de VENTE. Il ne doit pas suivre sur un bon de
  // commande : « sans reprise » n'a aucun sens dit à un fournisseur.
  receiptFooter: "Merci pour votre confiance, sans reprise après la vente",
  suppliers: [],
} as unknown as StoreSettings;

const CATALOGUE: ProduitARecommander[] = [
  {
    id: "h",
    nom: "Huile 1 L",
    numero: "P001",
    stockActuel: 5,
    seuilAlerte: 3,
    fournisseur: "Tiko Import",
    prixAchat: 4000,
  },
  { id: "s", nom: "Savon", numero: "P002", stockActuel: 1, seuilAlerte: 3 },
  { id: "c", nom: "Ciment", numero: "P003", stockActuel: 40, seuilAlerte: 10 },
];

function afficher(produits = CATALOGUE, reglages = ACTIVE) {
  return render(
    <BonDeCommande
      ouvert
      onFermer={vi.fn()}
      produits={produits}
      reglages={reglages}
      settings={BOUTIQUE}
    />,
  );
}

/** La ligne du tableau qui parle de ce produit. */
const ligneDe = (nom: string) => screen.getByText(nom).closest("tr") as HTMLElement;
const cellulesDe = (nom: string) => within(ligneDe(nom)).getAllByRole("cell");

describe("le bon de commande", () => {
  afterEach(cleanup);

  it("porte le nom de la boutique et la date", () => {
    afficher();
    expect(screen.getByText("Épicerie Tiko")).toBeTruthy();
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
    // Deux fois : le titre de la fenêtre, et le document lui-même —
    // c'est le papier qui doit se nommer, pas seulement l'écran.
    expect(screen.getAllByText("Bon de commande")).toHaveLength(2);
  });

  it("ne liste que ce qu'il faut racheter", () => {
    afficher();
    expect(screen.getByText("Huile 1 L")).toBeTruthy();
    expect(screen.getByText("Savon")).toBeTruthy();
    // Quarante unités pour un seuil de dix : rien à commander.
    expect(screen.queryByText("Ciment")).toBeNull();
  });

  it("dit combien commander", () => {
    afficher();
    // Réf · Désignation · Qté · Prix unitaire · Montant.
    // Stock 5, seuil 3 : le niveau normal est 6, il manque 1.
    expect(cellulesDe("Huile 1 L")[2].textContent).toBe("1");
    // Stock 1, seuil 3 : il manque 5.
    expect(cellulesDe("Savon")[2].textContent).toBe("5");
  });

  it("NE MONTRE PAS le stock restant ni le seuil", () => {
    // Ce sont des affaires internes. Les montrer à un fournisseur
    // affaiblit la position de qui commande — et il n'en a que faire.
    afficher();
    const entetes = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(entetes).toEqual(["Réf.", "Désignation", "Qté", "Prix unitaire", "Montant"]);
  });

  it("porte la référence de chaque produit", () => {
    afficher();
    expect(cellulesDe("Huile 1 L")[0].textContent).toBe("P001");
  });

  it("marque d'un tiret ce qu'il ignore, plutôt que d'écrire zéro", () => {
    // Un prix inventé sur un bon de commande devient une erreur qu'on
    // ne rattrape plus.
    afficher();
    const cellules = cellulesDe("Savon");
    expect(cellules[3].textContent).toBe("—");
    expect(cellules[4].textContent).toBe("—");
  });

  it("annonce ce que son total ne compte pas", () => {
    afficher();
    expect(screen.getByText(/1 ligne n'est pas chiffrée/)).toBeTruthy();
  });

  it("n'affiche pas de total quand aucun prix n'est connu", () => {
    // « 0 Ar » se lirait comme une commande gratuite.
    afficher([{ id: "s", nom: "Savon", stockActuel: 1, seuilAlerte: 3 }]);
    const total = screen.getByText("Total").parentElement!;
    expect(within(total).getByText("—")).toBeTruthy();
  });

  it("le message des reçus de vente ne le suit pas", () => {
    afficher();
    expect(screen.queryByText(/sans reprise après la vente/)).toBeNull();
  });

  it("laisse la place au cachet et à la signature", () => {
    afficher();
    expect(screen.getByText("Cachet et signature")).toBeTruthy();
  });

  it("le dit, et ne propose rien, quand il n'y a rien à commander", () => {
    afficher([CATALOGUE[2]]);
    expect(screen.getByText(/Il n'y a rien à commander/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excel/ })).toBeNull();
  });

  it("préalerte éteinte, il s'en tient au seuil", () => {
    // La garantie « rien ne change pour qui n'active pas ».
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(screen.getByText("Savon")).toBeTruthy();
    expect(screen.queryByText("Huile 1 L")).toBeNull();
  });

  it("propose les trois sorties", () => {
    afficher();
    expect(screen.getByRole("button", { name: /PDF/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /CSV/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Excel/ })).toBeTruthy();
  });
});

describe("le destinataire, quand il n'y en a qu'un", () => {
  afterEach(cleanup);

  const memeFournisseur: ProduitARecommander[] = [
    { id: "a", nom: "Huile", stockActuel: 5, seuilAlerte: 3, fournisseur: "Tiko Import" },
    { id: "b", nom: "Savon", stockActuel: 1, seuilAlerte: 3, fournisseur: "Tiko Import" },
  ];

  it("son nom monte en tête, et la colonne disparaît", () => {
    // Une commande s'adresse à quelqu'un. Répéter « Tiko Import » à
    // chaque ligne ne dit rien de plus.
    afficher(memeFournisseur);
    expect(screen.getByText("Fournisseur")).toBeTruthy();
    expect(screen.getAllByText("Tiko Import")).toHaveLength(1);
  });

  it("une seule fiche sans fournisseur, et le nom redescend", () => {
    // L'en-tête affirmerait quelque chose de faux sur cette ligne-là.
    afficher([...memeFournisseur, { id: "c", nom: "Sel", stockActuel: 1, seuilAlerte: 3 }]);
    expect(screen.queryByText("Fournisseur")).toBeNull();
    expect(screen.getAllByText("Tiko Import")).toHaveLength(2);
  });
});
