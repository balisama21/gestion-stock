/**
 * LE REGISTRE DES CARTES
 *
 * Une carte n'apparaît que si elle passe TROIS filtres, et l'ordre de
 * ces filtres compte :
 *
 *   1. LA BOUTIQUE a-t-elle gardé le module ? (`src/lib/personnalisation.ts`)
 *      Une boutique qui vend au comptoir et n'a pas activé les
 *      Commandes ne doit pas voir une carte « Suivi des commandes »
 *      à zéro.
 *   2. LA PERSONNE a-t-elle le droit de voir ce module ?
 *      (`src/lib/permissions.ts` — `visible`, puis `widgets` pour le
 *      réglage hérité du tableau de bord.)
 *   3. LA VUE choisie retient-elle cette carte ? (`roles.ts`)
 *      La vue ne donne AUCUN droit : elle ne fait que trier et
 *      ordonner ce que les deux premiers filtres ont déjà laissé
 *      passer.
 *
 * `donnees` dit de quoi la carte a besoin. Une carte masquée ne
 * déclenche pas ses lectures : c'est ce qui permet à un vendeur de ne
 * jamais faire partir la requête des mouvements de stock.
 */

/** Ce qu'une carte doit lire pour se remplir. */
export type BesoinDonnees =
  | "ventes"
  | "achats"
  | "depenses"
  | "produits"
  | "commandes"
  | "clients"
  | "paiements"
  | "devis"
  | "livraisons"
  | "taches"
  | "agenda"
  | "vendeurs"
  | "tresorerie"
  | "fournisseurs"
  /** Table jamais lue par le reste de l'application : lecture propre à la v2. */
  | "mouvements"
  /** Journal lu SANS le filtre qui écarte les créations. */
  | "journal";

export type CleCarte =
  | "tresorerie"
  | "ventes"
  | "agenda"
  | "stock"
  | "sorties"
  | "taches"
  | "vendeurs"
  | "commandes"
  | "fil"
  | "resultat"
  | "paiements"
  | "clients"
  | "ruptures"
  | "mouvements"
  | "top"
  | "livraisons"
  | "fournisseurs";

export type CleTuile = "ventes" | "entrees" | "sorties" | "stock" | "activite";

/**
 * LES QUATRE FAMILLES DE L'ÉCRAN
 *
 * Dix-sept cartes posées à la suite dans une grille unique donnaient
 * dix-sept choses à lire avant de comprendre. Regroupées sous un
 * titre, elles se parcourent par question plutôt que par carte : ce
 * qu'il faut faire, où en est l'argent, ce qui s'est vendu, ce qu'il
 * reste en stock.
 *
 * « tête » n'est pas un groupe : c'est la carte du chiffre
 * d'affaires, seule au-dessus des autres et sans titre. C'est le seul
 * gros chiffre de l'écran, et rien ne doit lui disputer la place.
 */
export type GroupeCarte = "tete" | "aujourdhui" | "argent" | "ventes" | "stock";

/** Dans l'ordre d'affichage. La tête n'y figure pas : elle n'a pas de titre. */
export const GROUPES: { cle: Exclude<GroupeCarte, "tete">; titre: string }[] = [
  { cle: "aujourdhui", titre: "Aujourd’hui" },
  { cle: "argent", titre: "L’argent" },
  { cle: "ventes", titre: "Les ventes" },
  { cle: "stock", titre: "Le stock" },
];

export interface DefinitionCarte {
  cle: CleCarte;
  /** Sous quel titre la carte se range. Voir `GROUPES`. */
  groupe: GroupeCarte;
  titre: string;
  /** Largeur dans la grille de douze colonnes, sur grand écran. */
  span: 4 | 5 | 6 | 7 | 8 | 12;
  /** Masquée par le mode focus : une carte qu'on consulte, pas qu'on surveille. */
  secondaire?: boolean;
  /** Module de `MODULE_DEFINITIONS` dont dépend la visibilité. */
  module: string;
  /**
   * Clé de `DASHBOARD_WIDGETS`, le réglage hérité du tableau de bord.
   * Absente : la carte ne dépend que de la visibilité de son module.
   *
   * TABLE DE CORRESPONDANCE. Les 21 clés de widgets ont été écrites
   * pour l'ancien tableau de bord ; la maquette en compte dix-huit
   * cartes, qui ne se recouvrent pas une pour une. Chaque
   * rapprochement est donc posé ici, en clair, plutôt que deviné à
   * l'exécution : c'est la seule façon qu'un réglage posé il y a six
   * mois continue de vouloir dire quelque chose.
   */
  widget?: string;
  /**
   * Champ sensible sans lequel la carte n'a plus d'objet. Un
   * collaborateur qui n'a pas le droit de voir les montants ne verra
   * pas « Fournisseurs à payer », plutôt qu'une carte de points de
   * suspension.
   */
  champRequis?: { module: string; champ: string };
  donnees: BesoinDonnees[];
}

