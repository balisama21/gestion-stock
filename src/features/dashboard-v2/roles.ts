import type { CleCarte, CleTuile } from "./registry";

/**
 * LES VUES PAR MÉTIER
 *
 * UNE VUE NE DONNE AUCUN DROIT. Elle choisit l'ordre et la sélection
 * des cartes parmi celles que les permissions ont déjà laissées
 * passer. Changer de vue ne fait donc jamais apparaître un chiffre
 * qu'on n'avait pas le droit de voir — au pire, une vue affiche moins
 * que ce à quoi on a droit.
 *
 * C'est pour cela que le fondateur peut toutes les prévisualiser : il
 * a déjà tous les droits, la vue ne lui en ajoute pas.
 *
 * LA VUE PAR DÉFAUT SE DÉDUIT DU RÔLE de `store_members`, et retombe
 * sur « Dirigeant » pour le propriétaire. Un rôle inconnu — la table
 * accepte du texte libre — retombe lui aussi sur une vue complète,
 * dont les permissions feront le tri : mieux vaut une vue trop large
 * dont chaque carte est filtrée qu'un écran vide.
 */

export type CleVue = "dirigeant" | "commercial" | "stock" | "finance" | "vendeur" | "livreur";

export interface Vue {
  cle: CleVue;
  nom: string;
  /** Une ligne pour dire à qui elle s'adresse. */
  resume: string;
  /** `null` = toutes les cartes, dans l'ordre du registre. */
  cartes: CleCarte[] | null;
  /** `null` = toutes les tuiles. */
  tuiles: CleTuile[] | null;
}

export const VUES: Vue[] = [
  {
    cle: "dirigeant",
    nom: "Dirigeant",
    resume: "Vue complète de la boutique",
    cartes: null,
    tuiles: null,
  },
  {
    cle: "commercial",
    nom: "Responsable commercial",
    resume: "Ventes, clients, objectifs",
    cartes: [
      "ventes",
      "top",
      "clients",
      "paiements",
      "vendeurs",
      "fil",
      "commandes",
      "taches",
      "agenda",
      "journal",
    ],
    tuiles: ["ventes", "entrees", "activite"],
  },
  {
    cle: "stock",
    nom: "Gestionnaire stock",
    resume: "Ruptures, entrées, achats",
    cartes: [
      "ruptures",
      "stock",
      "mouvements",
      "top",
      "sorties",
      "fournisseurs",
      "commandes",
      "livraisons",
      "taches",
      "agenda",
    ],
    tuiles: ["stock", "sorties", "activite"],
  },
  {
    cle: "finance",
    nom: "Comptabilité",
    resume: "Trésorerie, paiements, résultat",
    cartes: [
      "tresorerie",
      "resultat",
      "paiements",
      "sorties",
      "fournisseurs",
      "ventes",
      "clients",
      "journal",
      "taches",
      "agenda",
    ],
    tuiles: ["entrees", "sorties", "ventes", "activite"],
  },
  {
    cle: "vendeur",
    nom: "Vendeur",
    resume: "Mes ventes, mes clients",
    cartes: ["ventes", "top", "clients", "fil", "commandes", "taches", "agenda"],
    tuiles: ["ventes", "stock", "activite"],
  },
  {
    cle: "livreur",
    nom: "Livreur",
    resume: "Tournée et commandes",
    cartes: ["livraisons", "commandes", "agenda", "taches"],
    tuiles: ["activite"],
  },
];

export const VUE_PAR_CLE = new Map(VUES.map((v) => [v.cle, v]));

/**
 * Le rôle enregistré dans `store_members`, traduit en vue.
 *
 * Les clés de gauche sont celles de `RoleKey` (`src/lib/permissions.ts`).
 * « Responsable commercial » n'y a pas d'équivalent : c'est une vue de
 * prévisualisation, que seul le propriétaire peut choisir à la main.
 */
const ROLE_VERS_VUE: Record<string, CleVue> = {
  admin: "dirigeant",
  manager: "dirigeant",
  comptable: "finance",
  vendeur: "vendeur",
  gestionnaire_stock: "stock",
  livreur: "livreur",
};

export function vueDuRole(role: string | null, estProprietaire: boolean): CleVue {
  if (estProprietaire) return "dirigeant";
  if (!role) return "dirigeant";
  return ROLE_VERS_VUE[role] ?? "dirigeant";
}
