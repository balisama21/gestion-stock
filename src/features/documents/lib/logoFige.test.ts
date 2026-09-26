import { beforeEach, describe, expect, it, vi } from "vitest";

const stockage = vi.hoisted(() => ({
  fichiers: new Map<string, Blob>(),
  list: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: stockage.list,
        upload: stockage.upload,
        download: stockage.download,
      }),
    },
  },
}));

import {
  decoderDataUrl,
  empreinte,
  lireLogo,
  lireLogoCopie,
  logoDeLaCopie,
  preparerLogo,
} from "./logoFige";
import { figer, lireCopieFigee } from "./copieFigee";
import { REGLAGES_DOCUMENTS_PAR_DEFAUT } from "./reglages";
import { BOUTIQUE } from "./fixtures";

const BOUTIQUE_ID = "43fc454f-ae66-48cd-af23-a46c0857a527";
// Un PNG d'un pixel.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const attendre = () => new Promise((ok) => setTimeout(ok, 20));

beforeEach(() => {
  stockage.fichiers.clear();
  stockage.list.mockReset().mockImplementation(async (dossier: string, o: { search: string }) => ({
    data: [...stockage.fichiers.keys()]
      .filter((c) => c.startsWith(`${dossier}/`) && c.includes(o.search))
      .map((c) => ({ name: c.split("/")[1] })),
    error: null,
  }));
  stockage.upload.mockReset().mockImplementation(async (chemin: string, blob: Blob) => {
    stockage.fichiers.set(chemin, blob);
    return { error: null };
  });
  stockage.download.mockReset().mockImplementation(async (chemin: string) => {
    const b = stockage.fichiers.get(chemin);
    return b ? { data: b, error: null } : { data: null, error: { message: "introuvable" } };
  });
});

describe("l'empreinte et le décodage", () => {
  it("SHA-256, en hexadécimal", async () => {
    expect(await empreinte(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("lit une data URL d'image, en base64 ou en clair", () => {
    expect(decoderDataUrl(PNG)?.type).toBe("image/png");
    expect(decoderDataUrl(PNG)?.octets.slice(1, 4)).toEqual(new Uint8Array([80, 78, 71]));
    const svg = decoderDataUrl("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E");
    expect(new TextDecoder().decode(svg!.octets)).toBe("<svg></svg>");
    expect(decoderDataUrl("data:text/html;base64,PGgxPg==")).toBeNull();
  });
});

describe("figer le logo à l'émission", () => {
  it("range chaque version une seule fois, sous son empreinte", async () => {
    const a = await preparerLogo(BOUTIQUE_ID, PNG);
    await attendre();
    const b = await preparerLogo(BOUTIQUE_ID, PNG);
    await attendre();
    expect(a).toEqual(b);
    expect(a).toMatchObject({
      chemin: expect.stringMatching(new RegExp(`^${BOUTIQUE_ID}/[0-9a-f]{64}\\.png$`)),
    });
    expect(stockage.upload).toHaveBeenCalledTimes(1);
  });

  it("ne renvoie pas un logo déjà rangé par un autre appareil", async () => {
    const d = decoderDataUrl(PNG)!;
    const e = await empreinte(d.octets);
    stockage.fichiers.set(`${BOUTIQUE_ID}/${e}.png`, new Blob([d.octets as BlobPart]));
    await preparerLogo("0b6c1f7e-9a0e-4b7a-9d7c-2f1e8f3a4b5c", PNG);
    await attendre();
    await preparerLogo(BOUTIQUE_ID, PNG);
    await attendre();
    expect(stockage.upload.mock.calls.map((c) => c[0])).not.toContain(`${BOUTIQUE_ID}/${e}.png`);
  });

  it("sans logo : la pièce portait ses initiales ; hébergé ailleurs : son adresse", async () => {
    expect(await preparerLogo(BOUTIQUE_ID, "")).toEqual({ aucun: true });
    expect(await preparerLogo(BOUTIQUE_ID, "https://exemple.mg/logo.png")).toEqual({
      url: "https://exemple.mg/logo.png",
    });
  });
});

describe("relire le logo d'une copie", () => {
  it("rend l'image rangée", async () => {
    const logo = (await preparerLogo(BOUTIQUE_ID, PNG)) as { chemin: string; empreinte: string };
    await attendre();
    const d = decoderDataUrl(PNG)!;
    stockage.fichiers.set(logo.chemin, new Blob([d.octets as BlobPart], { type: d.type }));
    expect(await lireLogo(logo)).toBe(PNG);
  });

  it("refuse un fichier qui ne correspond pas à son empreinte", async () => {
    const logo = (await preparerLogo(BOUTIQUE_ID, PNG)) as { chemin: string; empreinte: string };
    await attendre();
    stockage.fichiers.set(logo.chemin, new Blob(["autre chose"], { type: "image/png" }));
    const falsifie = { ...logo, chemin: logo.chemin.replace(".png", ".jpg") };
    stockage.fichiers.set(falsifie.chemin, new Blob(["autre chose"], { type: "image/png" }));
    expect(await lireLogo(falsifie)).toBeNull();
    expect(await logoDeLaCopie(falsifie)).toBeUndefined();
  });

  it("« aucun » redonne une pièce sans logo ; une copie muette garde celui du moment", async () => {
    expect(await logoDeLaCopie({ aucun: true })).toBe("");
    expect(await logoDeLaCopie(undefined)).toBeUndefined();
  });

  it("n'accepte pas un chemin qui ne porte pas son empreinte", () => {
    const e = "a".repeat(64);
    expect(lireLogoCopie({ chemin: `${BOUTIQUE_ID}/${e}.png`, empreinte: e })).toBeDefined();
    expect(lireLogoCopie({ chemin: `${BOUTIQUE_ID}/autre.png`, empreinte: e })).toBeUndefined();
    expect(lireLogoCopie({ url: "javascript:alert(1)" })).toBeUndefined();
  });
});

describe("dans la copie figée", () => {
  it("le logo voyage avec la copie, sans son image", async () => {
    const logo = await preparerLogo(BOUTIQUE_ID, PNG);
    const copie = JSON.parse(
      JSON.stringify(
        figer(
          REGLAGES_DOCUMENTS_PAR_DEFAUT,
          { ...BOUTIQUE, logoUrl: PNG },
          "facture",
          "2026-09-26",
          logo,
        ),
      ),
    );
    expect(JSON.stringify(copie)).not.toContain("iVBORw0KGgo");
    expect(lireCopieFigee(copie, REGLAGES_DOCUMENTS_PAR_DEFAUT, "facture")?.logo).toEqual(logo);
  });
});
