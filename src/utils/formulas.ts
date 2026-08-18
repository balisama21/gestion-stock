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
 * Retire un éventuel indice en chiffres subscript déjà présent en fin de
 * chaîne (ex: "Kapa₂₀₀₀" -> "Kapa"). Utile pour les anciens enregistrements
 * (ventes/achats) dont le nom a été figé avec un indice avant cette correction.
 */
function stripSubscript(str: string): string {
  return str.replace(/[₀₁₂₃₄₅₆₇₈₉]+$/, "").trim();
}

/**
 * Calcule le nom d'affichage "intelligent" pour une désignation + un prix
 * donnés, en se basant sur le catalogue de produits actuel :
 * - Un seul prix connu pour cette désignation → nom simple, sans indice.
 * - Plusieurs prix différents connus pour cette désignation → nom + indice
 *   (ex: "Kapa₂₀₀₀") pour les différencier.
 * Fonctionne même si l'enregistrement (vente/achat) n'est plus lié à un
 * produit existant en base (achat "orphelin").
 */
function getVariantLabel(
  designation: string,
  price: number,
  products: { designation: string; prixAchat: number }[],
): string {
  const baseName = stripSubscript(designation);
  const key = baseName.toLowerCase();
  const uniquePrices = new Set(
    products
      .filter((p) => p.designation.trim().toLowerCase() === key)
      .map((p) => p.prixAchat),
  );
  uniquePrices.add(price);
  if (uniquePrices.size <= 1) {
    return baseName;
  }
  return `${baseName}${toSubscript(price)}`;
}

/**
 * Nom d'affichage intelligent pour un produit du catalogue.
 */
export function getProductLabel(
  product: { designation: string; prixAchat: number },
  allProducts: { designation: string; prixAchat: number }[],
): string {
  return getVariantLabel(product.designation, product.prixAchat, allProducts);
}

/**
 * Nom d'affichage intelligent pour un enregistrement de vente (utilise le
 * prix d'achat de référence figé sur la vente, qui est ce qui différencie
 * les variantes).
 */
export function getSaleLabel(
  sale: { designation: string; prixAchatUnitRef: number },
  products: { designation: string; prixAchat: number }[],
): string {
  return getVariantLabel(sale.designation, sale.prixAchatUnitRef, products);
}

/**
 * Nom d'affichage intelligent pour un enregistrement d'achat.
 */
export function getPurchaseLabel(
  purchase: { designation: string; prixAchatUnit: number },
  products: { designation: string; prixAchat: number }[],
): string {
  return getVariantLabel(purchase.designation, purchase.prixAchatUnit, products);
}