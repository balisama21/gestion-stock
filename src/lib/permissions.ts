/**
 * SYSTÈME DE PERMISSIONS v2 (21/08/2026)
 * =======================================
 * Remplace l'ancien modèle "liste plate de modules cochés" par un modèle
 * à 4 couches, comme un vrai SaaS :
 *
 *   RÔLE (gabarit) → MODULES (visibilité) → PORTÉE (own/team/all) →
 *   ACTIONS (create/edit/delete/...) → CHAMPS SENSIBLES (masqués ou non)
 *
 * COMPATIBILITÉ : l'ancien format stocké en base était un simple tableau
 * de clés de modules, ex: `["dashboard","ventes","clients"]` (= accès
 * total à ces modules, portée "all", toutes actions, tous champs).
 * `normalizePermissions()` reconnaît les deux formats et convertit
 * toujours l'ancien vers le nouveau à la volée — aucune donnée existante
 * n'est perdue ni cassée.
 *
 * DÉPLOIEMENT PROGRESSIF : les modules sont mis à niveau un par un.
 * État au 03/09/2026 :
 *   - PORTÉE (own/all) appliquée : Dashboard, Capital, Ventes, Clients,
 *     Produits, Commandes, Dépenses, Paiements à recevoir, Historique,
 *     Statistiques/Rapports.
 *   - CHAMPS SENSIBLES appliqués : Produits (prix d'achat, fournisseur,
 *     valeur du stock), Ventes (montant, paiement, solde, marge,
 *     bénéfice), Achats (prix d'achat, fournisseur) — Étape E.
 *   - Les autres modules n'utilisent encore que `visible` (comportement
 *     identique à avant).
 *
 * ATTENTION : tout ceci est un filtrage d'AFFICHAGE côté client. La
 * sécurisation réelle au niveau des données (RLS Postgres) est l'Étape F,
 * pas encore faite.
 */

export type DataScope = "own" | "team" | "all";

export interface ActionDef {
  key: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
}

export interface ModuleDef {
  key: string;
  label: string;
  /** Ce module a-t-il une notion de "portée" (mes données / toute l'équipe / tout) ? */
  hasScope: boolean;
  /** Actions possibles à l'intérieur du module (vide = pas d'action distincte, juste visible/masqué) */
  actions: ActionDef[];
  /** Champs/informations potentiellement sensibles, à cocher individuellement */
  fields: FieldDef[];
}

/** Un module tel que configuré pour UN collaborateur donné. */
export interface ModulePermission {
  visible: boolean;
  scope?: DataScope;
  /** Clés d'actions autorisées (sous-ensemble de ModuleDef.actions) */
  actions?: string[];
  /** Clés de champs VISIBLES (sous-ensemble de ModuleDef.fields) — absent = tous visibles par défaut si le module l'est */
  fields?: string[];
  /** Cas spécial Dashboard : widgets activés (voir DASHBOARD_WIDGETS) */
  widgets?: string[];
}

export type PermissionsMap = Record<string, ModulePermission>;

// ─────────────────────────────────────────────────────────────────────
// DÉFINITION DES MODULES (les 14 existants, mêmes clés qu'avant)
// ─────────────────────────────────────────────────────────────────────

export const DASHBOARD_WIDGETS = {
  activite_commerciale: {
    label: "Activité commerciale",
    items: [
      { key: "chiffre_affaires", label: "Chiffre d'affaires" },
      { key: "nombre_ventes", label: "Nombre de ventes" },
      { key: "commandes", label: "Commandes" },
      { key: "evolution_ventes", label: "Évolution des ventes" },
    ],
  },
  finance: {
    label: "Finance",
    items: [
      { key: "tresorerie", label: "Capital / Trésorerie" },
      { key: "revenus", label: "Revenus" },
      { key: "depenses", label: "Dépenses" },
      { key: "benefices", label: "Bénéfices" },
      { key: "montants_a_recevoir", label: "Montants à recevoir" },
      { key: "montants_a_payer", label: "Montants à payer" },
    ],
  },
  stock: {
    label: "Stock",
    items: [
      { key: "stock_disponible", label: "Stock disponible" },
      { key: "produits_rupture", label: "Produits en rupture" },
      { key: "stock_faible", label: "Stock faible" },
      { key: "valeur_stock", label: "Valeur du stock" },
    ],
  },
  activite_recente: {
    label: "Activité récente",
    items: [
      { key: "dernieres_ventes", label: "Dernières ventes" },
      { key: "dernieres_commandes", label: "Dernières commandes" },
      { key: "derniers_paiements", label: "Derniers paiements" },
      { key: "activites_recentes", label: "Activités récentes" },
    ],
  },
  performance: {
    label: "Performance",
    items: [
      { key: "produits_plus_vendus", label: "Produits les plus vendus" },
      { key: "perf_personnelles", label: "Performances personnelles" },
      { key: "perf_equipe", label: "Performances de l'équipe" },
    ],
  },
} as const;

