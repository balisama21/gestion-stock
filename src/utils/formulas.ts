import { LocaleSetting } from "../types";

/**
 * Converts a string number or digits into Unicode subscript representation
 * e.g. 1000 -> ₁₀₀₀, 1300 -> ₁₃₀₀
 */
export function toSubscript(val: number | string): string {
  const digits = String(val);
  const subscriptMap: Record<string, string> = {
    "0": "₀",
    "1": "₁",
    "2": "₂",
    "3": "₃",
    "4": "₄",
    "5": "₅",
    "6": "₆",
    "7": "₇",
    "8": "₈",
    "9": "₉",
  };
  return digits
    .split("")
    .map((char) => subscriptMap[char] || char)
    .join("");
}

/**
 * Format date depending on locale setting
 */
export function formatDateLocale(dateStr: string, locale: LocaleSetting): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [yyyy, mm, dd] = parts;
  if (locale === "FR") {
    return `${dd}/${mm}/${yyyy}`;
  } else {
    return `${mm}/${dd}/${yyyy}`;
  }
}

/**
 * Format currency string (default Ariary Ar)
 */
export function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " Ar"
  );
}

/**
 * Formula translator between US syntax (commas) and FR syntax (semicolons)
 */
export function convertFormulaLocale(formula: string, locale: LocaleSetting): string {
  if (locale === "US") {
    // Return standard US syntax
    return formula;
  }

  // Translate to FR syntax:
  // 1. Replace commas outside quotes with semicolons
  // 2. Translate common function names if desired (e.g. IF -> SI, VLOOKUP -> RECHERCHEV, SUM -> SOMME, SUMIFS -> SOMME.SI.MULTI, COUNTIFS -> NB.SI.MULTI)
  let result = "";
  let inQuotes = false;

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      result += char;
    } else if (char === "," && !inQuotes) {
      result += ";";
    } else {
      result += char;
    }
  }

  // Replace common function names for French Google Sheets display
  const functionMap: Record<string, string> = {
    "=IF(": "=SI(",
    "; IF(": "; SI(",
    "(IF(": "(SI(",
    "=VLOOKUP(": "=RECHERCHEV(",
    "; VLOOKUP(": "; RECHERCHEV(",
    "=SUM(": "=SOMME(",
    "=SUMIFS(": "=SOMME.SI.MULTI(",
    "=COUNTIFS(": "=NB.SI.MULTI(",
    "=INDEX(": "=INDEX(",
    "=MATCH(": "=EQUIV(",
    "=TODAY()": "=AUJOURDHUI()",
    "=DATE(": "=DATE(",
    "=ISBLANK(": "=ESTVIDE(",
  };

  for (const [usFunc, frFunc] of Object.entries(functionMap)) {
    result = result.replaceAll(usFunc, frFunc);
  }

  return result;
}

/**
 * Retire un éventuel indice en chiffres subscript présent en fin de chaîne
 * (« Kapa₂₀₀₀ » → « Kapa »).
 *
 * Ce n'est pas une précaution théorique : en base, `sales.designation` vaut
 * littéralement « kiraro₅₀₀₀ » ou « VERA₁₀₀₀ ». L'indice a été gravé dans le
 * texte au moment de l'écriture, et il y reste. Toute lecture d'une
 * désignation doit donc passer par ici.
 */
function stripSubscript(str: string): string {
  return str.replace(/[₀₁₂₃₄₅₆₇₈₉]+$/, "").trim();
}

/**
 * Prix d'achat qui distingue cette entrée des autres portant le même nom,
 * ou `null` s'il n'y a rien à distinguer.
 *
 * La question posée est « ce nom de produit existe-t-il en plusieurs
 * versions au catalogue ? ». Elle se tranche donc sur le catalogue seul.
 *
 * L'ancienne version ajoutait à l'ensemble le prix de l'enregistrement
 * lui-même. Conséquence : une vente dont le prix d'achat figé différait du
 * prix actuel du produit — un simple changement de tarif entre-temps —
 * faisait croire à une variante, et l'indice apparaissait sur un produit
 * qui n'en avait aucune.
 */
function getVariantPrice(
  designation: string,
  price: number,
  products: { designation: string; prixAchat: number }[],
): number | null {
  const key = stripSubscript(designation).toLowerCase();
  const prixCatalogue = new Set(
    products
      .filter((p) => stripSubscript(p.designation).toLowerCase() === key)
      .map((p) => p.prixAchat),
  );
  return prixCatalogue.size > 1 ? price : null;
}

/**
 * Nom propre d'un produit du catalogue, sans indice, en toutes
 * circonstances. C'est ce qui s'affiche partout : listes, titres,
 * recherche, documents imprimés.
 */
export function getProductLabel(
  product: { designation: string; prixAchat: number },
  allProducts: { designation: string; prixAchat: number }[],
): string {
  return stripSubscript(product.designation);
}

/** Nom propre figé sur une vente. */
export function getSaleLabel(
  sale: { designation: string; prixAchatUnitRef: number },
  products: { designation: string; prixAchat: number }[],
): string {
  return stripSubscript(sale.designation);
}

/** Nom propre figé sur un achat. */
export function getPurchaseLabel(
  purchase: { designation: string; prixAchatUnit: number },
  products: { designation: string; prixAchat: number }[],
): string {
  return stripSubscript(purchase.designation);
}

/**
 * Variante d'un produit du catalogue : le prix d'achat qui le distingue de
 * ses homonymes, ou `null` s'il est seul de son nom.
 *
 * Ce prix est un secret commercial. Les appelants ne doivent le passer au
 * badge que là où l'utilisateur a déjà le droit de voir les prix d'achat,
 * et jamais sur un document remis à un client.
 */
export function getProductVariant(
  product: { designation: string; prixAchat: number },
  allProducts: { designation: string; prixAchat: number }[],
): number | null {
  return getVariantPrice(product.designation, product.prixAchat, allProducts);
}

/** Variante d'une vente — voir `getProductVariant` pour les précautions. */
export function getSaleVariant(
  sale: { designation: string; prixAchatUnitRef: number },
  products: { designation: string; prixAchat: number }[],
): number | null {
  return getVariantPrice(sale.designation, sale.prixAchatUnitRef, products);
}

/** Variante d'un achat — voir `getProductVariant` pour les précautions. */
export function getPurchaseVariant(
  purchase: { designation: string; prixAchatUnit: number },
  products: { designation: string; prixAchat: number }[],
): number | null {
  return getVariantPrice(purchase.designation, purchase.prixAchatUnit, products);
}
