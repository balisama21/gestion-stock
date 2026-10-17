/**
 * LE MODÈLE EXCEL LIVRÉ AVEC LE MANUEL S'IMPORTE TEL QUEL.
 *
 * docs/manuel-utilisation/Modele_import_*.xlsx promet à l'utilisateur
 * qu'il peut remplir le classeur puis le donner au bouton « Importer »,
 * sans conversion. Ces tests passent le fichier réellement livré par le
 * lecteur et le détecteur de l'assistant : si l'un ou l'autre change,
 * le modèle et le manuel doivent suivre.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { lireTableur } from "./lib/lectureFichiers";
import {
  SCHEMAS_IMPORT,
  detecterNature,
  devinerCorrespondance,
  type CibleImport,
} from "./lib/importDonnees";

const MODELES = ["Modele_import_Tantana_Suite.xlsx", "Modele_import_Kinvest.xlsx"];

// Vitest s'exécute à la racine du projet.
const ouvrir = (nom: string) =>
  readFileSync(resolve(process.cwd(), "docs/manuel-utilisation", nom));

/** Une ligne d'exemple par feuille, écrite sous l'en-tête (ligne 3). */
const EXEMPLES: Record<string, (string | number)[]> = {
  Produits: ["Ciment 50 kg", "Gris", 32000, 36000, 40, 5, "Grossiste Analakely"],
  Clients: ["Rakoto", "Jean", "Rakoto BTP", "034 00 000 01", "a@b.mg", "Lot II", "Tana", ""],
  Fournisseurs: ["Grossiste Analakely", "", "032 00 000 02", "", "", "Toamasina", ""],
  Achats: ["15/10/2026", "Ciment 50 kg", "", 20, 32000, "Grossiste Analakely", "", ""],
};

const ATTENDU: Record<string, CibleImport> = {
  Produits: "produits",
  Clients: "clients",
  Fournisseurs: "fournisseurs",
  Achats: "achats",
};

function remplir(octets: Buffer): ArrayBuffer {
  const classeur = XLSX.read(octets, { type: "buffer" });
  for (const [feuille, ligne] of Object.entries(EXEMPLES)) {
    XLSX.utils.sheet_add_aoa(classeur.Sheets[feuille], [ligne], { origin: "A3" });
  }
  const sortie = XLSX.write(classeur, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return sortie;
}

describe.each(MODELES)("%s", (nom) => {
  it("vide, ne propose rien à importer : ni le mode d'emploi, ni les feuilles vides", async () => {
    // Copie dans un tableau du test : l'ArrayBuffer de Node n'est pas
    // celui de l'environnement jsdom, et la lecture le prendrait pour du texte.
    const feuilles = await lireTableur(Uint8Array.from(ouvrir(nom)).buffer);
    expect(feuilles.map((f) => f.nom)).toEqual([
      "Lisez-moi",
      "Produits",
      "Clients",
      "Fournisseurs",
      "Achats",
    ]);
    // Une feuille sans ligne de données est écartée par l'assistant.
    for (const f of feuilles) expect(f.tableau.lignes).toHaveLength(0);
  });

  it("rempli, envoie chaque feuille au bon module avec toutes ses colonnes", async () => {
    const feuilles = await lireTableur(remplir(ouvrir(nom)));
    const lisibles = feuilles.filter((f) => f.tableau.lignes.length > 0);
    expect(lisibles.map((f) => f.nom)).toEqual(Object.keys(EXEMPLES));

    for (const f of lisibles) {
      const cible = ATTENDU[f.nom];
      const detection = detecterNature(f.tableau.entetes, [f.nom, nom]);
      expect(detection.nature, f.nom).toBe(cible);
      expect(detection.ambigu, f.nom).toBe(false);

      // Chaque colonne du modèle est reconnue, sans correspondance à la main.
      const corr = devinerCorrespondance(f.tableau.entetes, cible);
      for (const champ of SCHEMAS_IMPORT[cible]) {
        expect(corr[champ.cle], `${f.nom} › ${champ.libelle}`).not.toBeNull();
      }
    }
  });
});