export const ALL_DASHBOARD_WIDGET_KEYS = Object.values(DASHBOARD_WIDGETS).flatMap((g) =>
  g.items.map((i) => i.key),
);

export const MODULE_DEFINITIONS: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    hasScope: false,
    actions: [],
    fields: [], // Le dashboard utilise `widgets`, pas `fields` (voir DASHBOARD_WIDGETS)
  },
  {
    key: "capital",
    label: "Capital / Trésorerie",
    hasScope: false,
    actions: [
      { key: "view", label: "Voir la trésorerie" },
      { key: "add_operation", label: "Ajouter une opération" },
      { key: "edit_operation", label: "Modifier une opération" },
      { key: "view_history", label: "Voir l'historique" },
    ],
    fields: [
      { key: "tresorerie", label: "Trésorerie globale" },
      { key: "revenus", label: "Revenus" },
      { key: "depenses", label: "Dépenses" },
      { key: "benefices", label: "Bénéfices" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    hasScope: true,
    actions: [
      { key: "view", label: "Voir la liste" },
      { key: "create", label: "Ajouter un client" },
      { key: "edit", label: "Modifier un client" },
      { key: "delete", label: "Supprimer un client" },
    ],
    fields: [
      { key: "coordonnees", label: "Coordonnées" },
      { key: "historique_commandes", label: "Historique des commandes" },
      { key: "historique_achats", label: "Historique des achats" },
      { key: "paiements", label: "Paiements" },
      { key: "solde", label: "Solde client" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "fournisseurs",
    label: "Fournisseurs",
    hasScope: false,
    actions: [
      { key: "view", label: "Voir la liste" },
      { key: "create", label: "Ajouter un fournisseur" },
      { key: "edit", label: "Modifier un fournisseur" },
      { key: "delete", label: "Supprimer un fournisseur" },
    ],
    fields: [
      { key: "coordonnees", label: "Coordonnées" },
      { key: "conditions", label: "Conditions de paiement et délais" },
      { key: "historique_achats", label: "Historique des achats" },
      { key: "montants", label: "Montants achetés" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "prestataires",
    label: "Prestataires",
    hasScope: false,
    actions: [
      { key: "view", label: "Voir la liste" },
      { key: "create", label: "Ajouter un prestataire" },
      { key: "edit", label: "Modifier un prestataire" },
      { key: "delete", label: "Supprimer un prestataire" },
    ],
    fields: [
      { key: "coordonnees", label: "Coordonnées" },
      { key: "prestations", label: "Prestations et tarifs" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "produits",
    label: "Produits",
    hasScope: false,
    actions: [
      { key: "view", label: "Voir les produits" },
      { key: "create", label: "Ajouter" },
      { key: "edit", label: "Modifier" },
      { key: "delete", label: "Supprimer" },
      { key: "adjust_stock", label: "Ajuster le stock" },
      { key: "inventory", label: "Faire un inventaire" },
    ],
    fields: [
      { key: "nom", label: "Nom" },
      { key: "prix_vente", label: "Prix de vente" },
      { key: "prix_achat", label: "Prix d'achat" },
      { key: "stock_disponible", label: "Stock disponible" },
      { key: "valeur_stock", label: "Valeur du stock" },
      { key: "fournisseur", label: "Fournisseur" },
    ],
  },
  {
    key: "commandes",
    label: "Commandes",
    hasScope: true,
    actions: [
      { key: "create", label: "Créer" },
      { key: "edit", label: "Modifier" },
      { key: "cancel", label: "Annuler" },
      { key: "delete", label: "Supprimer" },
    ],
    fields: [
      { key: "client", label: "Client" },
      { key: "produits", label: "Produits" },
      { key: "montant", label: "Montant" },
      { key: "statut", label: "Statut" },
      { key: "paiement", label: "Paiement" },
      { key: "livraison", label: "Livraison" },
    ],
  },
  {
    key: "ventes",
    label: "Ventes",
    hasScope: true,
    actions: [
      { key: "create", label: "Créer une vente" },
      { key: "edit", label: "Modifier" },
      { key: "cancel", label: "Annuler" },
      { key: "delete", label: "Supprimer" },
      { key: "refund", label: "Faire un remboursement" },
    ],
    fields: [
      { key: "montant", label: "Montant de la vente" },
      { key: "paiement", label: "Paiement reçu" },
      { key: "solde", label: "Solde" },
      { key: "benefice", label: "Bénéfice" },
      { key: "marge", label: "Marge" },
    ],
  },
  {
    key: "paiements",
    label: "Paiements à recevoir",
    hasScope: true,
    actions: [
      { key: "add", label: "Ajouter un paiement" },
      { key: "edit", label: "Modifier un paiement" },
      { key: "cancel", label: "Annuler un paiement" },
    ],
    fields: [
      { key: "soldes", label: "Soldes" },
      { key: "financier_global", label: "Informations financières globales" },
    ],
  },
  {
    key: "achats",
    label: "Achats",
    hasScope: false,
    actions: [
      { key: "view", label: "Voir les achats" },
      { key: "create", label: "Créer un achat" },
      { key: "edit", label: "Modifier" },
      { key: "delete", label: "Supprimer" },
    ],
    fields: [
      { key: "prix_fournisseurs", label: "Prix d'achat / montants fournisseurs" },
      // Séparé de `prix_fournisseurs` : savoir COMBIEN on achète et savoir
      // CHEZ QUI on achète sont deux secrets commerciaux distincts. Un
      // magasinier peut avoir besoin des quantités et du nom du fournisseur
      // pour réceptionner sans jamais voir les prix négociés — et
      // inversement.
      { key: "fournisseur", label: "Nom des fournisseurs" },
      { key: "paiements_fournisseurs", label: "Paiements fournisseurs" },
    ],
  },
  {
    key: "vendeurs",
    label: "Vendeurs",
    hasScope: false,
    actions: [{ key: "view", label: "Voir l'équipe" }],
    fields: [],
  },
  {
    key: "depenses",
    label: "Dépenses",
    hasScope: true,
    actions: [
      { key: "view", label: "Voir les dépenses" },
      { key: "create", label: "Ajouter une dépense" },
      { key: "edit", label: "Modifier" },
      { key: "delete", label: "Supprimer" },
    ],
    fields: [],
  },
  {
    key: "statistiques",
    label: "Statistiques",
    hasScope: false,
    actions: [{ key: "export", label: "Exporter" }],
    fields: [
      { key: "ventes", label: "Statistiques de ventes" },
      { key: "depenses", label: "Statistiques de dépenses" },
      { key: "benefices", label: "Bénéfices" },
      { key: "perf_personnelles", label: "Performances personnelles" },
      { key: "perf_equipe", label: "Performances de l'équipe" },
    ],
  },
  {
    key: "rapports",
    label: "Rapports",
    hasScope: false,
    actions: [{ key: "export", label: "Exporter" }],
    fields: [],
  },
  {
    key: "historique",
    label: "Historique",
    hasScope: true,
    actions: [],
    fields: [],
  },
  {
    key: "settings",
    label: "Paramètres",
    hasScope: false,
    actions: [{ key: "edit_own_profile", label: "Modifier son propre profil" }],
    fields: [],
  },
];

export const MODULE_KEYS = MODULE_DEFINITIONS.map((m) => m.key);
export const getModuleDef = (key: string) => MODULE_DEFINITIONS.find((m) => m.key === key);

// ─────────────────────────────────────────────────────────────────────
// HELPERS DE CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────

/** Accès complet à un module (tout coché) — utilisé pour le Owner et pour convertir l'ancien format. */
function fullAccessTo(key: string): ModulePermission {
  const def = getModuleDef(key);
  if (!def) return { visible: true };
  return {
    visible: true,
    scope: def.hasScope ? "all" : undefined,
    actions: def.actions.map((a) => a.key),
    fields: def.fields.map((f) => f.key),
    widgets: key === "dashboard" ? [...ALL_DASHBOARD_WIDGET_KEYS] : undefined,
  };
}

export const EMPTY_PERMISSIONS: PermissionsMap = {};

export const FULL_PERMISSIONS: PermissionsMap = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, fullAccessTo(k)]),
);

// ─────────────────────────────────────────────────────────────────────
// COMPATIBILITÉ ASCENDANTE : ancien format = tableau de clés de modules
// ─────────────────────────────────────────────────────────────────────

/** Convertit l'ancien format `["dashboard","ventes"]` vers le nouveau. */
export function legacyArrayToPermissions(keys: string[]): PermissionsMap {
  const result: PermissionsMap = {};
  for (const key of keys) {
    if (MODULE_KEYS.includes(key)) {
      result[key] = fullAccessTo(key);
    }
  }
  return result;
}

/**
 * Accepte n'importe quelle donnée brute venant de la base (ancien tableau
 * OU nouvel objet OU valeur invalide/nulle) et retourne toujours une
 * PermissionsMap valide. Ne JAMAIS lire `store_members.permissions` /
 * `collaborator_invitations.permissions` directement sans passer par ici.
 */
export function normalizePermissions(raw: unknown): PermissionsMap {
  if (!raw) return {};
  if (Array.isArray(raw)) return legacyArrayToPermissions(raw as string[]);
  if (typeof raw === "object") return raw as PermissionsMap;
  return {};
}

/**
 * Vue "à plat" compatible avec l'ancien système (liste des modules
 * visibles) — permet à tout le code déjà écrit (Header.tsx, BalsamaApp.tsx,
 * VentesView.tsx...) de continuer à fonctionner SANS modification tant
 * qu'il n'a pas été mis à niveau vers la granularité fine.
 */
export function permissionsToVisibleModules(perms: PermissionsMap): string[] {
  return Object.entries(perms)
    .filter(([, p]) => p.visible)
    .map(([key]) => key);
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS DE LECTURE (à utiliser au fur et à mesure de la mise à niveau
// module par module — Étapes C/D)
// ─────────────────────────────────────────────────────────────────────

export function isModuleVisible(perms: PermissionsMap, moduleKey: string): boolean {
  return perms[moduleKey]?.visible === true;
}

export function getModuleScope(perms: PermissionsMap, moduleKey: string): DataScope {
  return perms[moduleKey]?.scope ?? "own";
}

export function hasModuleAction(perms: PermissionsMap, moduleKey: string, action: string): boolean {
  return perms[moduleKey]?.actions?.includes(action) === true;
}

export function isFieldVisible(perms: PermissionsMap, moduleKey: string, field: string): boolean {
  const mod = perms[moduleKey];
  if (!mod?.visible) return false;
  // Absence de la clé `fields` = tous les champs visibles par défaut
  // (rétro-compatibilité avec l'ancien "tout ou rien").
  if (!mod.fields) return true;
  return mod.fields.includes(field);
}

export function isWidgetVisible(perms: PermissionsMap, widgetKey: string): boolean {
  const dash = perms.dashboard;
  if (!dash?.visible) return false;
  if (!dash.widgets) return true;
  return dash.widgets.includes(widgetKey);
}

// ─────────────────────────────────────────────────────────────────────
// GABARITS DE RÔLES — appliqués automatiquement à la sélection, puis
// personnalisables librement par le propriétaire (Étape B, UI à venir).
// ─────────────────────────────────────────────────────────────────────

export type RoleKey = "admin" | "manager" | "comptable" | "vendeur" | "gestionnaire_stock";

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: "Administrateur",
  manager: "Manager",
  comptable: "Comptable",
  vendeur: "Vendeur",
  gestionnaire_stock: "Gestionnaire de stock",
};

function module(
  key: string,
  visible: boolean,
  opts: Partial<Omit<ModulePermission, "visible">> = {},
): [string, ModulePermission] {
  return [key, { visible, ...opts }];
}

/** ADMINISTRATEUR : accès total, équivalent au propriétaire. */
const ADMIN_TEMPLATE: PermissionsMap = FULL_PERMISSIONS;

/** MANAGER : voit tout sauf la gestion des permissions/paramètres financiers avancés. */
const MANAGER_TEMPLATE: PermissionsMap = Object.fromEntries([
  module("dashboard", true, {
    widgets: ALL_DASHBOARD_WIDGET_KEYS.filter((w) => w !== "benefices"),
  }),
  module("capital", true, {
    actions: ["view", "view_history"],
    fields: ["tresorerie", "revenus", "depenses"],
  }),
  module("clients", true, {
    scope: "all",
    actions: ["view", "create", "edit"],
    fields: getModuleDef("clients")!.fields.map((f) => f.key),
  }),
  module("produits", true, {
    actions: ["view", "create", "edit", "adjust_stock"],
    fields: getModuleDef("produits")!.fields.map((f) => f.key),
  }),
  module("commandes", true, {
    scope: "all",
    actions: ["create", "edit", "cancel"],
    fields: getModuleDef("commandes")!.fields.map((f) => f.key),
  }),
  module("ventes", true, {
    scope: "all",
    actions: ["create", "edit", "cancel"],
    fields: getModuleDef("ventes")!.fields.map((f) => f.key),
  }),
  module("paiements", true, {
    scope: "all",
    actions: ["add", "edit"],
    fields: getModuleDef("paiements")!.fields.map((f) => f.key),
  }),
  module("achats", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("achats")!.fields.map((f) => f.key),
  }),
  module("fournisseurs", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("fournisseurs")!.fields.map((f) => f.key),
  }),
  module("prestataires", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("prestataires")!.fields.map((f) => f.key),
  }),
  module("vendeurs", true, { actions: ["view"] }),
  module("depenses", true, { scope: "all", actions: ["view", "create", "edit"] }),
  module("statistiques", true, { fields: getModuleDef("statistiques")!.fields.map((f) => f.key) }),
  module("rapports", true, { actions: ["export"] }),
  module("historique", true, { scope: "all" }),
  module("settings", true, { actions: ["edit_own_profile"] }),
]);

/** COMPTABLE : focalisé finance, pas de gestion produits/stock. */
const COMPTABLE_TEMPLATE: PermissionsMap = Object.fromEntries([
  module("dashboard", true, {
    widgets: [
      ...DASHBOARD_WIDGETS.finance.items.map((i) => i.key),
      ...DASHBOARD_WIDGETS.activite_commerciale.items.map((i) => i.key),
    ],
  }),
  module("capital", true, {
    actions: ["view", "add_operation", "edit_operation", "view_history"],
    fields: getModuleDef("capital")!.fields.map((f) => f.key),
  }),
  module("clients", true, {
    scope: "all",
    actions: ["view"],
    fields: ["coordonnees", "paiements", "solde"],
  }),
  module("produits", false),
  module("commandes", true, {
    scope: "all",
    actions: [],
    fields: ["client", "montant", "statut", "paiement"],
  }),
  module("ventes", true, {
    scope: "all",
    actions: [],
    fields: getModuleDef("ventes")!.fields.map((f) => f.key),
  }),
  module("paiements", true, {
    scope: "all",
    actions: ["add", "edit", "cancel"],
    fields: getModuleDef("paiements")!.fields.map((f) => f.key),
  }),
  module("achats", true, {
    actions: ["view"],
    fields: getModuleDef("achats")!.fields.map((f) => f.key),
  }),
  module("fournisseurs", true, {
    actions: ["view"],
    fields: ["coordonnees", "historique_achats", "montants"],
  }),
  module("prestataires", true, {
    actions: ["view"],
    fields: ["coordonnees", "prestations"],
  }),
  module("vendeurs", false),
  module("depenses", true, { scope: "all", actions: ["view", "create", "edit"] }),
  module("statistiques", true, { fields: getModuleDef("statistiques")!.fields.map((f) => f.key) }),
  module("rapports", true, { actions: ["export"] }),
  module("historique", true, { scope: "all" }),
  module("settings", true, { actions: ["edit_own_profile"] }),
]);

/** VENDEUR : exactement l'exemple détaillé fourni par le propriétaire. */
const VENDEUR_TEMPLATE: PermissionsMap = Object.fromEntries([
  module("dashboard", true, {
    widgets: [
      "chiffre_affaires",
      "nombre_ventes",
      "commandes",
      "dernieres_ventes",
      "dernieres_commandes",
      "perf_personnelles",
    ],
  }),
  module("capital", false),
  module("clients", true, {
    scope: "own",
    actions: ["view", "create", "edit"],
    fields: ["coordonnees", "historique_commandes"],
  }),
  module("produits", true, {
    actions: ["view"],
    fields: ["nom", "prix_vente", "stock_disponible"],
  }),
  module("commandes", true, {
    scope: "own",
    actions: ["create", "edit"],
    fields: ["client", "produits", "montant", "statut"],
  }),
  module("ventes", true, { scope: "own", actions: ["create"], fields: ["montant", "paiement"] }),
  module("paiements", true, { scope: "own", actions: ["add"], fields: ["soldes"] }),
  module("achats", false),
  module("fournisseurs", false),
  module("prestataires", false),
  module("vendeurs", false),
  module("depenses", false),
  module("statistiques", true, { fields: ["perf_personnelles"] }),
  module("rapports", false),
  module("historique", true, { scope: "own" }),
  module("settings", true, { actions: ["edit_own_profile"] }),
]);

/** GESTIONNAIRE DE STOCK : produits/achats, rien de financier. */
const GESTIONNAIRE_STOCK_TEMPLATE: PermissionsMap = Object.fromEntries([
  module("dashboard", true, {
    widgets: [...DASHBOARD_WIDGETS.stock.items.map((i) => i.key), "activites_recentes"],
  }),
  module("capital", false),
  module("clients", false),
  module("produits", true, {
    actions: ["view", "create", "edit", "adjust_stock", "inventory"],
    fields: getModuleDef("produits")!
      .fields.filter((f) => f.key !== "valeur_stock")
      .map((f) => f.key),
  }),
  module("commandes", true, {
    scope: "all",
    actions: ["edit"],
    fields: ["produits", "statut", "livraison"],
  }),
  module("ventes", false),
  module("paiements", false),
  module("achats", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("achats")!.fields.map((f) => f.key),
  }),
  module("fournisseurs", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("fournisseurs")!.fields.map((f) => f.key),
  }),
  module("prestataires", true, {
    actions: ["view", "create", "edit"],
    fields: getModuleDef("prestataires")!.fields.map((f) => f.key),
  }),
  module("vendeurs", false),
  module("depenses", false),
  module("statistiques", false),
  module("rapports", false),
  module("historique", true, { scope: "own" }),
  module("settings", true, { actions: ["edit_own_profile"] }),
]);

