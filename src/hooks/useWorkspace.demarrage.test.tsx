import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceState } from "./useWorkspace";
import { prechargerEspace } from "../lib/lectureEspace";

/*
 * Démarrage de l'espace de travail : la liste des boutiques arrive sans
 * leur logo (base64, jusqu'à 2 Mo chacun), et seul celui de la boutique
 * ouverte est lu, après coup.
 */

type Requete = { table: string; select: string; filtres: [string, unknown][] };

const db = vi.hoisted(() => ({ requetes: [] as Requete[] }));
const LOGO = "data:image/png;base64,AAAA";

function repondre(r: Requete, une: boolean) {
  if (r.table === "stores" && r.select === "logo_url")
    return { data: une ? { logo_url: LOGO } : [{ logo_url: LOGO }], error: null };
  if (r.table === "stores")
    return {
      data: [
        {
          id: "b1",
          name: "Boutique",
          owner_id: "u1",
          marque_id: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    };
  return { data: [], error: null };
}

vi.mock("../lib/supabase", () => ({
  retourGoogleAndroid: null,
  supabase: {
    from: (table: string) => {
      const r: Requete = { table, select: "", filtres: [] };
      db.requetes.push(r);
      const q: any = {
        select: (c: string) => ((r.select = c), q),
        eq: (k: string, v: unknown) => (r.filtres.push([k, v]), q),
        order: () => q,
        maybeSingle: async () => repondre(r, true),
        then: (ok: any, ko: any) => Promise.resolve(repondre(r, false)).then(ok, ko),
      };
      return q;
    },
    rpc: async () => ({ data: [], error: null }),
  },
}));

vi.mock("./useAuth", () => {
  const user = { id: "u1" };
  const profile = { is_platform_admin: false };
  return { useAuth: () => ({ user, profile }) };
});

beforeEach(() => {
  db.requetes = [];
  window.localStorage.clear();
});

const lectures = (table: string) =>
  db.requetes.filter((r) => r.table === table && r.select !== "logo_url");

it("lit les boutiques sans leur logo, puis le logo de la seule boutique ouverte", async () => {
  const { result } = renderHook(useWorkspaceState);
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.activeStore?.id).toBe("b1");
  for (const r of [...lectures("stores"), ...lectures("store_members")]) {
    expect(r.select).not.toContain("logo_url");
    expect(r.select).not.toMatch(/stores\(\*\)/);
    if (r.table === "stores") expect(r.select).not.toBe("*");
  }

  await waitFor(() => expect(result.current.activeStore?.logo_url).toBe(LOGO));
  const logos = db.requetes.filter((r) => r.select === "logo_url");
  expect(logos).toHaveLength(1);
  expect(logos[0].filtres).toEqual([["id", "b1"]]);
});

it("reprend la lecture préchargée au lieu d'en relancer une", async () => {
  prechargerEspace("u1");
  expect(lectures("stores")).toHaveLength(1);

  const { result } = renderHook(useWorkspaceState);
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.activeStore?.id).toBe("b1");
  expect(lectures("stores")).toHaveLength(1);
  expect(lectures("store_members")).toHaveLength(1);
});
