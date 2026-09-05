import type { PaperFormat } from "./paperFormats";

/**
 * Export d'un document imprimable — PDF ou image.
 *
 * La version précédente redessinait la facture en coordonnées avec
 * jsPDF. Elle avait beau produire un beau fichier, elle souffrait d'un
 * défaut qu'aucune correction ponctuelle ne pouvait guérir : c'était une
 * SECONDE mise en page. Tout ce qui n'y était pas reporté à l'identique
 * divergeait de l'aperçu, et les deux dérivaient à chaque modification.
 * Un exemple concret : `Intl.NumberFormat("fr-FR")` sépare les milliers
 * par U+202F, l'espace fine insécable ; jsPDF encode en WinAnsi sur un
 * octet, et 0x202F tronqué donne 0x2F — le caractère « / ». Les montants
 * sortaient en « 6/500 Ar » alors que l'écran affichait « 6 500 Ar ».
 *
 * On ne redessine donc plus rien : on photographie le document tel que
 * le navigateur l'affiche, et cette image devient le PDF. Ce que
 * l'utilisateur voit est, au pixel près, ce qu'il télécharge — polices,
 * espacements, couleurs et formats de nombres compris, puisque c'est le
 * même rendu.
 *
 * Le prix de ce choix, assumé : le PDF contient une image et non du
 * texte sélectionnable, et pèse quelques centaines de kilooctets au lieu
 * de huit. En échange, la fidélité n'est plus une promesse à tenir mais
 * une propriété du procédé.
 *
 * Les deux bibliothèques sont chargées à la demande : personne ne paie
 * ces kilooctets sans avoir cliqué.
 */

export type FormatExport = "pdf" | "png" | "jpg";

/** Densité de capture. 3× donne ~220 ppp sur une A4 : net à l'impression. */
const ECHELLE = 3;

/** Millimètres → pixels CSS, à 96 points par pouce. */
const mmEnPx = (mm: number) => (mm * 96) / 25.4;

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

/**
 * Photographie le document. Le fond est forcé en blanc : l'élément est
 * transparent par endroits, et une capture transparente donnerait un PDF
 * au fond noir chez certains lecteurs.
 */
async function capturer(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(element, {
    scale: ECHELLE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

/**
 * Enregistre le document en image.
 *
 * L'image reprend exactement les proportions de l'aperçu — un ticket
 * reste étroit, une facture reste au format d'une feuille — ce qui est
 * précisément ce qu'on veut pour l'envoyer par messagerie.
 */
export async function exporterImage(
  element: HTMLElement,
  fileName: string,
  type: "png" | "jpg" = "png",
): Promise<void> {
  const canvas = await capturer(element);
  const mime = type === "jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, type === "jpg" ? 0.92 : undefined),
  );
  if (!blob) throw new Error("L'image n'a pas pu être produite.");
  telechargerBlob(blob, `${fileName}.${type}`);
}

/**
 * Enregistre le document en PDF, au format de papier choisi.
 *
 * La capture est posée sur toute la largeur utile de la page. Deux cas
 * pour la hauteur :
 *
 * — un rouleau thermique n'a pas de hauteur prédéfinie : la page prend
 *   exactement celle du contenu, donc une seule page et pas un
 *   millimètre de papier gaspillé ;
 * — une feuille a une hauteur fixe : si le document la dépasse, l'image
 *   est découpée en tranches, une par page. La coupure tombe où elle
 *   tombe — c'est le défaut inhérent à une capture — mais le contenu
 *   n'est jamais perdu.
 */
export async function exporterPdf(
  element: HTMLElement,
  paper: PaperFormat,
  fileName: string,
): Promise<void> {
  const [{ jsPDF }, canvas] = await Promise.all([import("jspdf"), capturer(element)]);

  const largeurUtileMm = paper.widthMm - 2 * paper.marginMm;
  const ratio = canvas.height / canvas.width;
  const hauteurImageMm = largeurUtileMm * ratio;

  // Rouleau : une page à la taille exacte du contenu.
  if (paper.heightMm === null) {
    const hauteurPageMm = hauteurImageMm + 2 * paper.marginMm;
    const doc = new jsPDF({
      unit: "mm",
      format: [paper.widthMm, hauteurPageMm],
      orientation: "portrait",
    });
    doc.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      paper.marginMm,
      paper.marginMm,
      largeurUtileMm,
      hauteurImageMm,
    );
    doc.save(`${fileName}.pdf`);
    return;
  }

  const hauteurUtileMm = paper.heightMm - 2 * paper.marginMm;
  const doc = new jsPDF({
    unit: "mm",
    format: [paper.widthMm, paper.heightMm],
    orientation: "portrait",
  });

  // Le document tient sur une page : cas de loin le plus courant.
  if (hauteurImageMm <= hauteurUtileMm + 0.5) {
    doc.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      paper.marginMm,
      paper.marginMm,
      largeurUtileMm,
      hauteurImageMm,
    );
    doc.save(`${fileName}.pdf`);
    return;
  }

  // Document long : on découpe la capture en tranches de la hauteur
  // d'une page. Chaque tranche est redessinée dans un canevas
  // intermédiaire, faute de quoi `addImage` recadrerait l'original.
  const pxParMm = canvas.width / largeurUtileMm;
  const hauteurTranchePx = Math.floor(hauteurUtileMm * pxParMm);
  const pages = Math.ceil(canvas.height / hauteurTranchePx);

  for (let i = 0; i < pages; i++) {
    if (i > 0) doc.addPage();
    const debut = i * hauteurTranchePx;
    const hauteur = Math.min(hauteurTranchePx, canvas.height - debut);

    const tranche = document.createElement("canvas");
    tranche.width = canvas.width;
    tranche.height = hauteur;
    const ctx = tranche.getContext("2d");
    if (!ctx) throw new Error("Le navigateur n'a pas pu préparer la page.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tranche.width, tranche.height);
    ctx.drawImage(canvas, 0, debut, canvas.width, hauteur, 0, 0, canvas.width, hauteur);

    doc.addImage(
      tranche.toDataURL("image/jpeg", 0.95),
      "JPEG",
      paper.marginMm,
      paper.marginMm,
      largeurUtileMm,
      hauteur / pxParMm,
    );
  }

  doc.save(`${fileName}.pdf`);
}

/**
 * Lance l'impression au format de papier choisi.
 *
 * La taille de page est injectée juste avant l'appel plutôt que déclarée
 * en pages nommées. Les pages nommées avaient un effet de bord coûteux :
 * un élément dont le nom de page diffère du contexte courant force un
 * saut, et le document sortait précédé d'une page blanche. Une règle
 * `@page` unique, posée le temps de l'impression, ne pose pas ce
 * problème.
 */
export function imprimerDocument(paper: PaperFormat): void {
  const taille =
    paper.heightMm === null
      ? `${paper.widthMm}mm auto`
      : `${paper.widthMm}mm ${paper.heightMm}mm`;

  const style = document.createElement("style");
  style.id = "format-impression";
  style.textContent = `@media print { @page { size: ${taille}; margin: ${paper.marginMm}mm; } }`;
  document.head.appendChild(style);

  try {
    window.print();
  } finally {
    style.remove();
  }
}

/** Nom de fichier sans caractère qu'un système de fichiers refuserait. */
export function nomDeFichier(...parties: (string | number)[]): string {
  return parties
    .join("_")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}
