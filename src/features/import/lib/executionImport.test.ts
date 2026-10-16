import { describe, expect, it, vi } from "vitest";
import {
  executerImport,
  OPTIONS_PAR_DEFAUT,
  statutDuRapport,
  type ContexteImport,
  type Existants,
  type LotImport,
} from "./executionImport";
import { clesExistantes, preparerLignesNommees, type CibleImport } from "./importDonnees";

type Appel = { table?: string; rpc?: string; type: string; donnees: unknown; id?: unknown };

/** Faux client Supabase : enregistre chaque écriture, refuse à la demande. */
function faux(refus: (a: Appel) => { code?: string; message: string } | null = () => null) {
  const appels: Appel[] = [];
  let n = 0;
  const rpc = vi.fn(async (nom: string, args: Record<string, unknown>) => {
    const a = { rpc: nom, type: "rpc", donnees: args };
    appels.push(a);
    const error = refus(a);
    const id = `nouveau-${++n}`;
    return {
      data: error
        ? null
        : nom === "add_purchase"
          ? { id, product_id: args.p_product_id ?? `prod-${id}` }
          : { id },
      error,
    };
  });
  const from = vi.fn((table: string) => ({
    insert: async (donnees: unknown) => {
      const a = { table, type: "insert", donnees };
      appels.push(a);
      return { error: refus(a) };
    },
    update: (donnees: unknown) => ({
      eq: async (_c: string, id: unknown) => {
        const a = { table, type: "update", donnees, id };
        appels.push(a);
        return { error: refus(a) };
      },
    }),
  }));
  return { client: { rpc, from } as unknown as ContexteImport["client"], appels };
}

const AUCUN: Existants = { produits: [], fournisseurs: [] };

const ctx = (client: ContexteImport["client"], existants = AUCUN): ContexteImport => ({
  client,
  storeId: "s1",
  userId: "u1",
  empreinte: "abc",
  nomFichier: "stock.xlsx",
  existants,
});

const lot = (
  cible: CibleImport,
  lignes: Record<string, string | number | null>[],
  existantes = new Map<string, string | null>(),
  options = {},
): LotImport => ({
  cible,
  source: "Feuille1",
  lignes: preparerLignesNommees(lignes, cible, existantes),
  options: { ...OPTIONS_PAR_DEFAUT, ...options },
});

