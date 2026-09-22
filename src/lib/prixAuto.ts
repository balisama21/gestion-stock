import type { Personnalisation } from "./personnalisation";

/**
 * `prix de vente = prix d'achat × (1 + taux)`.
 *
 * Le taux porte sur le prix d'ACHAT, pas sur le prix de vente : acheté
 * 1 000, « +10 % » donne 1 100 et non 1 111. L'interface écrit toujours
 * sur quoi le pourcentage porte.
 */

export type Arrondi = 0 | 50 | 100 | 500 | 1000;

export interface ReglagesPrixAuto {
  /** Désactivé, la saisie du prix reste exactement comme avant. */
  actif: boolean;
  /** Taux de la boutique, en pourcentage du prix d'achat. */
  taux: number;
  tauxRapides: number[];
  /** Palier supérieur d'arrondi. 0 = aucun. */
  arrondi: Arrondi;
}

export const PRIX_AUTO_DEFAUT: ReglagesPrixAuto = {
  // Désactivé : une boutique qui ne touche à rien ne voit rien changer.
  actif: false,
  taux: 10,
  tauxRapides: [5, 10, 20, 30],
  arrondi: 0,
};

export const ARRONDIS: { valeur: Arrondi; libelle: string }[] = [
  { valeur: 0, libelle: "Aucun" },
  { valeur: 50, libelle: "50 Ar supérieurs" },
  { valeur: 100, libelle: "100 Ar supérieurs" },
  { valeur: 500, libelle: "500 Ar supérieurs" },
  { valeur: 1000, libelle: "1 000 Ar supérieurs" },
];

const nombreBorne = (v: unknown, defaut: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return defaut;
  return Math.min(Math.max(n, min), max);
};

/** Clé absente = désactivé, 10 %, aucun arrondi. */
export const lirePrixAuto = (p: Personnalisation): ReglagesPrixAuto => {
  const brut = (p as { prixAuto?: Record<string, unknown> }).prixAuto;
  if (!brut || typeof brut !== "object") return PRIX_AUTO_DEFAUT;

  const rapides = Array.isArray(brut.tauxRapides)
    ? Array.from(
        new Set(
          brut.tauxRapides
            .map((t) => nombreBorne(t, NaN, 0, 1000))
            .filter((t) => Number.isFinite(t)),
        ),
      ).sort((a, b) => a - b)
    : PRIX_AUTO_DEFAUT.tauxRapides;

  const arrondi = nombreBorne(brut.arrondi, 0, 0, 1000);

  return {
    actif: brut.actif === true,
    taux: nombreBorne(brut.taux, PRIX_AUTO_DEFAUT.taux, 0, 1000),
    tauxRapides: rapides.length > 0 ? rapides : PRIX_AUTO_DEFAUT.tauxRapides,
    arrondi: (ARRONDIS.some((a) => a.valeur === arrondi) ? arrondi : 0) as Arrondi,
  };
};

export type OrigineDuTaux = "produit" | "categorie" | "boutique";

export interface TauxApplique {
  taux: number;
  origine: OrigineDuTaux;
}

/**
 * Le plus précis l'emporte. `null` veut dire « demande au niveau
 * au-dessus », jamais « zéro pour cent » : un zéro est une décision.
 */
export const tauxApplicable = (
  tauxProduit: number | null | undefined,
  tauxCategorie: number | null | undefined,
  tauxBoutique: number,
): TauxApplique => {
  if (tauxProduit !== null && tauxProduit !== undefined && Number.isFinite(tauxProduit)) {
    return { taux: tauxProduit, origine: "produit" };
  }
  if (tauxCategorie !== null && tauxCategorie !== undefined && Number.isFinite(tauxCategorie)) {
    return { taux: tauxCategorie, origine: "categorie" };
  }
  return { taux: tauxBoutique, origine: "boutique" };
};

export const LIBELLE_ORIGINE: Record<OrigineDuTaux, string> = {
  produit: "taux de ce produit",
  categorie: "taux de la catégorie",
  boutique: "taux de la boutique",
};

/** Toujours vers le haut : arrondir vers le bas rognerait la marge. */
export const arrondirSuperieur = (montant: number, pas: number): number => {
  if (!pas || pas <= 0 || !Number.isFinite(montant)) return montant;
  return Math.ceil(montant / pas) * pas;
};

/** Le prix de vente que le taux et l'arrondi donnent. */
export const prixDepuisAchat = (prixAchat: number, taux: number, arrondi: number): number => {
  if (!Number.isFinite(prixAchat) || prixAchat <= 0) return 0;
  const brut = prixAchat * (1 + taux / 100);
  return arrondirSuperieur(Math.round(brut), arrondi);
};

export interface Marge {
  ariary: number;
  /** En pourcentage du prix d'achat. Null si l'achat vaut zéro. */
  pourcentDeLAchat: number | null;
  aPerte: boolean;
}

export const calculerLaMarge = (prixVente: number, prixAchat: number): Marge => {
  const ariary = prixVente - prixAchat;
  return {
    ariary,
    pourcentDeLAchat: prixAchat > 0 ? (ariary / prixAchat) * 100 : null,
    aPerte: prixAchat > 0 && prixVente < prixAchat,
  };
};

/** « +20 % », « −5 % » — une décimale seulement quand elle sert. */
export const formaterTaux = (taux: number): string => {
  const arrondi = Math.round(taux * 10) / 10;
  const signe = arrondi > 0 ? "+" : arrondi < 0 ? "−" : "";
  const valeur = Math.abs(arrondi).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${signe}${valeur} %`;
};

export interface ProduitARecalculer {
  id: string;
  displayName: string;
  prixAchat: number;
  prixVenteDefaut: number;
  modePrix: string;
  tauxProduit: number | null;
  tauxCategorie: number | null;
}

export interface PrixModifie {
  id: string;
  displayName: string;
  avant: number;
  apres: number;
}

/**
 * Seuls les produits en mode automatique sont recalculés, et seuls les
 * prix qui bougent réellement sont rendus : la liste doit se lire.
 */
export const recalculerLesPrix = (
  produits: ProduitARecalculer[],
  reglages: ReglagesPrixAuto,
): PrixModifie[] => {
  if (!reglages.actif) return [];
  const modifies: PrixModifie[] = [];
  for (const p of produits) {
    if (p.modePrix !== "auto") continue;
    const { taux } = tauxApplicable(p.tauxProduit, p.tauxCategorie, reglages.taux);
    const apres = prixDepuisAchat(p.prixAchat, taux, reglages.arrondi);
    if (apres > 0 && apres !== p.prixVenteDefaut) {
      modifies.push({
        id: p.id,
        displayName: p.displayName,
        avant: p.prixVenteDefaut,
        apres,
      });
    }
  }
  return modifies;
};
