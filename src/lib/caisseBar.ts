import type { Payment, Sale } from "../types";
import type { LigneNote } from "./bar";

/**
 * LA CAISSE D'UNE SOIRÉE
 *
 * Ce qu'un gérant compte en fermant : ce qui a été vendu, l'argent
 * réellement reçu et par quel moyen (le tiroir d'espèces doit tomber
 * juste), ce qui part à crédit, ce que la maison a offert, ce qui a été
 * annulé, et qui a servi quoi.
 *
 * Le vendu suit le jour commercial des ventes ; l'argent reçu suit le
 * jour du paiement — un crédit réglé ce soir entre dans la caisse de ce
 * soir, même s'il date d'une autre semaine.
 */

export interface RecapCaisse {
  vendu: number;
  /** L'argent reçu ce jour-là, tous moyens confondus. */
  recu: number;
  /** Par moyen de paiement, du plus gros au plus petit. */
  parMoyen: { methode: string; montant: number; nombre: number }[];
  /** Ce qui reste dû sur les ventes du jour. */
  aCredit: number;
  /** Les offerts du jour, au prix de la carte. */
  offerts: number;
  /** Les lignes annulées du jour, au prix de la carte. */
  annule: number;
  /** Ce que chaque serveur a servi (encaissé), du plus au moins. */
  parServeur: { serveur: string; montant: number; articles: number }[];
  /** Le nombre d'additions encaissées. */
  additions: number;
}

/** La date locale (AAAA-MM-JJ) d'un horodatage. */
export const jourLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

export function recapCaisse(
  jour: string,
  ventes: Sale[],
  paiements: Payment[],
  lignes: LigneNote[],
): RecapCaisse {
  const duJour = ventes.filter((v) => v.date === jour && v.origine !== "commande");
  const vendu = duJour.reduce((n, v) => n + v.totalVente, 0);
  const aCredit = duJour.reduce((n, v) => n + Math.max(0, v.soldeDu), 0);

  const moyens = new Map<string, { montant: number; nombre: number }>();
  let recu = 0;
  for (const p of paiements) {
    if (!p.saleId || jourLocal(p.createdAt) !== jour) continue;
    recu += p.montant;
    const m = moyens.get(p.methode || "especes") ?? { montant: 0, nombre: 0 };
    m.montant += p.montant;
    m.nombre += 1;
    moyens.set(p.methode || "especes", m);
  }
  const parMoyen = [...moyens.entries()]
    .map(([methode, m]) => ({ methode, ...m }))
    .sort((a, b) => b.montant - a.montant);

  const idsDuJour = new Set(duJour.map((v) => v.id));
  let offerts = 0;
  let annule = 0;
  const serveurs = new Map<string, { montant: number; articles: number }>();
  for (const l of lignes) {
    if (l.annulee) {
      if (jourLocal(l.cree_le) === jour) annule += l.quantite * l.prix_unit;
      continue;
    }
    if (!l.sale_id || !idsDuJour.has(l.sale_id)) continue;
    if (l.offert) offerts += l.quantite * l.prix_unit;
    if (l.genre !== "article") continue;
    const nom = l.serveur?.trim() || "Sans serveur";
    const s = serveurs.get(nom) ?? { montant: 0, articles: 0 };
    s.montant += l.offert ? 0 : l.quantite * l.prix_unit;
    s.articles += l.quantite;
    serveurs.set(nom, s);
  }
  const parServeur = [...serveurs.entries()]
    .map(([serveur, s]) => ({ serveur, ...s }))
    .sort((a, b) => b.montant - a.montant);

  const additions = new Set(duJour.map((v) => v.ticketId ?? v.id)).size;

  return { vendu, recu, parMoyen, aCredit, offerts, annule, parServeur, additions };
}

/** Le jour d'avant, en AAAA-MM-JJ. */
export const veille = (jour: string): string => {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j - 1));
  return d.toISOString().slice(0, 10);
};
