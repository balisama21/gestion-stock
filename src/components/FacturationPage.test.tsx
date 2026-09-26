import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FacturationPage } from "./FacturationPage";
import type { Product, Sale, StoreSettings } from "../types";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "../features/documents/lib/reglages";
import { figer } from "../features/documents/lib/copieFigee";
import type { Facturation } from "../hooks/useFacturation";
import type { DocumentCommercial } from "./facturation/documents";

/**
 * LA PROMESSE LA PLUS COÛTEUSE À CASSER.
 *
 * « Une même opération ne doit jamais être comptée deux fois, ni dans
 * le chiffre d'affaires, ni dans le stock. »
 *
 * Ce banc la tient par le seul endroit où elle peut se rompre : ce qui
 * part vers la base quand on établit une facture. Un appel de plus, une
 * écriture de recette en doublon, un `product_id` inventé sur une
 * prestation — chacun se verrait ici.
 */

const BOUTIQUE = {
  storeName: "Ma Boutique",
  subtitle: "",
  suppliers: [],
  currencySymbol: "Ar",
  tvaRate: 0,
} as unknown as StoreSettings;

const AUJOURDHUI = "2026-09-22";

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
  codeBarres: null,
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
  date: "2026-09-20",
  productId: "p1",
  designation: "Ciment",
  quantite: 1,
  prixVenteUnit: 250_000,
  totalVente: 250_000,
  prixAchatUnitRef: 0,
  totalAchatRef: 0,
  margeTotale: 250_000,
  vendeur: "Hanta",
  commission: 0,
  montantPaye: 0,
  montantRembourse: 0,
  soldeDu: 250_000,
  statutCredit: "Impayé",
  ticketId: "T1",
};

const DOC_FACTURE: DocumentCommercial = {
  cle: "vente:T1",
  entite: "vente",
  entiteId: "T1",
  type: "facture",
  numero: "FAC-V001",
  numeroBrut: "V001",
  date: "2026-09-20",
  echeance: "2026-10-05",
  tiers: "Rakoto",
  clientId: null,
  vendeur: "Hanta",
  auteurId: null,
  montant: 250_000,
  paye: 0,
  reste: 250_000,
  statut: "emise",
  avoirDe: null,
  ventes: [VENTE],
  devis: null,
  lignesDevis: [],
  factureAchat: null,
  avoir: null,
  reference: null,
};

const facturation = (p: Partial<Facturation> = {}): Facturation => ({
  chargement: false,
  erreur: null,
  avoirs: [],
  lignesAvoir: [],
  envois: new Set(),
  recus: new Set(),
  relances: new Map(),
  aujourdhui: AUJOURDHUI,
  recharger: vi.fn().mockResolvedValue(undefined),
  marquerEmis: vi.fn().mockResolvedValue(undefined),
  lireCopie: vi.fn().mockResolvedValue(null),
  marquerEnvoye: vi.fn().mockResolvedValue({ error: null }),
  creerAvoir: vi.fn().mockResolvedValue({ avoir: null, error: null }),
  ...p,
});

function afficher(p: Partial<React.ComponentProps<typeof FacturationPage>> = {}) {
  const onAddSaleTicket = vi.fn().mockResolvedValue({ ventes: [VENTE], error: null });
  const onFixerCommission = vi.fn().mockResolvedValue({ error: null });
  const onAddPaymentToSale = vi.fn().mockResolvedValue({ error: null });
  const onRefundSale = vi.fn().mockResolvedValue({ error: null });
  const onAjusterStock = vi.fn().mockResolvedValue({ error: null });
  const onDevisConverti = vi.fn().mockResolvedValue({ error: null });

  render(
    <FacturationPage
      documents={[DOC_FACTURE]}
      payments={[]}
      clients={[]}
      fournisseurs={[]}
      produits={[PRODUIT]}
      lignesFactureAchat={[]}
      vendeurs={["Hanta"]}
      settings={BOUTIQUE}
      locale="FR"
      reglagesDocuments={REGLAGES_DOCUMENTS_PAR_DEFAUT}
      facturation={facturation()}
      moiNom="Hanta"
      voitTout
      droits={{ creer: true, envoyer: true, encaisser: true, avoir: true }}
      onAddSaleTicket={onAddSaleTicket}
      onFixerCommission={onFixerCommission}
      onAddPaymentToSale={onAddPaymentToSale}
      onRefundSale={onRefundSale}
      onAjusterStock={onAjusterStock}
      onAllerVers={vi.fn()}
      onDevisConverti={onDevisConverti}
      {...p}
    />,
  );

  return {
    onAddSaleTicket,
    onFixerCommission,
    onAddPaymentToSale,
    onRefundSale,
    onAjusterStock,
    onDevisConverti,
  };
}

