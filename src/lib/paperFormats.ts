/**
 * Formats de papier proposés à l'impression et au téléchargement.
 *
 * Le parc d'imprimantes d'une boutique se répartit en deux familles, qui
 * n'ont ni la même largeur ni la même mise en page :
 *
 * — les imprimantes bureautiques, en A4, A5 ou Letter, sur lesquelles on
 *   sort une facture en bonne et due forme, avec un tableau d'articles ;
 * — les imprimantes thermiques de caisse, en rouleau de 80 mm ou 58 mm,
 *   où un tableau à quatre colonnes est illisible et où le ticket
 *   s'écrit en pleine largeur, ligne après ligne.
 *
 * La hauteur d'un rouleau est indéterminée : `auto` laisse le pilote
 * couper au bout du contenu, ce qu'aucune hauteur fixe ne saurait faire
 * sans gaspiller du papier ou tronquer le ticket.
 */

export type PaperFormatId = "a4" | "a5" | "letter" | "t80" | "t58";

export type DocumentLayout = "invoice" | "ticket";

export interface PaperFormat {
  id: PaperFormatId;
  /** Libellé court, affiché sur le sélecteur. */
  label: string;
  /** Précision affichée sous le libellé. */
  hint: string;
  layout: DocumentLayout;
  /**
   * Largeur utile en pixels à 96 ppp, marges déduites. Elle donne à
   * l'aperçu écran exactement la largeur qu'aura le papier : ce qu'on
   * voit est ce qui s'imprime, y compris les retours à la ligne.
   */
  previewWidth: number;
  /** Largeur du papier, en millimètres. */
  widthMm: number;
  /**
   * Hauteur du papier en millimètres, ou `null` pour un rouleau : sa
   * hauteur suit le contenu, personne ne coupe un ticket à l avance.
   */
  heightMm: number | null;
  /** Marge d impression, en millimètres. */
  marginMm: number;
}

/** Conversion millimètres → pixels CSS, à 96 points par pouce. */
const mm = (v: number) => Math.round((v * 96) / 25.4);

export const PAPER_FORMATS: PaperFormat[] = [
  {
    id: "a4",
    widthMm: 210,
    heightMm: 297,
    marginMm: 12,
    label: "A4",
    hint: "210 × 297 mm — facture standard",
    layout: "invoice",
    previewWidth: mm(210 - 24), // marges de 12 mm
  },
  {
    id: "a5",
    widthMm: 148,
    heightMm: 210,
    marginMm: 10,
    label: "A5",
    hint: "148 × 210 mm — facture compacte",
    layout: "invoice",
    previewWidth: mm(148 - 20), // marges de 10 mm
  },
  {
    id: "letter",
    widthMm: 216,
    heightMm: 279,
    marginMm: 12,
    label: "Letter",
    hint: "216 × 279 mm — format nord-américain",
    layout: "invoice",
    previewWidth: mm(216 - 24),
  },
  {
    id: "t80",
    widthMm: 80,
    heightMm: null,
    marginMm: 3,
    label: "Ticket 80 mm",
    hint: "Imprimante thermique de caisse",
    layout: "ticket",
    previewWidth: mm(80 - 6), // marges de 3 mm
  },
  {
    id: "t58",
    widthMm: 58,
    heightMm: null,
    marginMm: 2,
    label: "Ticket 58 mm",
    hint: "Imprimante thermique compacte",
    layout: "ticket",
    previewWidth: mm(58 - 4), // marges de 2 mm
  },
];

export const getPaperFormat = (id: PaperFormatId): PaperFormat =>
  PAPER_FORMATS.find((f) => f.id === id) ?? PAPER_FORMATS[0];

/**
 * Traduit l'ancienne préférence « ticket ou facture », qui ne connaissait
 * que deux valeurs, vers un format de papier concret. Les réglages déjà
 * enregistrés chez les utilisateurs restent donc valables.
 */
export const paperFromLegacyFormat = (format: "ticket" | "facture"): PaperFormatId =>
  format === "facture" ? "a4" : "t80";
