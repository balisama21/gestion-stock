import type { Payment, Sale } from "../types";
import { jourLocal } from "./caisseBar";

/**
 * LA CAISSE D'UNE JOURNÉE À L'OFFICINE
 *
 * Ce que le pharmacien compte en fermant : ce qui a été délivré, l'argent
 * réellement reçu et par quel moyen (le tiroir d'espèces doit tomber
 * juste), ce qui reste dû par les patients, et ce que les organismes de
 * tiers payant devront régler.
 *
 * Le vendu suit le jour des ventes ; l'argent reçu suit le jour du
 * paiement : un crédit réglé aujourd'hui entre dans la caisse
 * d'aujourd'hui, même s'il date d'une autre semaine.
 */

export interface TicketDuJour {
  cle: string;
  quand: string;
  client: string | null;
  articles: string[];
  total: number;
  du: number;
  /** Vendu au nom d'un organisme de tiers payant. */
  tiers: boolean;
}

export interface CaisseDuJour {
  vendu: number;
  marge: number;
  /** L'argent reçu ce jour-là, tous moyens confondus. */
  recu: number;
  /** Par moyen de paiement, du plus gros au plus petit. */
  parMoyen: { methode: string; montant: number; nombre: number }[];
  /** Les espèces reçues : ce que le tiroir doit contenir en plus du fond. */
  especes: number;
  /** Ce que les patients doivent encore sur les ventes du jour. */
  creditPatients: number;
  /** La part des organismes sur les ventes du jour. */
  creditTiers: number;
  /** Les règlements reçus aujourd'hui pour des ventes d'autres jours. */
  reglementsAnterieurs: number;
  tickets: TicketDuJour[];
}

export function caisseDuJour(
  jour: string,
  ventes: Sale[],
  paiements: Payment[],
  organismes: Set<string>,
): CaisseDuJour {
  const duJour = ventes.filter((v) => v.date === jour && v.origine !== "commande");
  const parId = new Map(ventes.map((v) => [v.id, v]));

  const moyens = new Map<string, { montant: number; nombre: number }>();
  let recu = 0;
  let reglementsAnterieurs = 0;
  for (const p of paiements) {
    if (!p.saleId || jourLocal(p.createdAt) !== jour) continue;
    recu += p.montant;
    const cle = p.methode || "especes";
    const m = moyens.get(cle) ?? { montant: 0, nombre: 0 };
    m.montant += p.montant;
    m.nombre += 1;
    moyens.set(cle, m);
    const vente = parId.get(p.saleId);
    if (vente && vente.date !== jour) reglementsAnterieurs += p.montant;
  }

  let creditPatients = 0;
  let creditTiers = 0;
  const groupes = new Map<string, Sale[]>();
  for (const v of duJour) {
    const du = Math.max(0, v.soldeDu);
    if (v.clientId && organismes.has(v.clientId)) creditTiers += du;
    else creditPatients += du;
    const cle = v.ticketId ?? v.id;
    groupes.set(cle, [...(groupes.get(cle) ?? []), v]);
  }

  const tickets = [...groupes.entries()]
    .map(([cle, vs]) => ({
      cle,
      quand: vs[0].saisieLe ?? "",
      client: vs.find((v) => v.clientCredit)?.clientCredit ?? null,
      articles: vs.map((v) =>
        v.quantite > 1 ? `${v.designation} × ${v.quantite}` : v.designation,
      ),
      total: vs.reduce((n, v) => n + v.totalVente, 0),
      du: vs.reduce((n, v) => n + Math.max(0, v.soldeDu), 0),
      tiers: vs.some((v) => v.clientId && organismes.has(v.clientId)),
    }))
    .sort((a, b) => b.quand.localeCompare(a.quand));

  return {
    vendu: duJour.reduce((n, v) => n + v.totalVente, 0),
    marge: duJour.reduce((n, v) => n + v.margeTotale, 0),
    recu,
    parMoyen: [...moyens.entries()]
      .map(([methode, m]) => ({ methode, ...m }))
      .sort((a, b) => b.montant - a.montant),
    especes: moyens.get("especes")?.montant ?? 0,
    creditPatients,
    creditTiers,
    reglementsAnterieurs,
    tickets,
  };
}

/** L'écart du tiroir : positif s'il y a trop, négatif s'il manque. */
export const ecartDuTiroir = (fond: number, especes: number, compte: number) =>
  compte - (fond + especes);
