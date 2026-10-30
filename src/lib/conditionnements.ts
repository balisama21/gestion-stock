/**
 * CONDITIONNEMENTS : acheter et vendre au carton, au sac, au pack…
 *
 * Le stock d'un produit se compte toujours dans son UNITÉ DE BASE
 * (`products.unite`), en nombre entier. Un conditionnement dit combien
 * d'unités de base il contient — pour CE produit : un carton d'eau n'a
 * rien à voir avec un carton de cahiers, et aucune conversion n'est
 * supposée d'office.
 *
 *   1 carton = 12 bouteilles : acheter 2 cartons fait entrer 24
 *   bouteilles, vendre 1 carton en fait sortir 12, vendre 3 bouteilles
 *   en fait sortir 3.
 *
 * Le facteur est relu par la base au moment d'écrire
 * (`create_sale_conditionne`, `add_purchase_conditionne`) : l'écran ne
 * fait que proposer et afficher.
 */

import { quantiteEnMots } from "../utils/formulas";

export interface Conditionnement {
  /** Stable : une vente en cours le désigne même si on le renomme. */
  id: string;
  /** « carton », « sac de 50 kg », « pack »… */
  nom: string;
  /** Combien d'unités de base il contient. Entier, au moins 2. */
  quantite: number;
  /** Son prix de vente. Vide : `quantite` × le prix de l'unité. */
  prixVente: number | null;
  /** Son prix d'achat habituel. Vide : `quantite` × le prix d'achat de l'unité. */
  prixAchat: number | null;
  /** L'étiquette du carton, différente de celle de la pièce. */
  codeBarres: string | null;
}

/** Ce qu'une vente ou un achat retient de son conditionnement. */
export interface ConditionnementDeLigne {
  nom: string;
  nombre: number;
  facteur: number;
}

/** Le minimum d'un produit dont on a besoin ici. */
interface ProduitConditionne {
  unite: string | null;
  prixVenteDefaut: number;
  prixAchat: number;
  conditionnements: Conditionnement[];
}

export const MAX_CONDITIONNEMENTS = 20;

/** Les trois colonnes descriptives d'une ligne de `sales` ou de `purchases`. */
export const conditionnementDeLigne = (row: {
  conditionnement?: string | null;
  conditionnement_nombre?: number | null;
  conditionnement_facteur?: number | null;
}): ConditionnementDeLigne | null =>
  row.conditionnement && row.conditionnement_nombre && row.conditionnement_facteur
    ? {
        nom: row.conditionnement,
        nombre: row.conditionnement_nombre,
        facteur: row.conditionnement_facteur,
      }
    : null;

const nombreOuNul = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** La colonne `products.conditionnements`, lue sans jamais planter. */
export const lireConditionnements = (json: unknown): Conditionnement[] => {
  if (!Array.isArray(json)) return [];
  return json.flatMap((el) => {
    if (!el || typeof el !== "object") return [];
    const o = el as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const nom = typeof o.nom === "string" ? o.nom.trim() : "";
    const quantite = nombreOuNul(o.quantite);
    if (!id || !nom || quantite === null || quantite < 2) return [];
    return [
      {
        id,
        nom,
        quantite: Math.trunc(quantite),
        prixVente: nombreOuNul(o.prix_vente),
        prixAchat: nombreOuNul(o.prix_achat),
        codeBarres: typeof o.code_barres === "string" && o.code_barres ? o.code_barres : null,
      },
    ];
  });
};

/** Ce que la base attend, dans la forme que sa contrainte vérifie. */
export const conditionnementsVersBase = (liste: Conditionnement[]) =>
  liste.map((c) => ({
    id: c.id,
    nom: c.nom.trim(),
    quantite: c.quantite,
    prix_vente: c.prixVente,
    prix_achat: c.prixAchat,
    code_barres: c.codeBarres?.trim() || null,
  }));

export const nouvelIdentifiant = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Ce qui empêcherait d'enregistrer la liste, dit avant que la base ne
 * le refuse. Les mêmes règles que `conditionnements_valides`.
 */
export const erreurConditionnements = (
  liste: Conditionnement[],
  unite: string | null,
): string | null => {
  if (liste.length > MAX_CONDITIONNEMENTS) {
    return `Pas plus de ${MAX_CONDITIONNEMENTS} conditionnements par produit.`;
  }
  const vus = new Set<string>();
  const base = sansAccents(unite ?? "");
  for (const c of liste) {
    const nom = sansAccents(c.nom);
    if (!nom) return "Chaque conditionnement doit avoir un nom (carton, sac, pack…).";
    if (base && nom === base) {
      return `« ${c.nom} » est déjà l'unité de base du produit.`;
    }
    if (vus.has(nom)) return `Le conditionnement « ${c.nom} » apparaît deux fois.`;
    vus.add(nom);
    if (!Number.isInteger(c.quantite) || c.quantite < 2) {
      return `Un ${c.nom} doit contenir au moins 2 ${libelleUnite(unite, 2)}, en nombre entier.`;
    }
    if ((c.prixVente ?? 0) < 0 || (c.prixAchat ?? 0) < 0) {
      return "Un prix ne peut pas être négatif.";
    }
  }
  return null;
};

// ── Les mots ────────────────────────────────────────────────────────

/** Les unités qui s'écrivent en abrégé ne prennent pas de « s ». */
const INVARIABLES = new Set(["kg", "g", "mg", "l", "ml", "cl", "m", "cm", "mm", "m²", "m³"]);

