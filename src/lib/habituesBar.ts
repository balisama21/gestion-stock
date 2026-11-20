import type { Sale } from "../types";

/**
 * LES HABITUÉS D'UN BAR
 *
 * Dans un bar malgache, un client se connaît par ce qu'il doit (son
 * ardoise), par la fréquence de ses venues et par ce qu'il boit. Ce
 * fichier lit tout cela dans les ventes ordinaires : une addition
 * encaissée au nom d'un client est une vente qui porte son `clientId`.
 */

export interface ClientLu {
  id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
}

export interface FicheHabitue {
  client: ClientLu;
  /** Le nombre de soirées où il a consommé (jours distincts). */
  visites: number;
  /** Le dernier jour où il a consommé, AAAA-MM-JJ, ou `null`. */
  derniereVenue: string | null;
  /** Tout ce qu'il a consommé, payé ou non. */
  depense: number;
  /** Ce qu'il doit encore. */
  ardoise: number;
  /** Les ventes qu'il doit encore, de la plus ancienne à la plus récente. */
  ventesDues: Sale[];
  /** Ses consommations préférées, en nombre servi. */
  favoris: { nom: string; quantite: number }[];
}

export const nomHabitue = (c: ClientLu): string =>
  [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom;

const plusAncienneDabord = (a: Sale, b: Sale) =>
  a.date.localeCompare(b.date) || (a.saisieLe ?? "").localeCompare(b.saisieLe ?? "");

export function fichesHabitues(clients: ClientLu[], ventes: Sale[]): FicheHabitue[] {
  const parClient = new Map<string, Sale[]>();
  for (const v of ventes) {
    if (!v.clientId || v.origine === "commande") continue;
    parClient.set(v.clientId, [...(parClient.get(v.clientId) ?? []), v]);
  }
  return clients.map((client) => {
    const siennes = parClient.get(client.id) ?? [];
    const jours = new Set(siennes.map((v) => v.date));
    const produits = new Map<string, { nom: string; quantite: number }>();
    for (const v of siennes) {
      if (!v.productId) continue;
      const p = produits.get(v.productId) ?? { nom: v.designation, quantite: 0 };
      p.quantite += v.quantite;
      produits.set(v.productId, p);
    }
    const ventesDues = siennes.filter((v) => v.soldeDu > 0).sort(plusAncienneDabord);
    return {
      client,
      visites: jours.size,
      derniereVenue: jours.size ? [...jours].sort().at(-1)! : null,
      depense: siennes.reduce((n, v) => n + v.totalVente, 0),
      ardoise: ventesDues.reduce((n, v) => n + v.soldeDu, 0),
      ventesDues,
      favoris: [...produits.values()].sort((a, b) => b.quantite - a.quantite).slice(0, 3),
    };
  });
}

/**
 * L'ordre de la liste : d'abord ceux qui doivent (le plus gros en tête),
 * puis les plus récemment venus, puis les autres par nom.
 */
export function trierHabitues(fiches: FicheHabitue[]): FicheHabitue[] {
  return [...fiches].sort(
    (a, b) =>
      b.ardoise - a.ardoise ||
      (b.derniereVenue ?? "").localeCompare(a.derniereVenue ?? "") ||
      nomHabitue(a.client).localeCompare(nomHabitue(b.client), "fr"),
  );
}

/**
 * Un règlement d'ardoise se répartit sur les ventes dues, la plus
 * ancienne d'abord : c'est la dette la plus vieille qu'on éteint.
 * Ce qui dépasse l'ardoise n'est pas réparti.
 */
export function repartirReglement(
  ventesDues: Sale[],
  montant: number,
): { saleId: string; montant: number }[] {
  const parts: { saleId: string; montant: number }[] = [];
  let reste = Math.round(montant * 100) / 100;
  for (const v of [...ventesDues].sort(plusAncienneDabord)) {
    if (reste <= 0) break;
    const part = Math.min(reste, v.soldeDu);
    if (part <= 0) continue;
    parts.push({ saleId: v.id, montant: part });
    reste = Math.round((reste - part) * 100) / 100;
  }
  return parts;
}

/** « aujourd'hui », « hier », « il y a 5 jours », « il y a 3 mois ». */
export function depuisLe(jour: string | null, aujourdhui: string): string {
  if (!jour) return "jamais venu";
  const ecart = Math.round(
    (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${jour}T00:00:00Z`)) / 86400000,
  );
  if (ecart <= 0) return "aujourd'hui";
  if (ecart === 1) return "hier";
  if (ecart < 31) return `il y a ${ecart} jours`;
  const mois = Math.round(ecart / 30);
  return mois < 12 ? `il y a ${mois} mois` : "il y a plus d'un an";
}
