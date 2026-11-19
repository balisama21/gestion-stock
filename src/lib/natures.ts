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
    description: "Tables numérotées, notes ouvertes, droit de table, addition partagée.",
    disponible: true,
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

/* ─────────────────────────────────────────────────────────────
 * L'intérieur propre à chaque nature
 * ───────────────────────────────────────────────────────────── */

/**
 * Ce qu'une nature change à l'intérieur : le nom des écrans, ceux qui
 * n'ont rien à y faire, et les raccourcis de la barre du bas.
 *
 * Ce ne sont que des valeurs PAR DÉFAUT, appliquées à l'affichage et
 * jamais enregistrées : un nom ou un masque choisi par la boutique dans
 * ses réglages l'emporte toujours. Les données ne bougent pas ; une
 * boutique standard ne voit aucune différence.
 */
export interface InterieurDeNature {
  /** Le nom des écrans, par clé de module (« produits » → « Carte »). */
  libelles?: Record<string, string>;
  /** Les écrans retirés du menu. Leurs données restent. */
  masques?: string[];
  /** Les raccourcis de la barre du bas, dans l'ordre (« Plus » s'ajoute seul). */
  barreDuBas?: string[];
}

export const INTERIEURS: Partial<Record<CleNature, InterieurDeNature>> = {
  karaoke: {
    libelles: {
      dashboard: "Ce soir",
      salle: "Salle",
      produits: "Carte",
      ventes: "Caisse",
      achats: "Entrées de stock",
      vendeurs: "Équipe",
    },
    masques: [
      "devis",
      "commandes",
      "livraisons",
      "prestataires",
      "notes_frais",
      "vue_equipe",
      "taches",
      "agenda",
      "rappels",
    ],
    barreDuBas: ["dashboard", "salle", "produits", "ventes"],
  },
};

export const interieurDe = (personnalisation: unknown): InterieurDeNature =>
  INTERIEURS[natureDe(personnalisation)] ?? {};

/**
 * La personnalisation telle qu'elle s'affiche : celle de la boutique,
 * complétée par l'intérieur de sa nature là où elle n'a rien choisi.
 *
 * À NE JAMAIS RÉENREGISTRER : les réglages s'écrivent depuis la
 * personnalisation brute, sinon les valeurs par défaut de la nature
 * deviendraient des choix de la boutique.
 */
export function avecLInterieur<
  P extends { modules?: Record<string, { libelle?: string; masque?: boolean }> },
>(perso: P): P {
  const interieur = interieurDe(perso);
  if (!interieur.libelles && !interieur.masques) return perso;
  const modules: Record<string, { libelle?: string; masque?: boolean }> = {
    ...(perso.modules ?? {}),
  };
  for (const [cle, libelle] of Object.entries(interieur.libelles ?? {})) {
    if (!modules[cle]?.libelle?.trim()) modules[cle] = { ...modules[cle], libelle };
  }
  for (const cle of interieur.masques ?? []) {
    if (modules[cle]?.masque === undefined) modules[cle] = { ...modules[cle], masque: true };
  }
  return { ...perso, modules };
}
