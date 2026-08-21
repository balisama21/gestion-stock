/**
 * Permissions accordables à un collaborateur invité, choisies par le
 * propriétaire AVANT l'envoi de l'invitation (Étape 10). Les clés
 * correspondent aux onglets principaux de l'app (ActiveTab dans types.ts).
 *
 * Stockées dans `collaborator_invitations.permissions` puis recopiées
 * dans `store_members.permissions` à l'acceptation.
 *
 * NOTE IMPORTANTE : ceci filtre actuellement l'AFFICHAGE (navigation,
 * onglets visibles) côté client. Ce n'est pas encore une barrière de
 * sécurité RLS au niveau des données elles-mêmes (ex: un collaborateur
 * sans la permission "capital" ne verra pas l'onglet, mais une requête
 * directe à la table `capital_apports` ne serait pas bloquée par une
 * policy dédiée à cette permission). Le sujet est noté pour une étape
 * de sécurisation ultérieure si nécessaire.
 */
export interface PermissionDef {
  key: string;
  label: string;
}

export const AVAILABLE_PERMISSIONS: PermissionDef[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "capital", label: "Capital / Trésorerie" },
  { key: "commandes", label: "Commandes" },
  { key: "paiements", label: "Paiements à recevoir" },
  { key: "clients", label: "Clients" },
  { key: "produits", label: "Produits" },
  { key: "achats", label: "Achats" },
  { key: "ventes", label: "Ventes" },
  { key: "vendeurs", label: "Vendeurs" },
  { key: "depenses", label: "Dépenses" },
  { key: "statistiques", label: "Statistiques" },
  { key: "rapports", label: "Rapports" },
  { key: "historique", label: "Historique" },
  { key: "settings", label: "Paramètres" },
];

export const ALL_PERMISSION_KEYS = AVAILABLE_PERMISSIONS.map((p) => p.key);