/** Ouvre « + Nouveau document » puis la nature demandée. */
function ouvrirLeMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Nouveau document/ }));
}

function ouvrirLeFormulaire(libelle: RegExp) {
  ouvrirLeMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: libelle }));
}

afterEach(cleanup);

describe("établir une facture n'écrit qu'une vente", () => {
  it("un seul appel, celui de la caisse", async () => {
    const { onAddSaleTicket } = afficher();
    ouvrirLeFormulaire(/^Facture Produits du catalogue/);

    fireEvent.change(screen.getByLabelText(/^Produit$/i), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(/^Quantité$/i), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Établir le document/ }));

    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    const charge = onAddSaleTicket.mock.calls[0][0];
    expect(charge.lignes).toHaveLength(1);
    expect(charge.lignes[0]).toMatchObject({
      product_id: "p1",
      quantite: 2,
      prix_vente_unit: 30_000,
    });
  });

  it("une prestation part SANS produit : la base ne touche alors pas au stock", async () => {
    const { onAddSaleTicket } = afficher();
    ouvrirLeFormulaire(/^Facture Produits du catalogue/);

    fireEvent.change(screen.getByLabelText(/^Désignation$/i), {
      target: { value: "Pose de vitrage" },
    });
    fireEvent.change(screen.getByLabelText(/^Prix unitaire$/i), { target: { value: "40000" } });
    fireEvent.click(screen.getByRole("button", { name: /Établir le document/ }));

    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    const ligne = onAddSaleTicket.mock.calls[0][0].lignes[0];
    expect(ligne.product_id).toBe("");
    expect(ligne.designation).toBe("Pose de vitrage");
  });

  it("un reçu part soldé : il constate un paiement", async () => {
    const { onAddSaleTicket } = afficher();
    ouvrirLeFormulaire(/^Reçu/);

    fireEvent.change(screen.getByLabelText(/^Produit$/i), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: /Établir le document/ }));

    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    expect(onAddSaleTicket.mock.calls[0][0].montant_paye_total).toBe(30_000);
  });

  it("la commission se pose APRÈS la vente, et ne change pas son total", async () => {
    const { onAddSaleTicket, onFixerCommission } = afficher();
    ouvrirLeFormulaire(/commission/);

    fireEvent.change(screen.getByLabelText(/^Désignation$/i), { target: { value: "Prestation" } });
    fireEvent.change(screen.getByLabelText(/^Prix unitaire$/i), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText(/Commission de la boutique/i), {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Établir le document/ }));

    await waitFor(() => expect(onFixerCommission).toHaveBeenCalledWith("s1", 15_000));
    // Le total envoyé ne porte QUE les lignes : la commission en est une
    // part, pas un supplément.
    const ligne = onAddSaleTicket.mock.calls[0][0].lignes[0];
    expect(ligne.quantite * ligne.prix_vente_unit).toBe(100_000);
  });

  it("le devis et la facture reçue mènent à leur écran, sans second formulaire", () => {
    const onAllerVers = vi.fn();
    afficher({ onAllerVers });

    ouvrirLeMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /^Devis/ }));
    expect(onAllerVers).toHaveBeenCalledWith("devis");

    ouvrirLeMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Facture d'achat/ }));
    expect(onAllerVers).toHaveBeenCalledWith("factures_achat");
  });
});

