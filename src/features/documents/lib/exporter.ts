import { capturer } from "../../../lib/documentExport";

/**
 * LE PDF D'UN DOCUMENT QUI TIENT SUR PLUSIEURS FEUILLES
 *
 * ── POURQUOI PAS `exporterPdf` DE L'APPLICATION ────────────────────
 *
 * Elle photographie UN bloc, et si l'image dépasse la page, elle la
 * débite en tranches de la hauteur d'une feuille. La coupure tombe
 * alors où elle tombe : au milieu d'un montant, entre le libellé
 * d'une ligne et son prix.
 *
 * Ici les pages existent déjà — c'est `repartirLesPages` qui a décidé
 * où couper, et chaque feuille est un élément du DOM. Il suffit donc
 * de photographier chaque feuille et d'en faire une page. Aucune
 * coupure n'est laissée au hasard, et le PDF est exactement ce que
 * l'aperçu montre, page par page.
 *
 * La fonction de l'application reste en service pour les documents de
 * la v1, qui n'ont pas de pagination à eux.
 */

/** A4, en millimètres. Les marges sont dans la feuille, pas dans la page. */
const A4 = { largeur: 210, hauteur: 297 };

const telecharger = (blob: Blob, nom: string) => {
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
 * Enregistre les feuilles en un seul PDF, une feuille par page.
 *
 * La qualité JPEG est à 0,95 : au-delà, le fichier double de poids
 * sans qu'aucun œil ne voie la différence sur du texte noir.
 */
export async function exporterFeuillesPdf(
  feuilles: HTMLElement[],
  nomDeFichier: string,
): Promise<void> {
  if (feuilles.length === 0) return;

  const [{ jsPDF }, ...canevas] = await Promise.all([
    import("jspdf"),
    ...feuilles.map((f) => capturer(f)),
  ]);

  const doc = new jsPDF({
    unit: "mm",
    format: [A4.largeur, A4.hauteur],
    orientation: "portrait",
  });

  canevas.forEach((canvas, i) => {
    if (i > 0) doc.addPage();
    /*
     * La feuille est posée bord à bord. Sa hauteur est calculée sur
     * son propre rapport et non forcée à 297 mm : une feuille qui
     * aurait légèrement débordé — une ligne plus haute qu'une page,
     * le seul cas que le découpage ne peut pas éviter — sortirait
     * écrasée si on la forçait.
     */
    const hauteur = A4.largeur * (canvas.height / canvas.width);
    doc.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      0,
      A4.largeur,
      Math.min(hauteur, A4.hauteur),
    );
  });

  doc.save(`${nomDeFichier}.pdf`);
}

/**
 * Enregistre les feuilles en images.
 *
 * Une image par page, numérotées quand il y en a plusieurs : une
 * facture de trois pages envoyée par messagerie doit arriver en trois
 * morceaux nommés dans l'ordre, sinon personne ne sait les remettre.
 */
export async function exporterFeuillesImage(
  feuilles: HTMLElement[],
  nomDeFichier: string,
): Promise<void> {
  for (let i = 0; i < feuilles.length; i++) {
    const canvas = await capturer(feuilles[i]);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("L'image n'a pas pu être produite.");
    const suffixe = feuilles.length > 1 ? `_${i + 1}sur${feuilles.length}` : "";
    telecharger(blob, `${nomDeFichier}${suffixe}.png`);
  }
}
