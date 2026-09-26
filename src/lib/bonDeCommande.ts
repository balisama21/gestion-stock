import { estARecommander, type ReglagesAlertesStock } from "./prealerteStock";
import { quantiteACommander } from "./reapprovisionnement";

/**
 * LA LISTE À RÉAPPROVISIONNER, ET CE QU'ELLE VAUT.
 *
 * Le commerçant a une notification qui lui dit quoi racheter ; il lui
 * faut maintenant de quoi l'envoyer à son fournisseur. Ce fichier
 * compose la liste — rien d'autre. Il ne sait ni la dessiner, ni la
 * télécharger : `BonDeCommande.tsx` s'occupe du papier, `exportTableur`
 * du fichier, et tous deux partent d'ici. Une seule liste, trois
 * sorties.
 *
 * ── CE QUI MANQUE RESTE VIDE ──
 *
 * Quinze produits sur cinquante n'ont pas de fournisseur. On laisse la
 * case vide plutôt que d'écrire « Inconnu » ou de deviner : un bon de
 * commande part chez un tiers, et une valeur inventée y devient une
 * erreur qu'on ne peut plus rattraper.
 *
 * Un prix d'achat à zéro est traité comme absent. La colonne est `NOT
 * NULL DEFAULT 0` en base : rien ne distingue « gratuit » de « pas
 * saisi », et sur un bon de commande, un total à zéro serait un
 * engagement faux.
 */

/** Ce dont la liste a besoin, et rien de plus. */
export interface ProduitARecommander {
  id: string;
  nom: string;
  /** Le numéro court de la fiche : P001, P023… */
  numero?: string | null;
  /** La référence saisie par la boutique, si elle en tient une. */
  sku?: string | null;
  stockActuel: number;
  seuilAlerte: number;
  fournisseur?: string | null;
  prixAchat?: number | null;
  unite?: string | null;
  /** `stock_max` de la fiche : lu seulement quand le réapprovisionnement est activé. */
  niveauCible?: number | null;
}

export interface LigneBonDeCommande {
  id: string;
  produit: string;
  /** Vide quand la fiche n'en porte aucune. */
  reference: string;
  stock: number;
  seuil: number;
  quantiteSuggeree: number;
  unite: string | null;
  /** Vide quand la fiche ne le dit pas. */
  fournisseur: string;
  /** Nul quand le prix n'est pas renseigné — zéro compris. */
  prixAchat: number | null;
  /** Nul dès que le prix l'est : on ne chiffre pas ce qu'on ignore. */
  totalEstime: number | null;
}

/**
 * Combien commander, réglage de réapprovisionnement éteint : le double
 * du seuil, règle historique. Voir `reapprovisionnement.ts`.
 */
export function quantiteSuggeree(stock: number, seuil: number): number {
  return Math.max(0, seuil * 2 - stock);
}

/**
 * La liste, du plus urgent au moins urgent.
 *
 * LA PART DU SEUIL, ET NON L'ÉCART AU SEUIL. Les deux se ressemblent et
 * l'un des deux est faux : un produit à zéro sur un seuil de deux et un
 * produit à dix-huit sur un seuil de vingt manquent tous deux de deux
 * unités, mais le premier a l'étagère vide et le second peut tenir la
 * semaine. La proportion les sépare — 0 contre 0,9 — là où la
 * soustraction les confond.
 *
 * C'est aussi ce que dit déjà la jauge de la carte Stock, qui se
 * remplit à proportion du seuil : la liste téléchargée classe comme
 * l'écran classait.
 *
 * Le seuil est forcément supérieur à zéro ici — un produit sans seuil
 * n'est jamais à recommander —, donc pas de division par zéro.
 */
export function lignesDuBonDeCommande(
  produits: ProduitARecommander[],
  reglages: ReglagesAlertesStock,
): LigneBonDeCommande[] {
  return produits
    .filter((p) => estARecommander(p.stockActuel, p.seuilAlerte, reglages))
    .map((p) => {
      const quantite = quantiteACommander(p.stockActuel, p.seuilAlerte, p.niveauCible, reglages);
      const prix = p.prixAchat && p.prixAchat > 0 ? p.prixAchat : null;
      return {
        id: p.id,
        produit: p.nom,
        reference: (p.numero || p.sku || "").trim(),
        stock: p.stockActuel,
        seuil: p.seuilAlerte,
        quantiteSuggeree: quantite,
        unite: p.unite?.trim() || null,
        fournisseur: (p.fournisseur || "").trim(),
        prixAchat: prix,
        totalEstime: prix === null ? null : prix * quantite,
      };
    })
    .sort(
      (a, b) => a.stock / a.seuil - b.stock / b.seuil || a.produit.localeCompare(b.produit, "fr"),
    );
}

/**
 * Le total du bon, quand il veut dire quelque chose.
 *
 * Nul si AUCUNE ligne n'a de prix — additionner des vides donnerait
 * zéro, et un bon de commande à « 0 Ar » se lirait comme un bon de
 * commande gratuit. Quand certaines lignes en ont et d'autres non, on
 * additionne ce qu'on sait et le document dit combien de lignes
 * manquent : un total partiel annoncé comme tel vaut mieux qu'un total
 * faux ou pas de total du tout.
 */
export interface TotalDuBon {
  montant: number | null;
  /** Lignes sans prix d'achat, donc absentes du total. */
  lignesSansPrix: number;
}

export function totalDuBon(lignes: LigneBonDeCommande[]): TotalDuBon {
  const chiffrees = lignes.filter((l) => l.totalEstime !== null);
  return {
    montant:
      chiffrees.length === 0 ? null : chiffrees.reduce((n, l) => n + (l.totalEstime ?? 0), 0),
    lignesSansPrix: lignes.length - chiffrees.length,
  };
}

/**
 * Les colonnes du fichier, dans l'ordre demandé.
 *
 * Écrites une fois et employées par le CSV comme par le tableur : deux
 * listes d'en-têtes finiraient par ne plus dire la même chose.
 */
export const COLONNES_BON_DE_COMMANDE = [
  "Produit",
  "Référence",
  "Stock actuel",
  "Seuil d'alerte",
  "Quantité suggérée",
  "Fournisseur",
  "Prix d'achat",
  "Total estimé",
] as const;

/**
 * Une ligne de tableur.
 *
 * `null` plutôt que `""` pour ce qui manque : le tableur produira une
 * cellule VIDE, et non une chaîne vide qui ressemble à une saisie. Le
 * CSV les rend indistinguables, mais le fichier Excel garde la
 * différence, et c'est celui qu'on retravaille.
 */
export function cellulesDeLigne(l: LigneBonDeCommande): (string | number | null)[] {
  return [
    l.produit,
    l.reference || null,
    l.stock,
    l.seuil,
    l.quantiteSuggeree,
    l.fournisseur || null,
    l.prixAchat,
    l.totalEstime,
  ];
}
