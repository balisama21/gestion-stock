/**
 * Parcours complet, du classeur aux écritures : un fichier Excel à trois
 * feuilles (produits avec quantités, clients, ventes) est lu, chaque
 * feuille reçoit sa destination, puis l'import envoie les bonnes écritures
 * — sans réseau : le client Supabase est simulé.
 */
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { lireFichier } from "./lib/lectureFichiers";
import {
  clesExistantes,
  detecterNature,
  devinerCorrespondance,
  preparerLignes,
  type CibleImport,
} from "./lib/importDonnees";
import { executerImport, OPTIONS_PAR_DEFAUT, type ContexteImport } from "./lib/executionImport";

function classeur(): File {
  const c = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    c,
    XLSX.utils.aoa_to_sheet([
      ["Inventaire au 15/10/2026"],
      ["Désignation", "Prix d'achat", "Prix de vente", "Qté", "Fournisseur"],
      ["Sac kraft 25 kg", "1 200", "1 800", 40, "Emballages SA"],
      ["Film étirable", 9000, 12000, 6, "Emballages SA"],
      ["Carton 40x30", "850,5", 1300, 120, ""],
    ]),
    "Stock",
  );
  XLSX.utils.book_append_sheet(
    c,
    XLSX.utils.aoa_to_sheet([
      ["Nom", "Prénom", "Téléphone", "Email"],
      ["Rabe", "Hery", "034 12 345 67", "hery@exemple.mg"],
    ]),
    "Clients",
  );
  XLSX.utils.book_append_sheet(
    c,
    XLSX.utils.aoa_to_sheet([
      ["Date", "Produit", "Qté", "Prix de vente", "Client"],
      ["01/10/2026", "Sac kraft 25 kg", 2, 1800, "Rabe"],
    ]),
    "Ventes",
  );
  const octets = XLSX.write(c, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const f = new File([octets], "inventaire.xlsx");
  Object.defineProperty(f, "arrayBuffer", { value: async () => octets.slice(0) });
  return f;
}

describe("import complet d'un classeur", () => {
  it("répartit les feuilles entre les modules, refuse les ventes, écrit stock et clients", async () => {
    const lu = await lireFichier(classeur());
    const detections = lu.feuilles.map((f) =>
      detecterNature(f.tableau.entetes, [f.nom, "inventaire.xlsx"]),
    );
    expect(detections.map((d) => d.nature)).toEqual(["produits", "clients", "ventes"]);

    const lots = lu.feuilles
      .map((f, i) => ({ f, nature: detections[i].nature }))
      .filter(
        (x): x is { f: (typeof lu.feuilles)[number]; nature: CibleImport } =>
          x.nature !== "ventes" && x.nature !== null,
      )
      .map(({ f, nature }) => ({
        cible: nature,
        source: f.nom,
        lignes: preparerLignes(
          f.tableau,
          devinerCorrespondance(f.tableau.entetes, nature),
          nature,
          clesExistantes(nature, []),
          3,
        ),
        options: { ...OPTIONS_PAR_DEFAUT },
      }));

    const ecritures: { cible: string; donnees: unknown }[] = [];
    const client = {
      rpc: vi.fn(async (nom: string, args: unknown) => {
        ecritures.push({ cible: nom, donnees: args });
        return { data: { id: `id-${ecritures.length}` }, error: null };
      }),
      from: vi.fn((table: string) => ({
        insert: async (donnees: unknown) => {
          ecritures.push({ cible: table, donnees });
          return { error: null };
        },
      })),
    } as unknown as ContexteImport["client"];

    const r = await executerImport(lots, {
      client,
      storeId: "boutique-a",
      userId: "u1",
      empreinte: "e",
      nomFichier: "inventaire.xlsx",
      existants: { produits: [], fournisseurs: [] },
    });

    // Fournisseur cité créé une fois, puis les trois produits avec leur stock.
    expect(ecritures.map((e) => e.cible)).toEqual([
      "suppliers",
      "create_product",
      "create_product",
      "create_product",
      "clients",
    ]);
    const produits = ecritures.filter((e) => e.cible === "create_product").map((e) => e.donnees);
    expect(produits).toEqual([
      expect.objectContaining({
        p_store_id: "boutique-a",
        p_designation: "Sac kraft 25 kg",
        p_prix_achat: 1200,
        p_prix_vente_defaut: 1800,
        p_stock_initial: 40,
        p_fournisseur: "Emballages SA",
      }),
      expect.objectContaining({ p_designation: "Film étirable", p_stock_initial: 6 }),
      expect.objectContaining({
        p_designation: "Carton 40x30",
        p_prix_achat: 850.5,
        p_stock_initial: 120,
      }),
    ]);
    expect(ecritures.at(-1)?.donnees).toEqual([
      expect.objectContaining({
        store_id: "boutique-a",
        nom: "Rabe",
        prenom: "Hery",
        telephone: "0341234567",
        email: "hery@exemple.mg",
      }),
    ]);
    expect(r.bilans).toEqual([
      { module: "fournisseurs", ajoutes: 1, mis_a_jour: 0, ignores: 0, rejetes: 0 },
      { module: "produits", ajoutes: 3, mis_a_jour: 0, ignores: 0, rejetes: 0 },
      { module: "clients", ajoutes: 1, mis_a_jour: 0, ignores: 0, rejetes: 0 },
    ]);
  });
});
