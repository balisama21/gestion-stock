import { dateEcheance, type Echeance } from "../../features/documents/lib/format";

/**
 * LES STATUTS D'UNE PIÈCE, ET RIEN D'AUTRE.
 *
 * Fonctions pures, sans accès à la base : ce fichier reçoit des
 * nombres et des dates et rend un mot. C'est ce qui permet de vérifier
 * le passage « En retard » sans attendre demain.
 *
 * ── PAS DE BROUILLON POUR UNE FACTURE ──────────────────────────────
 *
 * Une vente est enregistrée au moment où elle existe : le stock est
 * sorti, la caisse a bougé. Il n'y a pas d'état intermédiaire à
 * inventer, et la règle légale — seul un brouillon se modifie ou se
 * supprime — est donc satisfaite au plus strict : aucune facture ne se
 * modifie ni ne se supprime. Le brouillon reste au devis et à la
 * proforma, qui en ont un vrai.
 */

export type StatutFacture =
  | "emise"
  | "envoyee"
  | "partiel"
  | "payee"
  | "retard"
  | "annulee";

export type StatutOffre = "brouillon" | "attente" | "accepte" | "refuse" | "expire" | "converti";

export type StatutFactureAchat = "a_payer" | "partiel" | "payee";

export type StatutDocument = StatutFacture | StatutOffre | StatutFactureAchat;

export const LIBELLE_STATUT: Record<StatutDocument, string> = {
  emise: "Émise",
  envoyee: "Envoyée",
  partiel: "Partiellement payée",
  payee: "Payée",
  retard: "En retard",
  annulee: "Annulée",
  brouillon: "Brouillon",
  attente: "En attente",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  converti: "Converti en facture",
  a_payer: "À payer",
};

/**
 * La couleur du badge. Le mot est toujours là : la couleur double
 * l'information, elle ne la porte jamais seule.
 */
export const CLASSE_STATUT: Record<StatutDocument, string> = {
  emise: "app-badge-neutral",
  envoyee: "app-badge-info",
  partiel: "app-badge-warning",
  payee: "app-badge-success",
  retard: "app-badge-danger",
  annulee: "app-badge-neutral",
  brouillon: "app-badge-neutral",
  attente: "app-badge-info",
  accepte: "app-badge-success",
  refuse: "app-badge-danger",
  expire: "app-badge-warning",
  converti: "app-badge-success",
  a_payer: "app-badge-warning",
};

/**
 * La date à laquelle une facture devient exigible.
 *
 * « À réception » et « comptant » ne rendent aucune date à l'impression
 * — le libellé est alors la réponse complète. Mais pour savoir si une
 * créance est en retard, ils désignent bien un jour : celui du
 * document. Une facture payable à réception, impayée depuis la semaine
 * dernière, EST en retard.
 */
export function echeanceExigible(date: string, echeance: Echeance): string {
  return dateEcheance(date, echeance) ?? date;
}

export interface EtatFacture {
  montant: number;
  paye: number;
  /** Un avoir couvre-t-il cette facture ? */
  annulee: boolean;
  /** Au moins un envoi enregistré. */
  envoyee: boolean;
  echeance: string;
  /** La date du jour, prise sur le serveur. */
  aujourdhui: string;
}

/**
 * L'ordre compte : il va du plus grave au plus ordinaire. Une facture
 * annulée l'est quoi qu'il arrive ensuite, et un retard passe devant
 * un solde partiel — c'est le retard qu'on vient chercher dans la
 * liste, pas le fait qu'il reste quelque chose à encaisser.
 */
export function statutDeFacture(e: EtatFacture): StatutFacture {
  if (e.annulee) return "annulee";
  const reste = arrondi(e.montant - e.paye);
  if (reste <= 0) return "payee";
  if (e.echeance < e.aujourdhui) return "retard";
  if (e.paye > 0) return "partiel";
  return e.envoyee ? "envoyee" : "emise";
}

export function statutDOffre(
  statut: string,
  valideJusquAu: string | null,
  venteTicketId: string | null,
  aujourdhui: string,
): StatutOffre {
  if (venteTicketId) return "converti";
  if (statut === "accepte") return "accepte";
  if (statut === "refuse") return "refuse";
  if (valideJusquAu && valideJusquAu < aujourdhui) return "expire";
  if (statut === "brouillon") return "brouillon";
  return "attente";
}

export function statutDeFactureAchat(total: number, paye: number): StatutFactureAchat {
  const reste = arrondi(total - paye);
  if (reste <= 0) return "payee";
  return paye > 0 ? "partiel" : "a_payer";
}

/** Le nombre de jours de retard, pour le message de relance. */
export function joursDeRetard(echeance: string, aujourdhui: string): number {
  const a = Date.parse(`${echeance}T00:00:00Z`);
  const b = Date.parse(`${aujourdhui}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Les montants sont en ariary : on ne discute pas sous l'unité. */
const arrondi = (n: number) => Math.round(n * 100) / 100;
