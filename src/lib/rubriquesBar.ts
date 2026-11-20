import { supabase } from "./supabase";

/**
 * LES RUBRIQUES D'UN BAR-KARAOKÉ
 *
 * Toute boutique naît avec les catégories d'un commerce ordinaire
 * (Alimentation, Hygiène et entretien, Emballages, Équipements…). Dans un
 * bar, elles n'ont rien à faire sur la carte. On les remplace par celles
 * d'un bar malgache, dans l'ordre où on les lit sur une ardoise.
 *
 * On ne supprime rien : une catégorie inutile qui ne range encore aucun
 * article est seulement mise de côté (`actif = false`). Une catégorie qui
 * range déjà des articles reste, quelle qu'elle soit.
 */

export const RUBRIQUES_BAR = [
  "Bières",
  "Softs et jus",
  "Eaux",
  "Alcools et spiritueux",
  "Vins",
  "Cocktails",
  "Plats",
  "Brochettes et grillades",
  "Snacks",
  "Cigarettes",
];

/** Les postes de dépense propres à un bar-karaoké, ajoutés à ceux de tout commerce. */
export const DEPENSES_BAR = ["Animation et DJ", "Matériel son et karaoké", "Glace et gaz"];

interface CategorieLue {
  id: string;
  nom: string;
  usage: string | null;
  actif: boolean | null;
  ordre: number;
}

const cle = (nom: string) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface PlanRubriques {
  /** Les catégories de produits à mettre de côté : hors bar, et vides. */
  aMasquer: string[];
  /** Les rubriques de bar à créer, avec leur rang. */
  aCreer: { nom: string; ordre: number }[];
  /** Les postes de dépense à créer. */
  depensesACreer: string[];
}

export function planRubriquesBar(
  categories: CategorieLue[],
  produitsParCategorie: Map<string, number>,
): PlanRubriques {
  return planRubriques(categories, produitsParCategorie, RUBRIQUES_BAR, DEPENSES_BAR);
}

/** Le même plan pour n'importe quelle nature : ses rubriques, ses postes de dépense. */
export function planRubriques(
  categories: CategorieLue[],
  produitsParCategorie: Map<string, number>,
  rubriques: string[],
  postes: string[],
): PlanRubriques {
  const produits = categories.filter((c) => (c.usage ?? "produit") === "produit");
  const depenses = categories.filter((c) => c.usage === "depense");
  const duBar = new Set(rubriques.map(cle));
  const existantes = new Set(produits.map((c) => cle(c.nom)));
  return {
    aMasquer: produits
      .filter((c) => c.actif !== false && !duBar.has(cle(c.nom)) && !produitsParCategorie.get(c.id))
      .map((c) => c.id),
    aCreer: rubriques
      .map((nom, i) => ({ nom, ordre: i * 10 }))
      .filter((r) => !existantes.has(cle(r.nom))),
    depensesACreer: postes.filter((d) => !depenses.some((c) => cle(c.nom) === cle(d))),
  };
}

export const planVide = (p: PlanRubriques) =>
  p.aMasquer.length === 0 && p.aCreer.length === 0 && p.depensesACreer.length === 0;

/**
 * Applique le plan à une boutique : met de côté, réactive ou crée.
 * Une rubrique de bar mise de côté par le passé est réactivée plutôt que
 * créée en double.
 */
export const adapterRubriquesAuBar = (storeId: string, userId: string) =>
  adapterRubriques(storeId, userId, RUBRIQUES_BAR, DEPENSES_BAR);

export async function adapterRubriques(
  storeId: string,
  userId: string,
  rubriques: string[],
  postes: string[],
): Promise<{ error: string | null }> {
  const db = supabase as unknown as { from: (t: string) => any };
  const [{ data: cats, error: e1 }, { data: prods, error: e2 }] = await Promise.all([
    db.from("categories").select("id, nom, usage, actif, ordre").eq("store_id", storeId),
    db.from("products").select("category_id").eq("store_id", storeId),
  ]);
  if (e1 || e2) return { error: (e1 ?? e2).message };
  const compte = new Map<string, number>();
  for (const p of (prods ?? []) as { category_id: string | null }[]) {
    if (p.category_id) compte.set(p.category_id, (compte.get(p.category_id) ?? 0) + 1);
  }
  const categories = (cats ?? []) as CategorieLue[];
  const plan = planRubriques(categories, compte, rubriques, postes);

  if (plan.aMasquer.length) {
    const { error } = await db.from("categories").update({ actif: false }).in("id", plan.aMasquer);
    if (error) return { error: error.message };
  }
  // Une rubrique de bar déjà là mais mise de côté revient.
  const aReactiver = categories
    .filter(
      (c) =>
        (c.usage ?? "produit") === "produit" &&
        c.actif === false &&
        rubriques.some((r) => cle(r) === cle(c.nom)),
    )
    .map((c) => c.id);
  if (aReactiver.length) {
    const { error } = await db.from("categories").update({ actif: true }).in("id", aReactiver);
    if (error) return { error: error.message };
  }
  const nouvelles = [
    ...plan.aCreer.map((r) => ({ nom: r.nom, ordre: r.ordre, usage: "produit" })),
    ...plan.depensesACreer.map((nom, i) => ({ nom, ordre: 100 + i * 10, usage: "depense" })),
  ].map((r) => ({ ...r, store_id: storeId, created_by: userId }));
  if (nouvelles.length) {
    const { error } = await db.from("categories").insert(nouvelles);
    if (error) return { error: error.message };
  }
  return { error: null };
}
