import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

/**
 * L'AJOUT DEPUIS UN FORMULAIRE NE DOIT PAS LE REFERMER.
 *
 * `loading` remplace toute l'application par l'écran d'attente. Il se
 * relevait à chaque rechargement — donc après chaque ajout — et l'écran
 * ouvert était démonté : la fiche d'achat en cours se refermait au
 * moment même où l'on venait d'y créer un fournisseur. Ces tests
 * tiennent la promesse inverse : un rafraîchissement est silencieux, et
 * la ligne créée est dans la liste avant même la relecture.
 */

const base = vi.hoisted(() => {
  const etat = {
    tables: {} as Record<string, Record<string, unknown>[]>,
    /** Tant qu'elle n'est pas résolue, les lectures attendent : une connexion lente. */
    retenue: null as Promise<void> | null,
    compteur: 0,
  };

  const requete = (table: string) => {
    let ligne: Record<string, unknown> | null = null;
    const b: Record<string, unknown> = {};
    const soi = () => b;
    Object.assign(b, {
      select: soi,
      eq: soi,
      order: soi,
      limit: soi,
      single: soi,
      insert: (l: Record<string, unknown>) => {
        ligne = { id: `id-${++etat.compteur}`, ...l };
        return b;
      },
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
        const executer = async () => {
          if (ligne) {
            (etat.tables[table] ??= []).push(ligne);
            return { data: ligne, error: null };
          }
          if (etat.retenue) await etat.retenue;
          return { data: [...(etat.tables[table] ?? [])], error: null };
        };
        return executer().then(ok, ko);
      },
    });
    return b;
  };

  return { etat, supabase: { from: requete, rpc: vi.fn() } };
});

vi.mock("../lib/supabase", () => ({ supabase: base.supabase }));

import { ajouterSiAbsente, useStoreData } from "./useStoreData";

afterEach(() => {
  cleanup();
  base.etat.tables = {};
  base.etat.retenue = null;
});

const monter = async () => {
  const rendu = renderHook(() => useStoreData("boutique-1", "moi"));
  await waitFor(() => expect(rendu.result.current.loading).toBe(false));
  return rendu;
};

describe("le rafraîchissement après un ajout", () => {
  it("ne relève pas l'écran de chargement", async () => {
    const { result } = await monter();

    let relacher!: () => void;
    base.etat.retenue = new Promise<void>((r) => (relacher = r));

    await act(async () => {
      await result.current.addSupplier({ nom: "Grossiste Analakely" });
    });

    // La relecture est en cours, et l'application reste affichée.
    expect(result.current.loading).toBe(false);

    await act(async () => relacher());
    expect(result.current.loading).toBe(false);
  });

  it("met la fiche créée dans la liste sans attendre la relecture", async () => {
    const { result } = await monter();
    base.etat.retenue = new Promise<void>(() => {}); // la relecture ne revient jamais

    let id: string | undefined;
    await act(async () => {
      const r = await result.current.addSupplier({ nom: "Grossiste Analakely" });
      id = r.supplier?.id;
    });

    expect(id).toBeTruthy();
    expect(result.current.suppliers.map((s) => s.id)).toContain(id);
  });

  it("fait de même pour les catégories, les clients et les personnes", async () => {
    const { result } = await monter();
    base.etat.retenue = new Promise<void>(() => {});

    await act(async () => {
      await result.current.addCategorie({ nom: "Quincaillerie", usage: "produit" });
      await result.current.addClient({ nom: "Rasoa" });
      await result.current.addPersonneExterne({ nom: "Lanto", telephone: "034" } as never);
    });

    expect(result.current.categories.map((c) => c.nom)).toContain("Quincaillerie");
    expect(result.current.clients.map((c) => c.nom)).toContain("Rasoa");
    expect(result.current.personnesExternes.map((p) => p.nom)).toContain("Lanto");
  });

  it("annonce bien le tout premier chargement", () => {
    base.etat.retenue = new Promise<void>(() => {});
    const { result } = renderHook(() => useStoreData("boutique-1", "moi"));
    expect(result.current.loading).toBe(true);
  });
});

describe("ajouterSiAbsente", () => {
  it("n'ajoute pas deux fois la même ligne", () => {
    const liste = [{ id: "a" }];
    expect(ajouterSiAbsente(liste, { id: "a" })).toBe(liste);
    expect(ajouterSiAbsente(liste, { id: "b" })).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
