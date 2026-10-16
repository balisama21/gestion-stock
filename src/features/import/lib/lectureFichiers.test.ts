import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { decoderTexte, lireFichier, lireWord, natureDuFichier } from "./lectureFichiers";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const cellule = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
const ligne = (...c: string[]) => `<w:tr>${c.map(cellule).join("")}</w:tr>`;

async function docx(corps: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document ${W}><w:body>${corps}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

/** Un File dont arrayBuffer() fonctionne aussi sous jsdom. */
function fichier(octets: ArrayBuffer | Uint8Array, nom: string): File {
  const f = new File([octets as BlobPart], nom);
  const copie = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  Object.defineProperty(f, "arrayBuffer", { value: async () => copie.slice().buffer });
  return f;
}

describe("lecture des fichiers", () => {
  it("reconnaît les formats", () => {
    expect(natureDuFichier("a.CSV")).toBe("csv");
    expect(natureDuFichier("a.xlsx")).toBe("tableur");
    expect(natureDuFichier("a.docx")).toBe("word");
    expect(natureDuFichier("a.pdf")).toBe("pdf");
    expect(natureDuFichier("scan.jpeg")).toBe("image");
    expect(natureDuFichier("a.exe")).toBe("inconnu");
  });

  it("lit un CSV en Windows-1252 sans abîmer les accents", () => {
    const octets = new Uint8Array([0x44, 0xe9, 0x73, 0x69, 0x67, 0x6e]); // « Désign » en 1252
    expect(decoderTexte(octets.buffer)).toBe("Désign");
  });

  it("lit les tableaux d'un document Word, et garde son texte", async () => {
    const r = await lireWord(
      await docx(
        `<w:p><w:r><w:t>Liste des prix</w:t></w:r></w:p><w:tbl>${ligne("Produit", "Prix")}${ligne("Riz", "1 000")}</w:tbl>`,
      ),
    );
    expect(r.tableaux).toEqual([{ entetes: ["Produit", "Prix"], lignes: [["Riz", "1 000"]] }]);
    expect(r.texte).toContain("Liste des prix");
  });

  it("lit un classeur Excel feuille par feuille", async () => {
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      classeur,
      XLSX.utils.aoa_to_sheet([
        ["Nom", "Tél"],
        ["Rabe", 341234567],
      ]),
      "Clients",
    );
    const octets = XLSX.write(classeur, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const lu = await lireFichier(fichier(octets, "clients.xlsx"));
    expect(lu.feuilles[0]).toEqual({
      nom: "Clients",
      tableau: { entetes: ["Nom", "Tél"], lignes: [["Rabe", 341234567]] },
    });
  });

  it("ne lit pas localement un PDF : il faudra l'IA", async () => {
    const lu = await lireFichier(fichier(new Uint8Array([37, 80, 68, 70]), "facture.pdf"));
    expect(lu).toEqual({ nature: "pdf", feuilles: [] });
  });

  it("refuse un format inconnu", async () => {
    await expect(lireFichier(fichier(new Uint8Array([1]), "x.exe"))).rejects.toThrow(/Format/);
  });
});
