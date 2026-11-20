import type { Sale } from "../types";
import type { LigneNote } from "./bar";

/**
 * L'ÉQUIPE D'UN BAR
 *
 * Les serveurs prennent les commandes et servent ; une seule caisse
 * encaisse. Ce qu'un gérant veut savoir d'un serveur : combien il a
 * servi, à combien de tables, ce qu'il a offert et ce qu'il a retiré
 * des notes après coup — les deux points de contrôle d'un bar. D'un
 * caissier : combien il a encaissé, en combien d'additions.
 *
 * Tout se lit dans les lignes des notes (`serveur`) et dans les ventes
 * (`vendeur`, celui qui a encaissé).
 */

export const SANS_SERVEUR = "Sans serveur";

export interface BilanServeur {
  serveur: string;
  /** Le servi au prix de la carte, offerts exclus, retraits exclus. */
  servi: number;
  articles: number;
  /** Les additions (notes) où il a servi au moins un article. */
  tables: number;
  /** Ce qu'il a offert, au prix de la carte. */
  offerts: number;
  /** Ce qui a été retiré de ses lignes après service. */
  retraits: number;
  nbRetraits: number;
}

export function bilanServeurs(lignes: LigneNote[]): BilanServeur[] {
  const parNom = new Map<string, BilanServeur & { notes: Set<string> }>();
  for (const l of lignes) {
    if (l.genre !== "article") continue;
    const nom = l.serveur?.trim() || SANS_SERVEUR;
    const s = parNom.get(nom) ?? {
      serveur: nom,
      servi: 0,
      articles: 0,
      tables: 0,
      offerts: 0,
      retraits: 0,
      nbRetraits: 0,
      notes: new Set<string>(),
    };
    const montant = l.quantite * l.prix_unit;
    if (l.annulee) {
      s.retraits += montant;
      s.nbRetraits += 1;
    } else {
      s.articles += l.quantite;
      s.notes.add(l.note_id);
      if (l.offert) s.offerts += montant;
      else s.servi += montant;
    }
    parNom.set(nom, s);
  }
  return [...parNom.values()]
    .map(({ notes, ...s }) => ({ ...s, tables: notes.size }))
    .sort(
      (a, b) =>
        Number(a.serveur === SANS_SERVEUR) - Number(b.serveur === SANS_SERVEUR) ||
        b.servi - a.servi,
    );
}

export interface BilanCaissier {
  caissier: string;
  encaisse: number;
  additions: number;
}

/** Qui a passé les additions en caisse, d'après les ventes de la période. */
export function bilanCaissiers(ventes: Sale[]): BilanCaissier[] {
  const parNom = new Map<string, { encaisse: number; tickets: Set<string> }>();
  for (const v of ventes) {
    if (v.origine === "commande") continue;
    const nom = v.vendeur?.trim() || "—";
    const c = parNom.get(nom) ?? { encaisse: 0, tickets: new Set<string>() };
    c.encaisse += v.totalVente;
    c.tickets.add(v.ticketId ?? v.id);
    parNom.set(nom, c);
  }
  return [...parNom.entries()]
    .map(([caissier, c]) => ({ caissier, encaisse: c.encaisse, additions: c.tickets.size }))
    .sort((a, b) => b.encaisse - a.encaisse);
}
