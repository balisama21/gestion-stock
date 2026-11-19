/**
 * LA CONSIGNE DU BAR
 *
 * Deux comptes par emballage (bouteille, casier) :
 *   - ce qu'on doit RENDRE au fournisseur : livré plein, pas encore
 *     rendu vide ni réglé en argent ;
 *   - ce qui est CHEZ LES CLIENTS : emporté avec une consigne laissée,
 *     pas encore rapporté. L'argent de ces consignes est gardé pour eux.
 */

export interface Emballage {
  id: string;
  store_id: string;
  nom: string;
  consigne: number;
  actif: boolean;
  ordre: number;
}

export type GenreMouvement =
  "recu" | "rendu" | "perdu_paye" | "client_emporte" | "client_rapporte" | "correction";

export interface MouvementEmballage {
  id: string;
  store_id: string;
  emballage_id: string;
  genre: GenreMouvement;
  quantite: number;
  montant: number;
  note: string | null;
  cree_le: string;
}

export const LIBELLE_MOUVEMENT: Record<GenreMouvement, string> = {
  recu: "Reçu plein du fournisseur",
  rendu: "Rendu vide au fournisseur",
  perdu_paye: "Cassé ou perdu, payé au fournisseur",
  client_emporte: "Emporté par un client",
  client_rapporte: "Rapporté par un client",
  correction: "Recomptage",
};

export interface SoldeEmballage {
  emballage: Emballage;
  /** Ce qu'on doit encore rendre (ou payer) au fournisseur. */
  aRendre: number;
  /** Ce qui est chez les clients, consigne laissée. */
  chezClients: number;
  /** L'argent des consignes clients gardé en caisse. */
  consignesGardees: number;
}

export function soldes(
  emballages: Emballage[],
  mouvements: MouvementEmballage[],
): SoldeEmballage[] {
  return emballages.map((e) => {
    let aRendre = 0;
    let chezClients = 0;
    let consignesGardees = 0;
    for (const m of mouvements) {
      if (m.emballage_id !== e.id) continue;
      switch (m.genre) {
        case "recu":
          aRendre += m.quantite;
          break;
        case "rendu":
        case "perdu_paye":
          aRendre -= m.quantite;
          break;
        case "correction":
          aRendre += m.quantite;
          break;
        case "client_emporte":
          chezClients += m.quantite;
          consignesGardees += m.montant;
          break;
        case "client_rapporte":
          chezClients -= m.quantite;
          consignesGardees -= m.montant;
          break;
      }
    }
    return { emballage: e, aRendre, chezClients, consignesGardees };
  });
}

/** L'argent qui accompagne un mouvement, proposé d'office. */
export const montantPropose = (
  genre: GenreMouvement,
  quantite: number,
  consigne: number,
): number =>
  genre === "client_emporte" || genre === "client_rapporte" || genre === "perdu_paye"
    ? quantite * consigne
    : 0;
