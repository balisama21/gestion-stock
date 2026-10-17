/**
 * Lecture locale des fichiers d'import, dans le navigateur.
 *
 *   CSV / TXT          → analyseur maison (séparateur deviné, UTF-8 ou Windows-1252)
 *   XLSX / XLS / ODS   → SheetJS, chargé à la demande
 *   DOCX               → JSZip : tableaux Word lus tels quels, texte gardé pour l'IA
 *   PDF / images       → aucune lecture locale fiable : extraction par IA
 *
 * Rien ne quitte le poste à cette étape.
 */
import { analyserCsv, enTableau, type Cellule, type Tableau } from "./importDonnees";

export const TAILLE_MAX_FICHIER = 15 * 1024 * 1024;

export type NatureFichier = "csv" | "tableur" | "word" | "pdf" | "image" | "inconnu";

export function natureDuFichier(nom: string, mime = ""): NatureFichier {
  const ext = nom.toLowerCase().split(".").pop() ?? "";
  if (["csv", "txt", "tsv"].includes(ext)) return "csv";
  if (["xlsx", "xls", "xlsm", "ods"].includes(ext)) return "tableur";
  if (ext === "docx") return "word";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || mime.startsWith("image/"))
    return "image";
  return "inconnu";
}

export const MIME_IMAGE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export interface FichierLu {
  nature: NatureFichier;
  /** Feuilles disponibles (tableur) ; une seule pour les autres formats. */
  feuilles: { nom: string; tableau: Tableau }[];
  /** Texte brut (Word), utile à l'extraction IA quand il n'y a pas de tableau. */
  texte?: string;
}

/** Décode en UTF-8 ; si le fichier n'en est manifestement pas, en Windows-1252. */
export function decoderTexte(octets: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(octets);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(octets);
  } catch {
    return utf8;
  }
}

export async function lireTableur(octets: ArrayBuffer): Promise<FichierLu["feuilles"]> {
  const XLSX = await import("xlsx");
  const classeur = XLSX.read(octets, { type: "array", cellDates: false });
  return classeur.SheetNames.map((nom) => {
    const brut = XLSX.utils.sheet_to_json<Cellule[]>(classeur.Sheets[nom], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    return { nom, tableau: enTableau(brut) };
  });
}

/** Texte d'un nœud Word : runs <w:t>, tabulations et sauts conservés. */
function texteDuNoeud(noeud: Element): string {
  let t = "";
  const parcourir = (n: Element) => {
    for (const enfant of Array.from(n.children)) {
      const nom = enfant.localName;
      if (nom === "t") t += enfant.textContent ?? "";
      else if (nom === "tab") t += " ";
      else if (nom === "br" || nom === "cr") t += " ";
      else parcourir(enfant);
    }
  };
  parcourir(noeud);
  return t.replace(/\s+/g, " ").trim();
}

/** Tableaux et texte d'un document Word (.docx). */
export async function lireWord(
  octets: ArrayBuffer,
): Promise<{ tableaux: Tableau[]; texte: string }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(octets);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return { tableaux: [], texte: "" };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const tous = Array.from(doc.getElementsByTagNameNS("*", "tbl"));
  // Seuls les tableaux de premier niveau : un tableau imbriqué est lu
  // avec la cellule qui le contient.
  const tableaux = tous
    .filter((tbl) => !tous.some((autre) => autre !== tbl && autre.contains(tbl)))
    .map((tbl) => {
      const lignes = Array.from(tbl.children)
        .filter((e) => e.localName === "tr")
        .map((tr) =>
          Array.from(tr.children)
            .filter((e) => e.localName === "tc")
            .map((tc) => texteDuNoeud(tc) as Cellule),
        );
      return enTableau(lignes);
    })
    .filter((t) => t.lignes.length > 0);
  const paragraphes = Array.from(doc.getElementsByTagNameNS("*", "p")).map(texteDuNoeud);
  return { tableaux, texte: paragraphes.filter(Boolean).join("\n") };
}

export async function lireFichier(fichier: File): Promise<FichierLu> {
  if (fichier.size > TAILLE_MAX_FICHIER) {
    throw new Error("Fichier trop volumineux (15 Mo au maximum).");
  }
  const nature = natureDuFichier(fichier.name, fichier.type);
  const octets = await fichier.arrayBuffer();
  switch (nature) {
    case "csv":
      return {
        nature,
        feuilles: [{ nom: fichier.name, tableau: enTableau(analyserCsv(decoderTexte(octets))) }],
      };
    case "tableur":
      return { nature, feuilles: await lireTableur(octets) };
    case "word": {
      const { tableaux, texte } = await lireWord(octets);
      return {
        nature,
        feuilles: tableaux.map((tableau, i) => ({ nom: `Tableau ${i + 1}`, tableau })),
        texte,
      };
    }
    case "pdf":
    case "image":
      return { nature, feuilles: [] };
    default:
      throw new Error("Format non pris en charge. Utilisez CSV, Excel, Word, PDF ou une image.");
  }
}

/** Contenu base64 d'un fichier (pour l'extraction IA), sans préfixe. */
export async function enBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let binaire = "";
  const bloc = 0x8000;
  for (let i = 0; i < octets.length; i += bloc) {
    binaire += String.fromCharCode(...octets.subarray(i, i + bloc));
  }
  return btoa(binaire);
}