export const ROLE_TEMPLATES: Record<RoleKey, PermissionsMap> = {
  admin: ADMIN_TEMPLATE,
  manager: MANAGER_TEMPLATE,
  comptable: COMPTABLE_TEMPLATE,
  vendeur: VENDEUR_TEMPLATE,
  gestionnaire_stock: GESTIONNAIRE_STOCK_TEMPLATE,
};

/** Résumé chiffré affiché à l'admin ("5 modules, 12 permissions, 4 masqués") — Étape B. */
export function summarizePermissions(perms: PermissionsMap) {
  const visibleModules = Object.values(perms).filter((p) => p.visible);
  const totalActions = visibleModules.reduce((acc, p) => acc + (p.actions?.length ?? 0), 0);
  const hiddenFieldsCount = MODULE_DEFINITIONS.reduce((acc, def) => {
    const p = perms[def.key];
    if (!p?.visible) return acc;
    const shown = p.fields?.length ?? def.fields.length;
    return acc + Math.max(0, def.fields.length - shown);
  }, 0);
  return {
    modulesCount: visibleModules.length,
    actionsCount: totalActions,
    hiddenFieldsCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// RÉTRO-COMPATIBILITÉ EXPORTÉE : l'ancienne liste utilisée par
// ParametresView.tsx (cases à cocher actuelles) reste disponible telle
// quelle tant que l'Étape B (nouvelle interface) n'est pas livrée.
// ─────────────────────────────────────────────────────────────────────

export interface PermissionDef {
  key: string;
  label: string;
}

export const AVAILABLE_PERMISSIONS: PermissionDef[] = MODULE_DEFINITIONS.map((m) => ({
  key: m.key,
  label: m.label,
}));

export const ALL_PERMISSION_KEYS = MODULE_KEYS;
