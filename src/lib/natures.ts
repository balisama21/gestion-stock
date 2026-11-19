/**
 * LA NATURE D'UNE BOUTIQUE
 *
 * Un hôtel, un bar-karaoké et une pharmacie n'ont pas les mêmes besoins.
 * Plutôt qu'un logiciel par métier, un seul logiciel dont la nature,
 * choisie à la création, décide plus tard des écrans, du vocabulaire et
 * des fonctions métier (tables et notes ouvertes, lots et péremption…).
 *
 * Les natures pas encore prêtes s'affichent déjà, marquées « En cours de
 * développement » et impossibles à choisir : on voit où va le logiciel.
 * On les ouvre une à une en passant `disponible` à `true`.
 *
 * La nature se range dans `stores.personnalisation.nature`, à côté des
 * autres réglages : pas de colonne à ajouter. Une boutique sans nature
 * (toutes celles créées avant) est une boutique standard.
 */

export type CleNature =
  | "standard"
  | "karaoke"
  | "pharmacie"
  | "restaurant"
  | "hotel"
  | "alimentation"
  | "services"
  | "inventaire";

export interface Nature {
  cle: CleNature;
  nom: string;
  /** Ce que la boutique y trouve, en une phrase. */
  description: string;
  /** Prête à l'emploi. Sinon : affichée, mais pas encore choisissable. */
  disponible: boolean;
}

export const NATURES: Nature[] = [
  {
    cle: "standard",
    nom: "Boutique standard",
    description: "Ventes, stock, achats, clients et factures : le logiciel complet.",
    disponible: true,
  },
  {
    cle: "karaoke",
    nom: "Bar-karaoké",
    description: "Tables numérotées, notes ouvertes, droit de table, consigne, inventaire du soir.",
    disponible: false,
  },
  {
    cle: "pharmacie",
    nom: "Pharmacie",
    description: "Lots, dates de péremption et alertes, vente du lot qui périme en premier.",
    disponible: false,
  },
  {
    cle: "restaurant",
    nom: "Restaurant / bar",
    description: "Tables, commandes, bons pour la cuisine et le bar, addition partagée.",
    disponible: false,
  },
  {
    cle: "hotel",
    nom: "Hôtel",
    description: "Chambres, réservations, arrivées et départs, note de séjour.",
    disponible: false,
  },
  {
    cle: "alimentation",
    nom: "Épicerie / alimentation",
    description: "Vente rapide, péremption des denrées, consigne des bouteilles.",
    disponible: false,
  },
  {
    cle: "services",
    nom: "Salon / services",
    description: "Prestations, rendez-vous et agenda, sans stock à gérer.",
    disponible: false,
  },
  {
    cle: "inventaire",
    nom: "Inventaire uniquement",
    description: "Stock, entrées, sorties et comptages, sans caisse ni ventes.",
    disponible: false,
  },
];

export const NATURE_PAR_DEFAUT: CleNature = "standard";

const CLES = new Set<string>(NATURES.map((n) => n.cle));

export const estCleNature = (v: unknown): v is CleNature => typeof v === "string" && CLES.has(v);

/** La nature d'une boutique, lue dans sa personnalisation. Standard par défaut. */
export function natureDe(personnalisation: unknown): CleNature {
  const v =
    personnalisation && typeof personnalisation === "object" && !Array.isArray(personnalisation)
      ? (personnalisation as { nature?: unknown }).nature
      : undefined;
  return estCleNature(v) ? v : NATURE_PAR_DEFAUT;
}

export const natureParCle = (cle: CleNature): Nature =>
  NATURES.find((n) => n.cle === cle) ?? NATURES[0];

/** Une nature qu'on peut choisir aujourd'hui ; sinon la nature par défaut. */
export const natureChoisissable = (cle: CleNature | null | undefined): CleNature =>
  cle && natureParCle(cle).disponible ? cle : NATURE_PAR_DEFAUT;
