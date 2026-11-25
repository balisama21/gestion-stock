import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Product, Sale } from "../../types";

const inserees: Record<string, unknown>[] = [];
vi.mock("../../lib/supabase", () => {
  const requete = () => {
    const r: Record<string, unknown> = {};
    for (const m of [
      "select",
      "eq",
      "gte",
      "lte",
      "lt",
      "gt",
      "order",
      "range",
      "limit",
      "like",
      "ilike",
      "in",
    ])
      r[m] = () => r;
    r.insert = (ligne: Record<string, unknown>) => {
      inserees.push(ligne);
      return {
        select: () => ({
          single: async () => ({
            data: { ...ligne, id: "o1", numero: 7, part_organisme: "0" },
            error: null,
          }),
        }),
      };
    };
    r.then = (ok: (v: unknown) => void) => ok({ data: [], error: null });
    return r;
  };
  return { supabase: { from: requete, rpc: async () => ({ data: null, error: null }) } };
});

import { ComptoirView } from "./ComptoirView";
import { MedicamentsView } from "./MedicamentsView";
import { PeremptionsView } from "./PeremptionsView";
import { OfficineView } from "./OfficineView";
import { ReceptionsView } from "./ReceptionsView";
import { PatientsView } from "./PatientsView";
import { quantiteSuggeree } from "./CommandeGrossiste";
import type { Pharmacie } from "../../hooks/usePharmacie";
import type { FichePharma, LotPharma } from "../../lib/pharmacie";

afterEach(() => {
  cleanup();
  inserees.length = 0;
});

const J = "2026-11-20";
const produit = (p: Partial<Product>): Product =>
  ({
    id: "amox",
    numero: "P1",
    designation: "Amoxil",
    displayName: "Amoxil 500 mg",
    prixAchat: 1000,
    prixVenteDefaut: 2500,
    stockActuel: 20,
    seuilAlerte: 5,
    codeBarres: null,
    sku: null,
    unite: "boîte",
    statut: "actif",
    typeProduit: "revendu",
    categoryId: null,
    conditionnements: [],
    ...p,
  }) as Product;

const fiche = (p: Partial<FichePharma>): FichePharma => ({
  product_id: "amox",
  store_id: "s",
  dci: "Amoxicilline",
  dosage: "500 mg",
  forme: "Gélule",
  laboratoire: null,
  emplacement: "Rayon A",
  regime: "ordonnance",
  conservation: "ambiante",
  notes: null,
  ...p,
});

const lot = (p: Partial<LotPharma>): LotPharma => ({
  id: "l1",
  store_id: "s",
  product_id: "amox",
  numero_lot: "AX12",
  date_peremption: "2026-12-31",
  quantite_recue: 20,
  quantite: 20,
  prix_achat_unit: 1000,
  fournisseur: "Grossiste",
  purchase_id: null,
  recu_le: "2026-10-01",
  cree_le: "2026-10-01T10:00:00Z",
  ...p,
});

const pharmaFactice = (o: Partial<Pharmacie> = {}): Pharmacie => {
  const fiches = o.fiches ?? [fiche({})];
  return {
    fiches,
    ficheDe: new Map(fiches.map((f) => [f.product_id, f])),
    lots: [lot({})],
    organismes: [],
    chargement: false,
    erreur: null,
    recharger: vi.fn(),
    enregistrerFiche: vi.fn().mockResolvedValue({ error: null }),
    recevoir: vi.fn().mockResolvedValue({ error: null }),
    daterStock: vi.fn().mockResolvedValue({ error: null }),
    corrigerLot: vi.fn().mockResolvedValue({ error: null }),
    retirerLot: vi.fn().mockResolvedValue({ error: null }),
    enregistrerOrganisme: vi.fn().mockResolvedValue({ error: null }),
    mouvementsDuLot: vi.fn().mockResolvedValue([]),
    lotsParNumero: vi.fn().mockResolvedValue([]),
    ...o,
  } as Pharmacie;
};

const vente = { id: "v1", ticketId: "t1" } as Sale;
const client = (id: string, nom: string) => ({ id, nom, prenom: null, telephone: null }) as never;