describe("executerImport", () => {
  it("crée les produits avec leur stock initial, une clé d'idempotence par ligne", async () => {
    const f = faux();
    const r = await executerImport(
      [
        lot("produits", [
          { designation: "Riz", variante: "25kg", prix_vente: 1000, stock_initial: 3 },
          { designation: "" },
        ]),
      ],
      ctx(f.client),
    );
    expect(r.bilans).toEqual([
      { module: "produits", ajoutes: 1, mis_a_jour: 0, ignores: 0, rejetes: 1 },
    ]);
    expect(f.appels[0]).toMatchObject({
      rpc: "create_product",
      donnees: {
        p_store_id: "s1",
        p_designation: "Riz",
        p_variant_suffix: "25kg",
        p_display_name: "Riz 25kg",
        p_stock_initial: 3,
        p_idempotency_key: "import:s1:abc:Feuille1:1",
      },
    });
    expect(statutDuRapport(r)).toBe("partiel");
  });

  it("crée les fournisseurs cités et inconnus, une seule fois", async () => {
    const f = faux();
    await executerImport(
      [
        lot("produits", [
          { designation: "A", fournisseur: "Socimad" },
          { designation: "B", fournisseur: "socimad" },
          { designation: "C", fournisseur: "Connu" },
        ]),
      ],
      ctx(f.client, { produits: [], fournisseurs: [{ id: "f1", nom: "CONNU" }] }),
    );
    const insertions = f.appels.filter((a) => a.table === "suppliers");
    expect(insertions).toHaveLength(1);
    expect(insertions[0].donnees).toEqual([{ store_id: "s1", created_by: "u1", nom: "Socimad" }]);
  });

  it("met à jour un produit existant et, sur demande seulement, aligne son stock", async () => {
    const existants: Existants = {
      produits: [
        {
          id: "p1",
          designation: "Riz",
          variante: "",
          prix_achat: 800,
          prix_vente: 1000,
          fournisseur: "",
          seuil_alerte: 2,
          stock_actuel: 10,
        },
      ],
      fournisseurs: [],
    };
    const cles = clesExistantes("produits", [{ id: "p1", designation: "Riz", variante: "" }]);
    const ligne = [{ designation: "riz", prix_vente: 1200, stock_initial: 4 }];

    const sansStock = faux();
    const r1 = await executerImport(
      [lot("produits", ligne, cles, { doublons: "mettre_a_jour" })],
      ctx(sansStock.client, existants),
    );
    expect(r1.bilans[0]).toMatchObject({ mis_a_jour: 1 });
    expect(sansStock.appels.map((a) => a.rpc)).toEqual(["update_product"]);
    expect(sansStock.appels[0].donnees).toMatchObject({
      p_product_id: "p1",
      p_prix_vente_defaut: 1200,
      p_prix_achat: 800,
    });

    const avecStock = faux();
    await executerImport(
      [lot("produits", ligne, cles, { doublons: "mettre_a_jour", alignerStock: true })],
      ctx(avecStock.client, existants),
    );
    expect(avecStock.appels[1]).toMatchObject({
      rpc: "ajuster_stock",
      donnees: { p_product_id: "p1", p_delta: -6 },
    });

    const ignore = faux();
    const r3 = await executerImport([lot("produits", ligne, cles)], ctx(ignore.client, existants));
    expect(ignore.appels).toHaveLength(0);
    expect(r3.bilans[0]).toMatchObject({ ignores: 1, ajoutes: 0 });
  });

  it("insère les tiers par lots et reprend un lot refusé une ligne à la fois", async () => {
    const f = faux((a) =>
      a.type === "insert" &&
      (Array.isArray(a.donnees) || (a.donnees as { nom: string }).nom === "Doublon")
        ? { code: "23505", message: "duplicate" }
        : null,
    );
    const r = await executerImport(
      [lot("fournisseurs", [{ nom: "Ok" }, { nom: "Doublon" }])],
      ctx(f.client),
    );
    expect(r.bilans[0]).toMatchObject({ module: "fournisseurs", ajoutes: 1, rejetes: 1 });
    expect(r.erreurs).toEqual([
      { module: "fournisseurs", source: "Feuille1", ligne: 2, message: "Existe déjà" },
    ]);
  });

  it("met à jour un client sans effacer ce que le fichier laisse vide", async () => {
    const f = faux();
    const cles = clesExistantes("clients", [{ id: "c1", nom: "Rabe", email: "rabe@exemple.mg" }]);
    await executerImport(
      [
        lot("clients", [{ nom: "Rabe", email: "rabe@exemple.mg", ville: "Moroni" }], cles, {
          doublons: "mettre_a_jour",
        }),
      ],
      ctx(f.client),
    );
    expect(f.appels).toEqual([
      {
        table: "clients",
        type: "update",
        donnees: { email: "rabe@exemple.mg", ville: "Moroni" },
        id: "c1",
      },
    ]);
  });

  it("enregistre les achats après les produits du même import, et retrouve ces produits", async () => {
    const f = faux();
    const r = await executerImport(
      [
        lot("achats", [
          { date: "2026-10-01", designation: "Sucre", quantite: 5, prix_achat: 100 },
          { date: "2026-10-02", designation: "Riz", quantite: 2, prix_achat: 800, montant_paye: 0 },
        ]),
        lot("produits", [{ designation: "Riz", stock_initial: 0 }]),
      ],
      ctx(f.client),
    );
    expect(f.appels.map((a) => a.rpc)).toEqual(["create_product", "add_purchase", "add_purchase"]);
    const [, sucre, riz] = f.appels;
    expect(sucre.donnees).toMatchObject({
      p_product_id: null,
      p_new_designation: "Sucre",
      p_new_prix_vente_defaut: 130,
      p_montant_paye: null,
    });
    expect(riz.donnees).toMatchObject({
      p_product_id: "nouveau-1",
      p_quantite: 2,
      p_montant_paye: 0,
    });
    expect(r.bilans).toEqual([
      { module: "produits", ajoutes: 2, mis_a_jour: 0, ignores: 0, rejetes: 0 },
      { module: "achats", ajoutes: 2, mis_a_jour: 0, ignores: 0, rejetes: 0 },
    ]);
  });

  it("s'arrête quand l'utilisateur annule", async () => {
    const f = faux();
    let n = 0;
    const r = await executerImport(
      [lot("produits", [{ designation: "A" }, { designation: "B" }])],
      {
        ...ctx(f.client),
        annule: () => n++ >= 1,
      },
    );
    expect(r.bilans[0].ajoutes).toBe(1);
    expect(r.interrompu).toBe(true);
    expect(statutDuRapport(r)).toBe("interrompu");
  });
});
