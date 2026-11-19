import type { Product } from "../types";

/**
 * L'INVENTAIRE DU SOIR
 *
 * Après la fermeture, on compte ce qui reste ; le logiciel compare avec
 * ce que le stock devrait être, montre les écarts en quantité et en
 * argent, puis, une fois validé, remet le stock sur le compté.
 *
 * Pas de table à part : chaque écart validé devient une correction de
 * stock ordinaire (`ajuster_stock`), marquée « Inventaire du soir · date ».
 * C'est cette mention qui permet de relire les inventaires passés.
 */

export const PREFIXE_INVENTAIRE = "Inventaire du soir";

/** La mention portée par les corrections d'un inventaire. */
export const noteInventaire = (jour: string): string => {
  const [a, m, j] = jour.split("-");
  return `${PREFIXE_INVENTAIRE} · ${j}/${m}/${a}`;
};

export interface EcartInventaire {
  produit: Product;
  attendu: number;
  compte: number;
  /** compté − attendu : négatif quand il manque. */
  ecart: number;
  /** L'écart au prix d'achat : ce que le manque coûte. */
  valeur: number;
}

/** Les écarts des articles comptés, les plus coûteux d'abord. */
export function ecarts(produits: Product[], comptes: Record<string, number>): EcartInventaire[] {
  return produits
    .filter((p) => comptes[p.id] !== undefined)
    .map((p) => {
      const compte = comptes[p.id];
      const ecart = compte - p.stockActuel;
      return { produit: p, attendu: p.stockActuel, compte, ecart, valeur: ecart * p.prixAchat };
    })
    .sort((a, b) => a.valeur - b.valeur);
}

export interface BilanInventaire {
  comptes: number;
  enEcart: number;
  manquant: number;
  /** La valeur nette des écarts : négative quand le bar perd de l'argent. */
  valeur: number;
}

export function bilanInventaire(lignes: EcartInventaire[]): BilanInventaire {
  return {
    comptes: lignes.length,
    enEcart: lignes.filter((l) => l.ecart !== 0).length,
    manquant: lignes.reduce((n, l) => n + Math.min(0, l.ecart), 0),
    valeur: lignes.reduce((n, l) => n + l.valeur, 0),
  };
}

export interface MouvementInventaire {
  product_id: string;
  stock_actuel_delta: number;
  note: string | null;
  created_at: string;
}

export interface InventairePasse {
  note: string;
  quand: string;
  articles: number;
  manquant: number;
  valeur: number;
}

/** Les inventaires passés, relus dans les corrections de stock. */
export function inventairesPasses(
  mouvements: MouvementInventaire[],
  prixAchat: Map<string, number>,
): InventairePasse[] {
  const parNote = new Map<string, InventairePasse>();
  for (const m of mouvements) {
    if (!m.note?.startsWith(PREFIXE_INVENTAIRE)) continue;
    const i = parNote.get(m.note) ?? {
      note: m.note,
      quand: m.created_at,
      articles: 0,
      manquant: 0,
      valeur: 0,
    };
    i.articles += 1;
    i.manquant += Math.min(0, m.stock_actuel_delta);
    i.valeur += m.stock_actuel_delta * (prixAchat.get(m.product_id) ?? 0);
    if (m.created_at > i.quand) i.quand = m.created_at;
    parNote.set(m.note, i);
  }
  return [...parNote.values()].sort((a, b) => b.quand.localeCompare(a.quand));
}