describe("le comptoir", () => {
  it("exige le patient pour un médicament sur ordonnance, puis l'inscrit au registre", async () => {
    const vendre = vi.fn().mockResolvedValue({ ventes: [vente], error: null });
    render(
      <ComptoirView
        storeId="s"
        storeName="Pharmacie"
        products={[produit({})]}
        sales={[]}
        clients={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        vendeur="Lova"
        onVendre={vendre}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Médicament, molécule ou code-barres…"), {
      target: { value: "amoxicilline" },
    });
    fireEvent.click(screen.getByRole("button", { name: /boîte/ }));
    expect(screen.getByText(/Ordonnance requise/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));
    expect(screen.getByText(/Écrivez le nom du patient/)).toBeTruthy();
    expect(vendre).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Nom du patient"), {
      target: { value: "Rabe Jean" },
    });
    fireEvent.change(screen.getByPlaceholderText("Médecin prescripteur"), {
      target: { value: "Rakoto" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));
    await waitFor(() => expect(screen.getByText(/n° 7/)).toBeTruthy());
    expect(vendre).toHaveBeenCalledWith(
      expect.objectContaining({
        montantPaye: 2500,
        clientId: null,
        clientCredit: "Rabe Jean",
        lignes: [{ productId: "amox", quantite: 1, prixVenteUnit: 2500 }],
      }),
    );
    expect(inserees[0]).toMatchObject({
      patient_nom: "Rabe Jean",
      prescripteur: "Rakoto",
      ticket_id: "t1",
    });
  });

  it("laisse la part de l'organisme à son nom, le patient paie le reste", async () => {
    const vendre = vi.fn().mockResolvedValue({ ventes: [vente], error: null });
    render(
      <ComptoirView
        storeId="s"
        storeName="Pharmacie"
        products={[produit({ prixVenteDefaut: 10000 })]}
        sales={[]}
        clients={[client("aro", "ARO")]}
        pharma={pharmaFactice({
          fiches: [fiche({ regime: "libre" })],
          organismes: [
            { client_id: "aro", store_id: "s", taux: 80, convention: null, actif: true },
          ],
        })}
        aujourdhui={J}
        vendeur="Lova"
        onVendre={vendre}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Médicament, molécule ou code-barres…"), {
      target: { value: "amoxil" },
    });
    fireEvent.click(screen.getByRole("button", { name: /boîte/ }));
    fireEvent.change(screen.getByDisplayValue("Aucun : le patient paie tout"), {
      target: { value: "aro" },
    });
    expect(screen.getByRole("button", { name: /Encaisser 2/ })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Nom du patient"), { target: { value: "Vola" } });
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));
    await waitFor(() => expect(vendre).toHaveBeenCalled());
    expect(vendre.mock.calls[0][0]).toMatchObject({
      clientId: "aro",
      clientCredit: "ARO",
      montantPaye: 2000,
    });
    await waitFor(() =>
      expect(inserees[0]).toMatchObject({ organisme_id: "aro", part_organisme: 8000 }),
    );
  });

  it("refuse de délivrer du stock périmé et propose un équivalent", () => {
    render(
      <ComptoirView
        storeId="s"
        storeName="Pharmacie"
        products={[
          produit({ stockActuel: 3 }),
          produit({ id: "gen", displayName: "Amoxicilline Biogaran 500 mg", stockActuel: 12 }),
        ]}
        sales={[]}
        clients={[]}
        pharma={pharmaFactice({
          fiches: [fiche({}), fiche({ product_id: "gen" })],
          lots: [lot({ quantite: 3, date_peremption: "2026-10-31" })],
        })}
        aujourdhui={J}
        vendeur="Lova"
        onVendre={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Médicament, molécule ou code-barres…"), {
      target: { value: "amoxil 500" },
    });
    expect(screen.getByText("Rupture")).toBeTruthy();
    expect(screen.getByText("3 périmé(s) à retirer")).toBeTruthy();
    expect(screen.getByText("Équivalents en stock")).toBeTruthy();
  });
});

