import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { VentesView } from "./VentesView";
import type { Product, Sale, Seller } from "../types";

/**
 * LA CAISSE ET LA CORRECTION D'UNE VENTE.
 *
 * Trois défauts relevés à l'audit du 18 octobre, chacun vérifié par ce
 * que l'écran envoie vraiment :
 *  - la modale « Modifier » proposait la date, le vendeur, le prix et
 *    le montant payé, que la base n'écrit pas, puis se fermait sur un
 *    refus en n'affichant qu'une alerte ;
 *  - le montant payé se figeait dès qu'un client était choisi, et une
 *    vente comptant partait en crédit ;
 *  - le devis repris à la caisse était marqué accepté par la vente
 *    SUIVANTE, quelle qu'elle soit.
 */

const PRODUIT: Product = {
  id: "p1",
  numero: "P001",
  designation: "Ciment",
  variantSuffix: "",
  displayName: "Ciment",
  prixAchat: 20_000,
  prixVenteDefaut: 30_000,
  fournisseur: "",
  stockInitial: 10,
  stockActuel: 10,
  stockReserve: 0,
  stockDisponible: 10,
  seuilAlerte: 2,
  sku: null,
  codeBarres: "123",
  categoryId: null,
  supplierId: null,
  description: null,
  unite: null,
  tvaRate: null,
  stockMax: null,
  typeProduit: "produit",
  statut: "actif",
  modePrix: "manuel",
  tauxMarge: null,
};

const VENTE: Sale = {
  id: "s1",
  numero: "V001",
  date: "2026-10-01",
  productId: "p1",
  designation: "Ciment",
  quantite: 3,
  prixVenteUnit: 30_000,
  totalVente: 90_000,
  prixAchatUnitRef: 20_000,
  totalAchatRef: 60_000,
  margeTotale: 30_000,
  vendeur: "Hanta",
  commission: 0,
  montantPaye: 60_000,
  montantRembourse: 0,
  montantAvoire: 0,
  soldeDu: 30_000,
  statutCredit: "Partiel",
  ticketId: null,
};

const VENDEUR = {
  id: "v1",
  nom: "Hanta",
  statut: "Actif",
  totalVentesMontant: 0,
  totalVentesNombre: 0,
  totalDepenses: 0,
  totalRemis: 0,
} as unknown as Seller;

const CLIENT = {
  id: "c1",
  nom: "Rakoto",
  prenom: null,
  entreprise: null,
} as unknown as React.ComponentProps<typeof VentesView>["clients"][number];

function afficher(p: Partial<React.ComponentProps<typeof VentesView>> = {}) {
  const onAddSaleTicket = vi.fn().mockResolvedValue({
    ventes: [{ ...VENTE, id: "s9", ticketId: "T9" }],
    error: null,
  });
  const onEditSale = vi.fn().mockResolvedValue({ error: null });
  const onVenteEnregistree = vi.fn();
  render(
    <VentesView
      sales={[VENTE]}
      products={[PRODUIT]}
      clients={[CLIENT]}
      sellers={[VENDEUR]}
      personnes={[]}
      locale="FR"
      onAddSaleTicket={onAddSaleTicket}
      onEditSale={onEditSale}
      onVenteEnregistree={onVenteEnregistree}
      {...p}
    />,
  );
  return { onAddSaleTicket, onEditSale, onVenteEnregistree };
}

afterEach(cleanup);

/** Ouvre la fiche de la vente, puis sa modale de modification. */
function ouvrirLaModification() {
  fireEvent.click(screen.getByText("Ciment"));
  fireEvent.click(screen.getByRole("button", { name: /^Modifier$/ }));
}

describe("modifier une vente", () => {
  it("ne propose à la saisie que ce que la base enregistre : quantité, prix et client", () => {
    afficher();
    ouvrirLaModification();
    expect(screen.getByLabelText("Quantité")).toBeTruthy();
    expect(screen.getByLabelText("Client")).toBeTruthy();
    expect((screen.getByLabelText(/Prix unitaire/) as HTMLInputElement).value).toBe("30000");
    // Ni la date ni le montant payé ne sont des champs.
    expect(screen.queryByDisplayValue("2026-10-01")).toBeNull();
    expect(screen.queryByDisplayValue("60000")).toBeNull();
  });

  it("un prix corrigé part avec le nouveau total", async () => {
    const { onEditSale } = afficher();
    ouvrirLaModification();
    fireEvent.change(screen.getByLabelText(/Prix unitaire/), { target: { value: "32000" } });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    await waitFor(() => expect(onEditSale).toHaveBeenCalledTimes(1));
    expect(onEditSale.mock.calls[0][0]).toMatchObject({
      prixVenteUnit: 32_000,
      totalVente: 96_000,
    });
  });

  it("envoie la nouvelle quantité et le total au prix d'origine", async () => {
    const { onEditSale } = afficher();
    ouvrirLaModification();
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    await waitFor(() => expect(onEditSale).toHaveBeenCalledTimes(1));
    expect(onEditSale.mock.calls[0][0]).toMatchObject({ quantite: 4, totalVente: 120_000 });
  });

  it("refuse un total sous le déjà payé, sans appeler la base", () => {
    const { onEditSale } = afficher();
    ouvrirLaModification();
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/déjà été encaissé/);
    expect(onEditSale).not.toHaveBeenCalled();
  });

  it("un refus de la base reste affiché dans la modale, qui ne se ferme pas", async () => {
    const onEditSale = vi.fn().mockResolvedValue({ error: "Stock disponible insuffisant." });
    afficher({ onEditSale });
    ouvrirLaModification();
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /^Enregistrer$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/Stock disponible insuffisant/),
    );
    expect(screen.getByLabelText("Quantité")).toBeTruthy();
  });
});

