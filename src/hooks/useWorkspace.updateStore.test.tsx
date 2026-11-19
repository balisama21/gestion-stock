import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWorkspaceState } from "./useWorkspace";

/*
 * Enregistrement d'une boutique : le logo ne revient dans la réponse que
 * s'il vient d'être changé. Sinon, corriger un numéro de téléphone faisait
 * redescendre toute l'image.
 */

type Requete = { table: string; select: string; update: unknown; filtres: [string, unknown][] };

const db = vi.hoisted(() => ({ requetes: [] as Requete[] }));
const LOGO = "data:image/png;base64,AAAA";
const NOUVEAU_LOGO = "data:image/webp;base64,BBBB";

const BOUTIQUE = {
  id: "b1",
  name: "Boutique",
  phone: "",
  owner_id: "u1",
  marque_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

function repondre(r: Requete, une: boolean) {
  if (r.table === "stores" && r.update) {
    const ligne: Record<string, unknown> = { ...BOUTIQUE, ...(r.update as object) };
    // Comme PostgREST : seules les colonnes demandées reviennent.
    if (!r.select.split(",").includes("logo_url")) delete ligne.logo_url;
    return { data: ligne, error: null };
  }
  if (r.table === "stores" && r.select === "logo_url")
    return { data: une ? { logo_url: LOGO } : [{ logo_url: LOGO }], error: null };
  if (r.table === "stores") return { data: [BOUTIQUE], error: null };
  return { data: [], error: null };
}

vi.mock("../lib/supabase", () => ({
  retourGoogleAndroid: null,
  supabase: {
    from: (table: string) => {
      const r: Requete = { table, select: "", update: null, filtres: [] };
      db.requetes.push(r);
      const q: any = {
        select: (c: string) => ((r.select = c), q),
        update: (u: unknown) => ((r.update = u), q),
        eq: (k: string, v: unknown) => (r.filtres.push([k, v]), q),
        order: () => q,
        single: async () => repondre(r, true),
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

const ecritures = () => db.requetes.filter((r) => r.table === "stores" && r.update);

async function ouvrir() {
  const hook = renderHook(useWorkspaceState);
  await waitFor(() => expect(hook.result.current.activeStore?.logo_url).toBe(LOGO));
  return hook;
}

it("ne redemande pas le logo quand il n'a pas changé, et le garde affiché", async () => {
  const { result } = await ouvrir();

  let res: any;
  await act(async () => {
    res = await result.current.updateStore("b1", { phone: "034 00 000 00" });
  });

  expect(res.error).toBeNull();
  const [ecriture] = ecritures();
  expect(ecriture.select).not.toContain("logo_url");
  expect(ecriture.select).not.toBe("*");
  expect(result.current.activeStore?.phone).toBe("034 00 000 00");
  expect(result.current.activeStore?.logo_url).toBe(LOGO);
  expect(res.store.logo_url).toBe(LOGO);
});

it("renvoie et affiche le nouveau logo quand il vient d'être changé", async () => {
  const { result } = await ouvrir();

  await act(async () => {
    await result.current.updateStore("b1", { logo_url: NOUVEAU_LOGO });
  });

  const [ecriture] = ecritures();
  expect(ecriture.select.split(",")).toContain("logo_url");
  expect(result.current.activeStore?.logo_url).toBe(NOUVEAU_LOGO);
  // La liste des boutiques reste sans logo, comme au démarrage.
  expect(result.current.accessibleStores.find((s) => s.id === "b1")?.logo_url).toBeUndefined();
});
