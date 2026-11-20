/**
 * LES BONS DE PRÉPARATION
 *
 * Quand le bar a une imprimante, chaque commande envoyée sur une note
 * sort un bon par poste : un pour le comptoir (les boissons), un pour la
 * cuisine (plats, brochettes, snacks). Sans imprimante, rien ne change :
 * le serveur annonce la commande de vive voix.
 *
 * L'imprimante est branchée sur UN appareil : le réglage est donc celui
 * de l'appareil (navigateur), pas celui de la boutique. Un téléphone de
 * serveur sans imprimante n'imprime rien.
 */

export type Poste = "bar" | "cuisine" | "aucun";

export const LIBELLE_POSTE: Record<Poste, string> = {
  bar: "Bar",
  cuisine: "Cuisine",
  aucun: "Pas de bon",
};

const cle = (nom: string) => nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Le poste d'une rubrique quand rien n'a été réglé : la cuisine pour ce qui se mange. */
export function posteParDefaut(nomRubrique: string | null | undefined): Poste {
  const n = cle(nomRubrique ?? "");
  if (/cigarette|tabac/.test(n)) return "aucun";
  if (/plat|brochette|grillade|snack|cuisine|repas|sandwich|frite|soupe|salade|dessert/.test(n))
    return "cuisine";
  return "bar";
}

export interface ReglagesBons {
  /** Cet appareil a une imprimante de bons. */
  actif: boolean;
  /** La largeur du rouleau, en millimètres. */
  largeur: 58 | 80;
  /** Le poste choisi pour chaque rubrique (id de catégorie). */
  postes: Record<string, Poste>;
}

export const REGLAGES_PAR_DEFAUT: ReglagesBons = { actif: false, largeur: 80, postes: {} };

const cleReglages = (storeId: string) => `tantana.bar.bons.${storeId}`;
const cleNumero = (storeId: string) => `tantana.bar.bons.numero.${storeId}`;

export function lireReglagesBons(storeId: string): ReglagesBons {
  try {
    const brut = localStorage.getItem(cleReglages(storeId));
    if (!brut) return REGLAGES_PAR_DEFAUT;
    const r = JSON.parse(brut) as Partial<ReglagesBons>;
    return {
      actif: r.actif === true,
      largeur: r.largeur === 58 ? 58 : 80,
      postes: r.postes && typeof r.postes === "object" ? r.postes : {},
    };
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

export function enregistrerReglagesBons(storeId: string, r: ReglagesBons): void {
  try {
    localStorage.setItem(cleReglages(storeId), JSON.stringify(r));
  } catch {
    /* navigation privée : le réglage vaut le temps de la page */
  }
}

/** Le numéro du prochain bon : il repart à 1 chaque jour, sur cet appareil. */
export function prochainNumeroDeBon(storeId: string, jour: string): number {
  try {
    const brut = localStorage.getItem(cleNumero(storeId));
    const dernier = brut ? (JSON.parse(brut) as { jour?: string; n?: number }) : {};
    const n = dernier.jour === jour && typeof dernier.n === "number" ? dernier.n + 1 : 1;
    localStorage.setItem(cleNumero(storeId), JSON.stringify({ jour, n }));
    return n;
  } catch {
    return 1;
  }
}

export interface ArticleDuBon {
  productId: string | null;
  designation: string;
  quantite: number;
}

export interface Bon {
  poste: Exclude<Poste, "aucun">;
  lignes: { designation: string; quantite: number }[];
}

/**
 * Répartit une commande en bons, un par poste (le bar d'abord). Les
 * articles identiques se regroupent : « 3 THB » plutôt que trois lignes.
 */
export function bonsDeLaCommande(
  articles: ArticleDuBon[],
  rubriqueDuProduit: Map<string, { id: string; nom: string } | null>,
  postes: Record<string, Poste>,
): Bon[] {
  const parPoste = new Map<Bon["poste"], Map<string, number>>();
  for (const a of articles) {
    if (!a.productId || a.quantite <= 0) continue;
    const rubrique = rubriqueDuProduit.get(a.productId) ?? null;
    const poste = (rubrique && postes[rubrique.id]) || posteParDefaut(rubrique?.nom);
    if (poste === "aucun") continue;
    const lignes = parPoste.get(poste) ?? new Map<string, number>();
    lignes.set(a.designation, (lignes.get(a.designation) ?? 0) + a.quantite);
    parPoste.set(poste, lignes);
  }
  return (["bar", "cuisine"] as const)
    .filter((p) => parPoste.has(p))
    .map((poste) => ({
      poste,
      lignes: [...parPoste.get(poste)!.entries()].map(([designation, quantite]) => ({
        designation,
        quantite,
      })),
    }));
}

/**
 * La dernière commande envoyée sur une note : les lignes d'articles
 * insérées ensemble partagent le même horodatage (une seule écriture).
 */
export function derniereCommande<
  L extends { genre: string; annulee: boolean; cree_le: string; serveur: string | null },
>(lignes: L[]): L[] {
  const articles = lignes.filter((l) => l.genre === "article" && !l.annulee);
  if (articles.length === 0) return [];
  const derniere = articles.reduce((m, l) => (l.cree_le > m ? l.cree_le : m), "");
  return articles.filter((l) => l.cree_le === derniere);
}
