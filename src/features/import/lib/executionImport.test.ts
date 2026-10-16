import { describe, expect, it, vi } from "vitest";
import { executerImport, type ContexteImport } from "./executionImport";
import { preparerLignesNommees } from "./importDonnees";

function faux(
  options: {
    rpcErreur?: (args: Record<string, unknown>) => unknown;
    insertErreur?: (rows: unknown) => unknown;
  } = {},
) {
  const rpc = vi.fn(async (_nom: string, args: Record<string, unknown>) => ({
    data: null,
    error: options.rpcErreur?.(args) ?? null,
  }));
  const insert = vi.fn(async (rows: unknown) => ({ error: options.insertErreur?.(rows) ?? null }));
  const from = vi.fn(() => ({ insert }));
  return { client: { rpc, from } as unknown as ContexteImport["client"], rpc, insert, from };
}

const ctx = (client: ContexteImport["client"]): ContexteImport => ({
  client,
  storeId: "s1",
  userId: "u1",
  empreinte: "abc",
});

describe("executerImport", () => {
  it("crée les produits par la RPC, avec une clé d'idempotence par ligne", async () => {
    const f = faux();
    const lignes = preparerLignesNommees(
      [
        { designation: "Riz", variante: "25kg", prix_vente: 1000, stock_initial: 3 },
        { designation: "" },
      ],
      "produits",
      new Set(),
    );
    const r = await executerImport("produits", lignes, ctx(f.client));
    expect(r).toEqual({ crees: 1, ignores: 1, erreurs: [] });
    expect(f.rpc).toHaveBeenCalledWith(
      "create_product",
      expect.objectContaining({
        p_store_id: "s1",
        p_designation: "Riz",
        p_variant_suffix: "25kg",
        p_display_name: "Riz 25kg",
        p_stock_initial: 3,
        p_idempotency_key: "import:s1:abc:1",
      }),
    );
  });

  it("rapporte les refus de la base ligne par ligne", async () => {
    const f = faux({
      rpcErreur: (a) => (a.p_designation === "B" ? { code: "42501", message: "x" } : null),
    });
    const lignes = preparerLignesNommees(
      [{ designation: "A" }, { designation: "B" }],
      "produits",
      new Set(),
    );
    const r = await executerImport("produits", lignes, ctx(f.client));
    expect(r.crees).toBe(1);
    expect(r.erreurs).toEqual([{ numero: 2, message: "Droits insuffisants" }]);
  });

  it("insère les clients par lots et reprend un lot refusé une ligne à la fois", async () => {
    const f = faux({
      insertErreur: (rows) =>
        Array.isArray(rows) || (rows as { nom: string }).nom === "Doublon"
          ? { code: "23505", message: "duplicate" }
          : null,
    });
    const lignes = preparerLignesNommees(
      [{ nom: "Ok" }, { nom: "Doublon" }],
      "fournisseurs",
      new Set(),
    );
    const r = await executerImport("fournisseurs", lignes, ctx(f.client));
    expect(f.from).toHaveBeenCalledWith("suppliers");
    expect(r.crees).toBe(1);
    expect(r.erreurs).toEqual([{ numero: 2, message: "Existe déjà" }]);
  });

  it("s'arrête quand l'utilisateur annule", async () => {
    const f = faux();
    const lignes = preparerLignesNommees(
      [{ designation: "A" }, { designation: "B" }],
      "produits",
      new Set(),
    );
    let n = 0;
    const r = await executerImport("produits", lignes, {
      ...ctx(f.client),
      annule: () => n++ >= 1,
    });
    expect(r.crees).toBe(1);
  });
});