/** « carton » → « cartons », « kg » → « kg », « colis » → « colis ». */
export const auPluriel = (mot: string, n: number): string => {
  const m = mot.trim();
  if (Math.abs(n) < 2 || !m) return m;
  // Seul le premier mot s'accorde : « sac de 50 kg » → « sacs de 50 kg ».
  const [tete, ...reste] = m.split(" ");
  const bas = tete.toLowerCase();
  let pluriel = tete;
  if (INVARIABLES.has(bas) || /[sxz]$/i.test(tete)) pluriel = tete;
  else if (/(eau|au|eu)$/i.test(tete)) pluriel = `${tete}x`;
  else if (/al$/i.test(tete) && bas !== "bocal") pluriel = `${tete.slice(0, -2)}aux`;
  else pluriel = `${tete}s`;
  return [pluriel, ...reste].join(" ");
};

/**
 * Le nom de l'unité de base accordé à `n`, « unité » quand la fiche
 * n'en dit rien. La même règle que `quantiteEnMots`, sans le nombre.
 */
export const libelleUnite = (unite: string | null | undefined, n = 1): string =>
  quantiteEnMots(n, unite).replace(/^\S+ /, "");

/** « carton de 12 pièces ». */
export const libelleConditionnement = (
  c: { nom: string; quantite: number },
  unite: string | null,
) => `${c.nom} de ${quantiteEnMots(c.quantite, unite)}`;

/**
 * Une ligne de vente ou d'achat, dite comme on l'a saisie.
 *
 *   « 2 cartons · 24 pièces » quand elle a un conditionnement,
 *   « 24 pièces » sinon.
 */
export const quantiteDeLigne = (
  quantite: number,
  unite: string | null | undefined,
  cond: ConditionnementDeLigne | null | undefined,
): { principal: string; detail: string | null } => {
  const base = quantiteEnMots(quantite, unite);
  if (!cond) return { principal: base, detail: null };
  return {
    principal: `${cond.nombre.toLocaleString("fr-FR")} ${auPluriel(cond.nom, cond.nombre)}`,
    detail: base,
  };
};

/**
 * Le stock exprimé avec le plus grand conditionnement : 30 bouteilles
 * en cartons de 12 → « 2 cartons + 6 bouteilles ». Rien quand le stock
 * n'en remplit pas un seul : « 6 bouteilles » se lit déjà très bien.
 */
export const stockEnConditionnements = (
  stock: number,
  unite: string | null | undefined,
  liste: Conditionnement[],
): string | null => {
  if (stock <= 0 || liste.length === 0) return null;
  const plusGrand = [...liste].sort((a, b) => b.quantite - a.quantite)[0];
  const pleins = Math.floor(stock / plusGrand.quantite);
  if (pleins < 1) return null;
  const reste = stock - pleins * plusGrand.quantite;
  const tete = `${pleins.toLocaleString("fr-FR")} ${auPluriel(plusGrand.nom, pleins)}`;
  return reste > 0 ? `${tete} + ${quantiteEnMots(reste, unite)}` : tete;
};

// ── Les prix ────────────────────────────────────────────────────────

/** Le prix de vente d'un conditionnement : le sien, sinon le compte des unités. */
export const prixVenteDe = (c: Conditionnement, p: Pick<ProduitConditionne, "prixVenteDefaut">) =>
  c.prixVente ?? c.quantite * p.prixVenteDefaut;

/** Le prix d'achat d'un conditionnement : le sien, sinon le compte des unités. */
export const prixAchatDe = (c: Conditionnement, p: Pick<ProduitConditionne, "prixAchat">) =>
  c.prixAchat ?? c.quantite * p.prixAchat;

/**
 * Ce que coûte UNE unité de base quand on l'achète en conditionnement.
 * Arrondi au centième : c'est le prix de référence de la fiche, pas un
 * montant de caisse.
 */
export const prixUnitaireDepuis = (prixConditionnement: number, quantite: number) =>
  quantite > 0 ? Math.round((prixConditionnement / quantite) * 100) / 100 : 0;

/**
 * La remise qu'un conditionnement accorde par rapport au détail : un
 * carton à 7 000 au lieu de 12 × 650 = 7 800 fait 10 % de moins.
 */
export const remiseDuConditionnement = (
  c: Conditionnement,
  p: Pick<ProduitConditionne, "prixVenteDefaut">,
): number | null => {
  if (c.prixVente === null || p.prixVenteDefaut <= 0) return null;
  const detail = c.quantite * p.prixVenteDefaut;
  if (detail <= 0) return null;
  const ecart = Math.round(((detail - c.prixVente) / detail) * 100);
  return ecart === 0 ? null : ecart;
};

// ── La recherche ────────────────────────────────────────────────────

/**
 * Un code scanné : celui du produit, ou celui d'un de ses
 * conditionnements. Le second dit dans quel conditionnement vendre.
 */
export const trouverParCode = <
  P extends { id: string; codeBarres: string | null; sku: string | null } & {
    conditionnements: Conditionnement[];
  },
>(
  produits: P[],
  code: string,
): { produit: P; conditionnement: Conditionnement | null } | null => {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  for (const p of produits) {
    const cond = p.conditionnements.find((x) => x.codeBarres?.trim().toLowerCase() === c);
    if (cond) return { produit: p, conditionnement: cond };
  }
  const p = produits.find(
    (x) => x.codeBarres?.trim().toLowerCase() === c || x.sku?.trim().toLowerCase() === c,
  );
  return p ? { produit: p, conditionnement: null } : null;
};
