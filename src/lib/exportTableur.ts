/**
 * TÉLÉCHARGER UNE LISTE POUR LA RETRAVAILLER.
 *
 * Le PDF part chez le fournisseur ; ce fichier-ci sert à l'autre usage,
 * celui du commerçant qui veut trier, ajuster les quantités ou coller
 * la liste ailleurs.
 *
 * ── Deux formats, et pourquoi les deux ──
 *
 * Le CSV s'ouvre partout, y compris dans des outils qui ne lisent rien
 * d'autre. Le tableur (.xlsx) garde les nombres comme des nombres : on
 * peut additionner une colonne sans rien reformater, ce qui est
 * précisément ce qu'on vient faire.
 *
 * ── Les deux pièges du CSV français, et comment on les évite ──
 *
 * LE SÉPARATEUR. Excel en configuration française attend le
 * point-virgule et non la virgule. Un fichier séparé par des virgules
 * s'ouvre alors en UNE colonne, et le commerçant conclut que l'export
 * est cassé.
 *
 * L'ENCODAGE. Sans marque d'ordre des octets en tête, Excel lit le
 * fichier dans le codage de la machine et « Référence » devient
 * « RÃ©fÃ©rence ». Trois octets réglent cinquante ans d'histoire.
 */

const SEPARATEUR = ";";
/** La marque d'ordre des octets, que Excel réclame pour lire de l'UTF-8. */
const BOM = "﻿";

const telechargerBlob = (blob: Blob, nom: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Révoqué après coup : certains navigateurs lisent l'URL de façon
  // asynchrone et récupéreraient un objet déjà libéré.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export type CelluleTableur = string | number | null;

/**
 * Une cellule de CSV.
 *
 * On n'entoure de guillemets que ce qui l'exige — un séparateur, un
 * guillemet, un retour à la ligne. Le reste sort nu, ce qui rend le
 * fichier lisible quand on l'ouvre dans un éditeur de texte pour
 * vérifier.
 */
const cellule = (v: CelluleTableur): string => {
  if (v === null || v === undefined) return "";
  const texte = String(v);
  return /["\n\r;,]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

/**
 * Le contenu du fichier, marque d'ordre des octets comprise.
 *
 * Séparé du téléchargement pour être vérifiable : le séparateur et la
 * marque d'octets sont tout l'intérêt de cette fonction, et un
 * navigateur n'est pas nécessaire pour les contrôler.
 */
export function composerCsv(entetes: readonly string[], lignes: CelluleTableur[][]): string {
  const contenu = [entetes, ...lignes].map((l) => l.map(cellule).join(SEPARATEUR)).join("\r\n");
  return BOM + contenu;
}

export function telechargerCsv(
  nomDeFichier: string,
  entetes: readonly string[],
  lignes: CelluleTableur[][],
): void {
  telechargerBlob(
    new Blob([composerCsv(entetes, lignes)], { type: "text/csv;charset=utf-8;" }),
    `${nomDeFichier}.csv`,
  );
}

/**
 * Le même contenu, en classeur.
 *
 * La bibliothèque est chargée À LA DEMANDE : elle pèse quelques
 * centaines de kilooctets, et personne ne doit les payer sans avoir
 * cliqué. C'est le même procédé que l'export PDF.
 */
export async function telechargerTableur(
  nomDeFichier: string,
  nomDeFeuille: string,
  entetes: readonly string[],
  lignes: CelluleTableur[][],
): Promise<void> {
  const XLSX = await import("xlsx");
  const feuille = XLSX.utils.aoa_to_sheet([[...entetes], ...lignes]);

  // Des colonnes à la largeur du contenu : sans cela, « Quantité
  // suggérée » arrive tronqué et il faut élargir à la main avant de
  // pouvoir lire quoi que ce soit.
  feuille["!cols"] = entetes.map((titre, i) => ({
    wch: Math.min(
      40,
      Math.max(titre.length + 2, ...lignes.map((l) => String(l[i] ?? "").length + 2)),
    ),
  }));

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, nomDeFeuille.slice(0, 31));
  XLSX.writeFile(classeur, `${nomDeFichier}.xlsx`);
}