describe("une facture émise ne se modifie pas et ne se supprime pas", () => {
  it("aucun bouton ne le propose : on corrige par un avoir", () => {
    afficher();
    fireEvent.click(screen.getByText("FAC-V001"));

    expect(screen.queryByRole("button", { name: /^Modifier/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Supprimer/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Annuler par un avoir/ })).toBeTruthy();
  });

  it("un avoir qui couvre tout le montant enlève même ce chemin-là", () => {
    afficher({ documents: [{ ...DOC_FACTURE, statut: "annulee", avoirDe: "AV001" }] });
    fireEvent.click(screen.getByText("FAC-V001"));

    expect(screen.queryByRole("button", { name: /Annuler par un avoir/ })).toBeNull();
    expect(screen.getByText(/annulée par l'avoir AV001/i)).toBeTruthy();
  });
});

describe("la copie figée d'une pièce émise", () => {
  it("est rangée à l'ouverture du document, avec l'identité du jour", async () => {
    const f = facturation();
    afficher({ facturation: f });
    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Voir, PDF, imprimer/ }));

    await waitFor(() => expect(f.marquerEmis).toHaveBeenCalledTimes(1));
    const [entite, id, type, copie] = (f.marquerEmis as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(entite).toBe("vente");
    expect(id).toBe("T1");
    expect(type).toBe("facture");
    // Ce qui changerait si la boutique déménageait demain.
    expect(copie).toHaveProperty("identite");
    expect(copie).toHaveProperty("type.titre", "FACTURE");
    expect(copie).toHaveProperty("type.prefixe", "FAC-");
  });

  it("une réimpression relit la copie au lieu d'en ranger une nouvelle", async () => {
    // Émise sous un autre titre et un autre nom ; la boutique a changé depuis.
    const avant = {
      ...REGLAGES_DOCUMENTS_PAR_DEFAUT,
      types: { facture: { titre: "FACTURE ACQUITTÉE" } },
    };
    const copie = JSON.parse(
      JSON.stringify(
        figer(avant, { ...BOUTIQUE, storeName: "Ancien nom" }, "facture", "2026-09-01"),
      ),
    );
    const f = facturation({ lireCopie: vi.fn().mockResolvedValue(copie) });
    afficher({ facturation: f });
    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Voir, PDF, imprimer/ }));

    await waitFor(() => expect(screen.getAllByText("FACTURE ACQUITTÉE").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Ancien nom").length).toBeGreaterThan(0);
    expect(f.lireCopie).toHaveBeenCalledWith("vente", "T1", "facture");
    expect(f.marquerEmis).not.toHaveBeenCalled();
  });
});

describe("encaisser une facture", () => {
  it("le règlement se pose sur les lignes du ticket", async () => {
    const { onAddPaymentToSale } = afficher();
    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer un paiement/ }));

    fireEvent.change(screen.getByLabelText(/Montant reçu/i), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));

    await waitFor(() => expect(onAddPaymentToSale).toHaveBeenCalledTimes(1));
    expect(onAddPaymentToSale.mock.calls[0][0]).toBe("s1");
    expect(onAddPaymentToSale.mock.calls[0][1].montant).toBe(100_000);
  });

  it("un montant supérieur au reste ne part pas", () => {
    const { onAddPaymentToSale } = afficher();
    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer un paiement/ }));

    fireEvent.change(screen.getByLabelText(/Montant reçu/i), { target: { value: "999999" } });
    expect(screen.getByText(/dépasse ce qui reste dû/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));
    expect(onAddPaymentToSale).not.toHaveBeenCalled();
  });
});

