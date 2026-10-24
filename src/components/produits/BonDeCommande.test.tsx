import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BonDeCommande } from "./BonDeCommande";
import { REGLAGES_PAR_DEFAUT, type ReglagesAlertesStock } from "../../lib/prealerteStock";
import type { ProduitARecommander } from "../../lib/bonDeCommande";
import type { StoreSettings } from "../../types";

/**
 * LE DOCUMENT QUI PART CHEZ LE FOURNISSEUR.
 *
 * Le PDF est une photographie de la feuille : ce qui est vérifié ici
 * est donc exactement ce qui sera imprimé. Ce que le test ne peut pas
 * voir, en revanche, c'est l'allure du résultat — seul un œil le dira.
 *
 * ── POURQUOI CES BANCS SONT DEVENUS ASYNCHRONES ────────────────────
 *
 * Le document est passé sur le moteur commun, qui se met en page en
 * DEUX temps : une feuille de mesure, posée hors champ et en
 * `visibility: hidden`, puis les vraies feuilles. Tant que la mesure
 * n'a pas rendu la main, le tableau existe mais reste invisible — donc
 * sans rôle pour un lecteur d'écran, et introuvable par `getByRole`.
 * `attendreLaFeuille` laisse ce second temps arriver.
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

/** La feuille définitive, une fois la passe de mesure passée. */
const attendreLaFeuille = () => screen.findByRole("table", {}, { timeout: 5000 });

/**
 * La ligne du tableau qui parle de ce produit. Cherchée DANS la feuille :
 * le nom figure aussi au-dessus, dans la liste des quantités à régler.
 */
const ligneDe = (nom: string) =>
  within(screen.getByRole("table")).getByText(nom).closest("tr") as HTMLElement;
const cellulesDe = (nom: string) => within(ligneDe(nom)).getAllByRole("cell");