export const CARTES: DefinitionCarte[] = [
  {
    cle: "tresorerie",
    groupe: "argent",
    titre: "Trésorerie · argent disponible",
    span: 5,
    module: "capital",
    widget: "tresorerie",
    donnees: ["tresorerie", "ventes", "achats", "depenses", "commandes"],
  },
  {
    cle: "ventes",
    groupe: "tete",
    titre: "Ventes du mois",
    span: 7,
    module: "ventes",
    widget: "chiffre_affaires",
    donnees: ["ventes"],
  },
  {
    cle: "agenda",
    groupe: "aujourdhui",
    titre: "Agenda de la boutique",
    span: 4,
    module: "agenda",
    donnees: ["agenda", "taches", "livraisons"],
  },
  {
    cle: "stock",
    groupe: "stock",
    titre: "Étagère de stock",
    span: 4,
    module: "produits",
    widget: "stock_disponible",
    donnees: ["produits"],
  },
  {
    cle: "sorties",
    groupe: "argent",
    titre: "Sorties",
    span: 4,
    module: "depenses",
    widget: "depenses",
    donnees: ["achats", "depenses", "ventes"],
  },
  {
    cle: "taches",
    groupe: "aujourdhui",
    titre: "À faire",
    span: 4,
    module: "taches",
    donnees: ["taches", "devis"],
  },
  {
    cle: "vendeurs",
    groupe: "ventes",
    titre: "Classement vendeurs",
    span: 4,
    secondaire: true,
    module: "vendeurs",
    widget: "perf_equipe",
    donnees: ["vendeurs"],
  },
  {
    cle: "commandes",
    groupe: "ventes",
    titre: "Suivi des commandes",
    span: 4,
    secondaire: true,
    module: "commandes",
    widget: "commandes",
    donnees: ["commandes", "livraisons"],
  },
  {
    cle: "fil",
    groupe: "ventes",
    titre: "Fil des ventes",
    span: 8,
    secondaire: true,
    module: "ventes",
    widget: "dernieres_ventes",
    donnees: ["ventes", "produits"],
  },
  {
    cle: "resultat",
    groupe: "argent",
    titre: "Résultat du mois",
    span: 4,
    module: "rapports",
    widget: "benefices",
    donnees: ["ventes", "depenses", "achats"],
  },
  {
    cle: "paiements",
    groupe: "argent",
    titre: "Paiements",
    span: 4,
    module: "paiements",
    widget: "montants_a_recevoir",
    donnees: ["paiements", "ventes", "commandes"],
  },
  {
    cle: "clients",
    groupe: "ventes",
    titre: "Clients",
    span: 4,
    module: "clients",
    donnees: ["clients", "ventes"],
  },
  {
    cle: "ruptures",
    groupe: "stock",
    titre: "Ruptures à venir",
    span: 4,
    module: "produits",
    widget: "produits_rupture",
    donnees: ["produits", "ventes"],
  },
  {
    cle: "mouvements",
    groupe: "stock",
    titre: "Entrées & sorties de stock",
    span: 8,
    secondaire: true,
    module: "produits",
    widget: "stock_faible",
    donnees: ["mouvements", "achats", "ventes"],
  },
  {
    cle: "top",
    groupe: "ventes",
    titre: "Produits les plus vendus",
    span: 4,
    module: "ventes",
    widget: "produits_plus_vendus",
    donnees: ["ventes", "produits"],
  },
  {
    cle: "livraisons",
    groupe: "aujourdhui",
    titre: "Livraisons & réceptions",
    span: 6,
    module: "livraisons",
    donnees: ["livraisons", "commandes"],
  },
  {
    cle: "fournisseurs",
    groupe: "argent",
    titre: "Fournisseurs à payer",
    span: 6,
    module: "fournisseurs",
    widget: "montants_a_payer",
    champRequis: { module: "achats", champ: "prix_achat" },
    donnees: ["achats", "fournisseurs"],
  },
];

export const CARTE_PAR_CLE = new Map(CARTES.map((c) => [c.cle, c]));

export interface DefinitionTuile {
  cle: CleTuile;
  titre: string;
  module: string;
  widget?: string;
  donnees: BesoinDonnees[];
}

export const TUILES: DefinitionTuile[] = [
  {
    cle: "ventes",
    titre: "Ventes du jour",
    module: "ventes",
    widget: "chiffre_affaires",
    donnees: ["ventes"],
  },
  {
    cle: "entrees",
    titre: "Entrées d'argent",
    module: "paiements",
    widget: "revenus",
    donnees: ["paiements", "ventes"],
  },
  {
    cle: "sorties",
    titre: "Sorties d'argent",
    module: "depenses",
    widget: "depenses",
    donnees: ["achats", "depenses"],
  },
  {
    cle: "stock",
    titre: "Stock du jour",
    module: "produits",
    widget: "stock_disponible",
    donnees: ["produits", "mouvements", "achats", "ventes"],
  },
  {
    cle: "activite",
    titre: "Activité aujourd'hui",
    module: "historique",
    widget: "activites_recentes",
    donnees: ["journal"],
  },
];

/**
 * CE QUE LA MAQUETTE DEMANDAIT ET QUI N'EXISTE PAS EN BASE
 *
 * Gardé en toutes lettres pour que personne n'ait à refaire l'enquête :
 * ni table, ni colonne `objectif`, `goal` ou `target` dans les
 * trente-cinq tables de `database.types.ts`, et aucune trace dans le
 * code. La carte « Objectif », la ligne d'objectif du graphique des
 * ventes et la barre d'objectif de la tuile du jour sont donc absentes.
 * Voir `docs/dashboard-v2/audit.md`, § 7, pour ce qu'il faudrait créer.
 */
export const SANS_DONNEES = ["objectif", "reception_fournisseur"] as const;
