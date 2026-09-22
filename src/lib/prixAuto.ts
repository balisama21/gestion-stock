import type { Personnalisation } from "./personnalisation";

/**
 * LE PRIX DE VENTE CALCULÉ DEPUIS LE PRIX D'ACHAT.
 *
 * ── CE QUE « TAUX » VEUT DIRE ICI, ET CE QUE CE N'EST PAS ──
 *
 * C'est un COEFFICIENT APPLIQUÉ AU PRIX D'ACHAT :
 *
 *     prix de vente = prix d'achat × (1 + taux)
 *
 * Ce n'est PAS la marge sur le prix de vente. Un article acheté 1 000
 * et vendu 1 100 porte « +10 % sur le prix d'achat », mais sa marge
 * commerciale vaut 9,1 % du prix de vente. Les deux chiffres sont
 * justes et ne disent pas la même chose ; l'interface écrit toujours
 * lequel elle affiche, parce que confondre les deux revient à se
 * tromper d'un dixième sur chaque article.
 */

export type Arrondi = 0 | 50 | 100 | 500 | 1000;

export interface ReglagesPrixAuto {
  /** Désactivé, la saisie du prix reste exactement comme avant. */
  actif: boolean;
  /** Le taux de la boutique, en pourcentage du prix d'achat. */
  taux: number;
  /** Les boutons proposés à la saisie. */
  tauxRapides: number[];
  /** À quel palier supérieur arrondir. 0 = pas d'arrondi. */
  arrondi: Arrondi;
}

export const PRIX_AUTO_DEFAUT: ReglagesPrixAuto = {
  // Désactivé par défaut, et c'est la règle générale du cahier des
  // charges : une boutique qui ne touche à rien ne voit que des
  // améliorations neutres.
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

/**
 * Lu avec des défauts qui ne changent rien.
 *
 * Clé absente = fonction désactivée, taux de dix pour cent, aucun
 * arrondi. Une boutique qui n'a jamais ouvert cet écran se comporte
 * donc exactement comme avant qu'il existe.
 */
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

/* ─────────────────────────────────────────────────────────────
 * Le taux qui s'applique
 * ───────────────────────────────────────────────────────────── */

export type OrigineDuTaux = "produit" | "categorie" | "boutique";

export interface TauxApplique {
  taux: number;
  origine: OrigineDuTaux;
}

/**
 * Le plus précis l'emporte : produit, puis catégorie, puis boutique.
 *
 * `null` à un niveau veut dire « demande au niveau au-dessus », JAMAIS
 * « zéro pour cent ». C'est la distinction qui compte : un commerçant
 * qui veut vendre une catégorie à prix coûtant écrit un zéro, et ce
 * zéro doit être respecté au lieu de faire remonter la question d'un
 * cran.
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

/* ─────────────────────────────────────────────────────────────
 * Le calcul
 * ───────────────────────────────────────────────────────────── */

/**
 * Au palier supérieur, jamais à l'inférieur.
 *
 * Arrondir vers le bas rognerait la marge que le commerçant vient de
 * demander. Un prix déjà sur un palier n'est pas poussé au suivant.
 */
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

/* ─────────────────────────────────────────────────────────────
 * Ce que la marge vaut, une fois le prix posé
 * ───────────────────────────────────────────────────────────── */

export interface Marge {
  /** Ce que la vente rapporte, en Ariary. */
  ariary: number;
  /** Ce que cela représente sur le prix d'achat. Null si l'achat vaut zéro. */
  pourcentDeLAchat: number | null;
  /** Vrai si l'on vend à perte. */
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

/** « +20 % » ou « −5 % », avec une décimale seulement quand elle sert. */
export const formaterTaux = (taux: number): string => {
  const arrondi = Math.round(taux * 10) / 10;
  const signe = arrondi > 0 ? "+" : arrondi < 0 ? "−" : "";
  const valeur = Math.abs(arrondi).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${signe}${valeur} %`;
};

/* ─────────────────────────────────────────────────────────────
 * Le recalcul après un achat
 * ───────────────────────────────────────────────────────────── */

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
 * Ce qu'un nouveau prix d'achat change, et ce qu'il ne change pas.
 *
 * Seuls les produits en mode automatique sont recalculés. Un produit
 * passé en manuel garde son prix pour toujours : c'est la promesse
 * faite au commerçant quand il a saisi le sien, et elle vaut même si
 * son fournisseur augmente.
 *
 * La fonction ne rend que les prix qui BOUGENT réellement — le cahier
 * demande de montrer la liste des prix modifiés, et une liste où la
 * moitié des lignes affichent deux fois le même nombre ne se lit pas.
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
