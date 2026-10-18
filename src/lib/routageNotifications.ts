import type { ActiveTab } from "../types";
import type { Notification } from "./activite";

/**
 * OÙ MÈNE UNE NOTIFICATION — la règle, écrite une seule fois.
 *
 * Trois cas, du plus précis au plus large :
 *
 * 1. Elle parle d'UN enregistrement (`cibleId`) et l'écran sait ouvrir
 *    une fiche : on ouvre la fiche. La recherche de l'écran est vidée,
 *    pour qu'un filtre resté d'une visite précédente ne masque pas la
 *    liste derrière. Si la fiche n'existe plus, l'écran le dit.
 * 2. Elle parle d'un ENSEMBLE (`filtre`, « 3 produits sous le seuil ») :
 *    l'écran s'ouvre avec ce filtre posé.
 * 3. Sinon, l'écran s'ouvre, sa recherche remplie sur la référence s'il
 *    y en a une, vidée sinon.
 *
 * Une notification sans écran ne mène nulle part, et c'est voulu : elle
 * s'affiche sans chevron.
 */
export const ECRANS_AVEC_FICHE: ReadonlySet<ActiveTab> = new Set<ActiveTab>([
  "ventes",
  "achats",
  "depenses",
  "produits",
  "clients",
  "devis",
  "livraisons",
  "commandes",
  "capital",
]);

export interface Destination {
  onglet: ActiveTab;
  /** Ce qu'on pose dans la recherche de l'écran ; vide = recherche vidée. */
  texte: string;
  filtre?: string;
  id?: string;
}

export function destinationDe(
  n: Pick<Notification, "onglet" | "cibleId" | "reference"> & { filtre?: string },
): Destination | null {
  if (!n.onglet) return null;
  if (n.cibleId && ECRANS_AVEC_FICHE.has(n.onglet))
    return { onglet: n.onglet, texte: "", id: n.cibleId };
  if (n.filtre) return { onglet: n.onglet, texte: "", filtre: n.filtre };
  return { onglet: n.onglet, texte: n.reference ?? "" };
}