describe("le bon de commande", () => {
  afterEach(cleanup);

  it("porte le nom de la boutique et la date", async () => {
    afficher();
    await attendreLaFeuille();
    // En tête de la feuille, et repris au pied de page : c'est le
    // papier qui doit se nommer, pas seulement l'écran.
    expect(screen.getAllByText(/Épicerie Tiko/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
    expect(screen.getAllByText("Bon de commande")).toHaveLength(2);
  });

  it("ne liste que ce qu'il faut racheter", async () => {
    afficher();
    const feuille = within(await attendreLaFeuille());
    expect(feuille.getByText("Huile 1 L")).toBeTruthy();
    expect(feuille.getByText("Savon")).toBeTruthy();
    // Quarante unités pour un seuil de dix : rien à commander.
    expect(screen.queryByText("Ciment")).toBeNull();
  });

  it("dit combien commander", async () => {
    afficher();
    await attendreLaFeuille();
    // Désignation · Quantité · Prix unitaire · Total.
    // La quantité porte son unité, comme sur tous les documents du
    // moteur commun : « unité » à défaut de celle de la fiche.
    // Stock 5, seuil 3 : le niveau normal est 6, il manque 1.
    expect(cellulesDe("Huile 1 L")[1].textContent).toBe("1 unité");
    // Stock 1, seuil 3 : il manque 5.
    expect(cellulesDe("Savon")[1].textContent).toBe("5 unités");
  });

  it("NE MONTRE PAS le stock restant ni le seuil", async () => {
    // Ce sont des affaires internes. Les montrer à un fournisseur
    // affaiblit la position de qui commande — et il n'en a que faire.
    afficher();
    await attendreLaFeuille();
    // Quatre colonnes, et non cinq : la référence a rejoint la
    // désignation, comme sur une facture. C'est une colonne de moins à
    // faire tenir sur un téléphone.
    const entetes = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(entetes).toEqual(["Désignation", "Quantité", "Prix unitaire", "Total"]);
  });

  it("porte la référence de chaque produit", async () => {
    afficher();
    await attendreLaFeuille();
    // Sous la désignation, et non dans une colonne à elle.
    expect(cellulesDe("Huile 1 L")[0].textContent).toContain("réf. P001");
  });

  it("marque d'un tiret ce qu'il ignore, plutôt que d'écrire zéro", async () => {
    // Un prix inventé sur un bon de commande devient une erreur qu'on
    // ne rattrape plus.
    afficher();
    await attendreLaFeuille();
    const cellules = cellulesDe("Savon");
    expect(cellules[2].textContent).toBe("—");
    expect(cellules[3].textContent).toBe("—");
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

  it("se nomme bon de commande dans le montant en lettres, et non facture", async () => {
    // Le montant en lettres coupe la phrase en deux balises : on lit le
    // texte de la page entière. Un seul produit, chiffré : sans prix,
    // pas de montant en lettres.
    afficher([CATALOGUE[0]]);
    await attendreLaFeuille();
    expect(document.body.textContent).toContain("Arrêté le présent bon de commande à la somme de");
    expect(document.body.textContent).not.toContain("présente facture");
  });

  it("laisse la place au cachet et à la signature", () => {
    afficher();
    expect(screen.getByText("Cachet et signature de l'entreprise")).toBeTruthy();
  });

  it("le dit, et ne propose rien, quand il n'y a rien à commander", () => {
    afficher([CATALOGUE[2]]);
    expect(screen.getByText(/Il n'y a rien à commander/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Excel/ })).toBeNull();
  });

  it("préalerte éteinte, il s'en tient au seuil", async () => {
    // La garantie « rien ne change pour qui n'active pas ».
    afficher(CATALOGUE, REGLAGES_PAR_DEFAUT);
    expect(within(await attendreLaFeuille()).getByText("Savon")).toBeTruthy();
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

describe("ce que la boutique décide", () => {
  afterEach(cleanup);

  const quantiteDe = (nom: string) =>
    screen.getByRole("spinbutton", { name: `Quantité à commander : ${nom}` }) as HTMLInputElement;

  it("chaque quantité part de la suggestion", () => {
    afficher();
    expect(quantiteDe("Savon").value).toBe("5");
    expect(quantiteDe("Huile 1 L").value).toBe("1");
  });

  it("une quantité changée passe sur le bon, avec son total", async () => {
    afficher();
    fireEvent.change(quantiteDe("Huile 1 L"), { target: { value: "12" } });
    await attendreLaFeuille();
    const cellules = cellulesDe("Huile 1 L");
    expect(cellules[1].textContent).toBe("12 unités");
    expect(cellules[3].textContent?.replace(/\s/g, "")).toContain("48000");
  });

  it("zéro retire le produit du bon", async () => {
    afficher();
    fireEvent.change(quantiteDe("Savon"), { target: { value: "0" } });
    const feuille = within(await attendreLaFeuille());
    expect(feuille.queryByText("Savon")).toBeNull();
    expect(screen.getByText("Retiré du bon")).toBeTruthy();
    expect(screen.getByText("1 produit")).toBeTruthy();
  });

  it("tout à zéro : ni bon ni fichier", () => {
    afficher();
    fireEvent.change(quantiteDe("Savon"), { target: { value: "0" } });
    fireEvent.change(quantiteDe("Huile 1 L"), { target: { value: "0" } });
    expect(screen.getByText(/Toutes les quantités sont à zéro/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Excel/ })).toBeNull();
  });

  it("on revient d'un geste aux quantités conseillées", () => {
    afficher();
    expect(screen.queryByRole("button", { name: /Quantités conseillées/ })).toBeNull();
    fireEvent.change(quantiteDe("Savon"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /Quantités conseillées/ }));
    expect(quantiteDe("Savon").value).toBe("5");
  });

  it("un seul bon par défaut", async () => {
    afficher();
    expect(screen.getByRole("button", { name: "Un seul bon" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const feuille = within(await attendreLaFeuille());
    expect(feuille.getByText("Savon")).toBeTruthy();
    expect(feuille.getByText("Huile 1 L")).toBeTruthy();
  });

  it("un bon par produit : un bon à la fois, et on passe de l'un à l'autre", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Un bon par produit" }));
    expect(screen.getByText("2 produits · 2 bons")).toBeTruthy();
    expect(screen.getByText(/Bon 1 sur 2/)).toBeTruthy();

    // Le plus urgent d'abord : Savon (1 sur 3) avant Huile (5 sur 3).
    let feuille = within(await attendreLaFeuille());
    expect(feuille.getByText("Savon")).toBeTruthy();
    expect(feuille.queryByText("Huile 1 L")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Bon suivant" }));
    expect(screen.getByText(/Bon 2 sur 2/)).toBeTruthy();
    feuille = within(await attendreLaFeuille());
    expect(feuille.getByText("Huile 1 L")).toBeTruthy();
    expect(feuille.queryByText("Savon")).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Bon suivant" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