describe("l'avoir", () => {
  it("n'appelle ni remboursement ni ajustement de stock tant qu'on ne l'a pas coché", async () => {
    const f = facturation();
    const { onRefundSale, onAjusterStock } = afficher({ facturation: f });

    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Annuler par un avoir/ }));
    fireEvent.click(screen.getByRole("button", { name: /Établir l'avoir/ }));

    await waitFor(() => expect(f.creerAvoir).toHaveBeenCalledTimes(1));
    expect(onRefundSale).not.toHaveBeenCalled();
    expect(onAjusterStock).not.toHaveBeenCalled();
  });

  it("les deux cases sont décochées à l'ouverture", () => {
    afficher();
    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Annuler par un avoir/ }));

    for (const c of screen.getAllByRole("checkbox")) {
      expect((c as HTMLInputElement).checked).toBe(false);
    }
  });

  it("coché, le remboursement passe par le chemin habituel", async () => {
    const paye = { ...VENTE, montantPaye: 250_000, soldeDu: 0, statutCredit: "Payé" as const };
    const { onRefundSale } = afficher({
      documents: [{ ...DOC_FACTURE, paye: 250_000, reste: 0, statut: "payee", ventes: [paye] }],
    });

    fireEvent.click(screen.getByText("FAC-V001"));
    fireEvent.click(screen.getByRole("button", { name: /Annuler par un avoir/ }));
    fireEvent.click(screen.getByLabelText(/Enregistrer aussi le remboursement/i));
    fireEvent.click(screen.getByRole("button", { name: /Établir l'avoir/ }));

    await waitFor(() => expect(onRefundSale).toHaveBeenCalledTimes(1));
    expect(onRefundSale.mock.calls[0][1]).toBe(250_000);
  });
});

describe("convertir une offre", () => {
  const OFFRE: DocumentCommercial = {
    ...DOC_FACTURE,
    cle: "devis:D1",
    entite: "devis",
    entiteId: "D1",
    type: "devis",
    numero: "DEV-DEV001",
    statut: "attente",
    reste: 0,
    ventes: [],
    devis: {
      id: "D1",
      store_id: "s",
      client_id: null,
      client_nom: "Rakoto",
      created_at: "",
      created_by: null,
      date: "2026-09-10",
      duree_validite_jours: 30,
      note: null,
      numero: "DEV001",
      statut: "envoye",
      total: 130_000,
      type: "devis",
      updated_at: "",
      valide_jusqu_au: "2026-10-10",
      vente_ticket_id: null,
    },
    lignesDevis: [
      {
        id: "l1",
        quote_id: "D1",
        store_id: "s",
        product_id: "p1",
        designation: "Ciment",
        quantite: 3,
        prix_unitaire: 30_000,
        total: 90_000,
        ordre: 1,
        created_at: "",
      },
      {
        id: "l2",
        quote_id: "D1",
        store_id: "s",
        product_id: null,
        designation: "Livraison",
        quantite: 1,
        prix_unitaire: 40_000,
        total: 40_000,
        ordre: 2,
        created_at: "",
      },
    ],
  };

  it("reprend TOUTES les lignes, y compris celles qui ne sont pas au catalogue", async () => {
    const { onAddSaleTicket, onDevisConverti } = afficher({ documents: [OFFRE] });

    fireEvent.click(screen.getByText("DEV-DEV001"));
    fireEvent.click(screen.getByRole("button", { name: /Convertir en facture/ }));
    fireEvent.click(screen.getByRole("button", { name: /Établir le document/ }));

    await waitFor(() => expect(onAddSaleTicket).toHaveBeenCalledTimes(1));
    const lignes = onAddSaleTicket.mock.calls[0][0].lignes;
    expect(lignes).toHaveLength(2);
    expect(lignes[0].product_id).toBe("p1");
    expect(lignes[1].product_id).toBe("");
    expect(lignes[1].designation).toBe("Livraison");

    await waitFor(() => expect(onDevisConverti).toHaveBeenCalledWith("D1", "T1"));
  });
});

describe("les droits", () => {
  it("sans le droit d'encaisser, le bouton n'est pas là", () => {
    afficher({ droits: { creer: true, envoyer: true, encaisser: false, avoir: true } });
    fireEvent.click(screen.getByText("FAC-V001"));
    expect(screen.queryByRole("button", { name: /Enregistrer un paiement/ })).toBeNull();
  });

  it("sans le droit d'établir un avoir, le bouton n'est pas là", () => {
    afficher({ droits: { creer: true, envoyer: true, encaisser: true, avoir: false } });
    fireEvent.click(screen.getByText("FAC-V001"));
    expect(screen.queryByRole("button", { name: /Annuler par un avoir/ })).toBeNull();
  });

  it("sans le droit de créer, le menu ne propose que les écrans existants", () => {
    afficher({ droits: { creer: false, envoyer: true, encaisser: true, avoir: true } });
    ouvrirLeMenu();
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: /^Facture$/ })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: /^Devis/ })).toBeTruthy();
  });
});