describe("les autres écrans de la pharmacie", () => {
  it("Médicaments : liste, filtre et ouvre la fiche avec ses lots", () => {
    render(
      <MedicamentsView
        products={[produit({})]}
        categories={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        peutModifier
        onCreer={vi.fn()}
        onModifier={vi.fn()}
        onStockModifie={vi.fn()}
      />,
    );
    // Le chiffre « À périmer » sert de filtre : un seul médicament y reste.
    fireEvent.click(screen.getByRole("button", { name: /À périmer/ }));
    expect(screen.getByText("1 médicament(s)")).toBeTruthy();
    // Le registre (ordinateur) et la liste (téléphone) le montrent tous deux.
    fireEvent.click(screen.getAllByText("Amoxil 500 mg")[0]);
    expect(screen.getByText("LOT AX12")).toBeTruthy();
    expect(screen.getByText("sort en premier")).toBeTruthy();
  });

  it("Péremptions : range les lots par urgence et propose le rappel de lot", () => {
    render(
      <PeremptionsView
        products={[produit({ stockActuel: 25 })]}
        sales={[]}
        pharma={pharmaFactice({ lots: [lot({ date_peremption: "2026-11-01", quantite: 5 })] })}
        aujourdhui={J}
        peutRetirer
        onStockModifie={vi.fn()}
      />,
    );
    expect(screen.getByText("Tout retirer")).toBeTruthy();
    expect(screen.getByText("Rappel de lot")).toBeTruthy();
  });

  it("Officine et Réceptions s'affichent", () => {
    render(
      <OfficineView
        storeId="s"
        storeName="Pharmacie du Centre"
        products={[produit({ stockActuel: 0 })]}
        sales={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        onAller={vi.fn()}
      />,
    );
    expect(screen.getByText("Pharmacie du Centre")).toBeTruthy();
    expect(screen.getByText("Rupture")).toBeTruthy();
    cleanup();
    render(
      <ReceptionsView
        products={[produit({})]}
        purchases={[]}
        fournisseurs={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        peutRecevoir
        onRecue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Nouvelle réception"));
    expect(screen.getByText("Total de la livraison")).toBeTruthy();
  });
});

describe("les gestes ajoutés à l'officine", () => {
  it("propose de remonter le stock à deux fois le seuil", () => {
    expect(quantiteSuggeree(produit({ stockActuel: 1, seuilAlerte: 5 }))).toBe(9);
    expect(quantiteSuggeree(produit({ stockActuel: 0, seuilAlerte: 10 }))).toBe(20);
    expect(quantiteSuggeree(produit({ stockActuel: -3, seuilAlerte: 2 }))).toBe(4);
  });

  it("transforme la commande au grossiste en réception", () => {
    render(
      <ReceptionsView
        products={[produit({ stockActuel: 1, seuilAlerte: 5 })]}
        purchases={[]}
        fournisseurs={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        peutRecevoir
        onRecue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Préparer une commande"));
    expect((screen.getByLabelText("Quantité de Amoxil 500 mg") as HTMLInputElement).value).toBe(
      "9",
    );
    fireEvent.click(screen.getByText("Recevoir la livraison"));
    expect(
      (screen.getByLabelText("Quantité reçue de Amoxil 500 mg") as HTMLInputElement).value,
    ).toBe("9");
  });

  it("écrit la posologie sur le ticket du patient", async () => {
    const vendre = vi.fn().mockResolvedValue({ ventes: [vente], error: null });
    render(
      <ComptoirView
        storeId="s"
        storeName="Pharmacie du Lac"
        products={[produit({})]}
        sales={[]}
        clients={[]}
        pharma={pharmaFactice({ fiches: [fiche({ regime: "libre" })] })}
        aujourdhui={J}
        vendeur="Lova"
        onVendre={vendre}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Médicament, molécule ou code-barres…"), {
      target: { value: "amoxil" },
    });
    fireEvent.click(screen.getByRole("button", { name: /boîte/ }));
    fireEvent.change(screen.getByLabelText("Posologie de Amoxil 500 mg"), {
      target: { value: "1 matin et soir" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Encaisser/ }));
    await waitFor(() => expect(screen.getByText("Ticket avec posologie")).toBeTruthy());
    fireEvent.click(screen.getByText("Ticket avec posologie"));
    expect(screen.getByText("→ 1 matin et soir")).toBeTruthy();
  });

  it("montre en tête du dossier les allergies du patient", () => {
    render(
      <PatientsView
        storeId="s"
        clients={[
          {
            id: "p1",
            nom: "Rasoa",
            prenom: "Marie",
            telephone: null,
            note: "Allergique à la pénicilline",
            type_client: null,
          } as never,
        ]}
        sales={[]}
        pharma={pharmaFactice()}
        aujourdhui={J}
        onAddClient={vi.fn()}
        onUpdateClient={vi.fn()}
        onAddPaymentToSale={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Marie Rasoa"));
    expect(screen.getByText("Allergique à la pénicilline")).toBeTruthy();
  });
});

describe("les alertes de stock hors périmés", () => {
  it("filtre les ruptures, les stocks faibles et les lots sans date", () => {
    render(
      <MedicamentsView
        products={[
          produit({ stockActuel: 20 }),
          produit({ id: "faible", displayName: "Stock réduit", stockActuel: 3 }),
          produit({ id: "inconnu", displayName: "Lot à dater", stockActuel: 8 }),
        ]}
        categories={[]}
        pharma={pharmaFactice({
          lots: [
            lot({ date_peremption: "2026-10-31" }),
            lot({ id: "sans", product_id: "inconnu", quantite: 8, date_peremption: null }),
          ],
        })}
        aujourdhui={J}
        peutModifier={false}
        onCreer={vi.fn()}
        onModifier={vi.fn()}
        onStockModifie={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("En rupture"));
    expect(screen.getAllByText("Amoxil 500 mg").length).toBeGreaterThan(0);
    expect(screen.queryByText("Stock réduit")).toBeNull();
    fireEvent.click(screen.getByText("Stock faible"));
    expect(screen.getAllByText("Stock réduit").length).toBeGreaterThan(0);
    expect(screen.queryByText("Amoxil 500 mg")).toBeNull();
    fireEvent.click(screen.getByText("Stock sans date"));
    expect(screen.getAllByText("Lot à dater").length).toBeGreaterThan(0);
  });
  it("commande selon le stock hors périmés", () => {
    expect(quantiteSuggeree(produit({ stockActuel: 20, seuilAlerte: 5 }), 2)).toBe(8);
  });
});