describe("le montant payé à la caisse", () => {
  it("suit le total même quand le client est choisi avant le panier", async () => {
    const { onAddSaleTicket } = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    // Le client d'abord, comme on le fait pour un habitué…
    fireEvent.change(screen.getByLabelText("Client"), { target: { value: "c1" } });
    // … puis l'article.
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    expect((screen.getByLabelText("Montant payé comptant") as HTMLInputElement).value).toBe(
      "30000",
    );
    fireEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    expect(onAddSaleTicket.mock.calls[0][0].montantPaye).toBe(30_000);
  });

  it("un montant tapé à la main n'est plus écrasé", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    fireEvent.change(screen.getByLabelText("Montant payé comptant"), {
      target: { value: "10000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Une unité de plus/ }));
    expect((screen.getByLabelText("Montant payé comptant") as HTMLInputElement).value).toBe(
      "10000",
    );
  });
});

describe("la quantité se règle dans le panier", () => {
  it("la caisse n'a plus de champ quantité : chaque ajout pose une unité", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    expect(screen.queryByLabelText("Quantité")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    expect((screen.getByLabelText("Quantité de Ciment") as HTMLInputElement).value).toBe("2");
  });

  it("une quantité se tape, et ne dépasse pas le disponible", async () => {
    const { onAddSaleTicket } = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    const champ = screen.getByLabelText("Quantité de Ciment");
    fireEvent.change(champ, { target: { value: "12" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Il ne reste que 10/);
    fireEvent.change(champ, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    expect(onAddSaleTicket.mock.calls[0][0].lignes[0]).toMatchObject({ quantite: 7 });
  });
});

describe("le vendeur de la vente", () => {
  const HANTA = {
    cle: "membre:u2",
    nom: "Hanta",
    nature: "membre" as const,
    membreId: "u2",
    personneId: null,
    mention: "Vendeur",
  };
  const RESPONSABLE = { ...HANTA, cle: "membre:u1", nom: "Mamy", membreId: "u1" };

  it("un invité vend à son nom, sans pouvoir en choisir un autre", async () => {
    const { onAddSaleTicket } = afficher({
      personnes: [RESPONSABLE, HANTA],
      moiNom: "Hanta",
      vendeurImpose: "Hanta",
    });
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    const champ = screen.getByRole("button", { name: /^Vendeur\s*\*/ }) as HTMLButtonElement;
    expect(champ.disabled).toBe(true);
    expect(champ.textContent).toContain("Hanta");
    expect(screen.getByText(/Seul le responsable du compte/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    fireEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    expect(onAddSaleTicket.mock.calls[0][0].vendeur).toBe("Hanta");
  });

  it("le responsable part de son nom, et choisit dans l'équipe", async () => {
    const { onAddSaleTicket } = afficher({ personnes: [RESPONSABLE, HANTA], moiNom: "Mamy" });
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    const champ = screen.getByRole("button", { name: /^Vendeur\s*\*/ }) as HTMLButtonElement;
    expect(champ.disabled).toBe(false);
    expect(champ.textContent).toContain("Mamy");
    fireEvent.click(champ);
    // Une seule équipe : pas d'intertitre « Équipe » au-dessus des noms.
    expect(screen.queryByText("Équipe")).toBeNull();
    const option = within(screen.getByRole("listbox")).getByRole("option", { name: /Hanta/ });
    fireEvent.click(within(option).getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    fireEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    expect(onAddSaleTicket.mock.calls[0][0].vendeur).toBe("Hanta");
  });
});

describe("le devis repris à la caisse", () => {
  it("revient avec la vente qui en est née", async () => {
    const { onVenteEnregistree } = afficher({
      panierInitial: {
        lignes: [{ productId: "p1", quantite: 1, prixVenteUnit: 30_000 }],
        clientNom: "Rakoto",
        clientId: "c1",
        origine: "devis-1",
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onVenteEnregistree).toHaveBeenCalledWith("T9", "devis-1"));
  });

  it("une vente ordinaire ne rattache aucun devis", async () => {
    const { onVenteEnregistree } = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle vente/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter au panier/ }));
    fireEvent.click(screen.getByRole("button", { name: /Valider la vente/ }));
    await waitFor(() => expect(onVenteEnregistree).toHaveBeenCalledWith("T9", null));
  });
});
