import type { CapitalApport, Expense, Payment, Purchase, Sale } from "../types";
import { jourLocal } from "./caisseBar";

/**
 * LE JOURNAL DE CAISSE DE L'OFFICINE
 *
 * Chaque entrée et chaque sortie d'argent, jour par jour : l'argent reçu
 * au comptoir (une ligne par client servi, un règlement de crédit à part),
 * les livraisons payées au grossiste, les dépenses, les apports.
 *
 * L'argent reçu suit le jour du paiement, pas celui de la vente : c'est
 * ce qui est entré dans le tiroir ce jour-là.
 */

export type GenreEcriture = "encaissement" | "reglement" | "reception" | "depense" | "apport";

export interface Ecriture {
  cle: string;
  jour: string;
  /** Horodatage complet quand on le connaît (les paiements). */
  quand: string | null;
  genre: GenreEcriture;
  titre: string;
  detail: string;
  /** Positif : de l'argent entré. Négatif : de l'argent sorti. */
  montant: number;
  /** Une livraison qui n'a pas été payée en entier. */
  aCredit?: boolean;
}

const MOYENS: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  virement: "Virement",
  cheque: "Chèque",
};

export function journalOfficine(args: {
  ventes: Sale[];
  paiements: Payment[];
  achats: Purchase[];
  depenses: Expense[];
  apports: CapitalApport[];
}): Ecriture[] {
  const ventes = new Map(args.ventes.map((v) => [v.id, v]));
  const lignes: Ecriture[] = [];

  // L'argent du comptoir : un client servi = une ligne.
  const groupes = new Map<string, { paiements: Payment[]; ventes: Sale[] }>();
  for (const p of args.paiements) {
    const vente = p.saleId ? ventes.get(p.saleId) : undefined;
    if (!vente || p.montant <= 0) continue;
    const jour = jourLocal(p.createdAt);
    const credit = vente.date !== jour;
    const cle = `${jour}|${credit ? "r" : "e"}|${vente.ticketId ?? vente.id}`;
    const g = groupes.get(cle) ?? { paiements: [], ventes: [] };
    g.paiements.push(p);
    if (!g.ventes.includes(vente)) g.ventes.push(vente);
    groupes.set(cle, g);
  }
  for (const [cle, g] of groupes) {
    const [jour, sorte] = cle.split("|");
    const client = g.ventes.find((v) => v.clientCredit)?.clientCredit ?? null;
    const moyens = [...new Set(g.paiements.map((p) => MOYENS[p.methode] ?? "Espèces"))];
    const articles = g.ventes.map((v) =>
      v.quantite > 1 ? `${v.designation} × ${v.quantite}` : v.designation,
    );
    const quand = g.paiements.map((p) => p.createdAt).sort()[0] ?? null;
    lignes.push({
      cle,
      jour,
      quand,
      genre: sorte === "r" ? "reglement" : "encaissement",
      titre:
        sorte === "r" ? `Règlement de crédit${client ? ` · ${client}` : ""}` : articles.join(", "),
      detail: [
        sorte === "r" ? articles.join(", ") : (client ?? "Comptoir"),
        moyens.join(" + "),
        g.ventes[0]?.vendeur,
      ]
        .filter(Boolean)
        .join(" · "),
      montant: g.paiements.reduce((n, p) => n + p.montant, 0),
    });
  }

  // Les livraisons : une par grossiste et par jour.
  const livraisons = new Map<string, Purchase[]>();
  for (const a of args.achats) {
    const cle = `${a.date}|${a.fournisseur?.trim() || "Grossiste non précisé"}`;
    livraisons.set(cle, [...(livraisons.get(cle) ?? []), a]);
  }
  for (const [cle, achats] of livraisons) {
    const [jour, grossiste] = cle.split("|");
    const total = achats.reduce((n, a) => n + a.totalAchat, 0);
    const paye = achats.reduce((n, a) => n + (a.montantPaye ?? a.totalAchat), 0);
    lignes.push({
      cle: `achat|${cle}`,
      jour,
      quand: null,
      genre: "reception",
      titre: `Réception · ${grossiste}`,
      detail: `${achats.length} ligne(s) · facture ${Math.round(total).toLocaleString("fr-FR")} Ar`,
      montant: -paye,
      aCredit: paye < total,
    });
  }

  for (const d of args.depenses) {
    lignes.push({
      cle: `dep|${d.id}`,
      jour: d.date,
      quand: null,
      genre: "depense",
      titre: d.note?.trim() || d.type,
      detail: [d.type, d.vendeur].filter(Boolean).join(" · "),
      montant: -d.montant,
    });
  }

  for (const a of args.apports) {
    lignes.push({
      cle: `app|${a.id}`,
      jour: a.date,
      quand: null,
      genre: "apport",
      titre: `Apport · ${a.source}`,
      detail: a.note ?? "",
      montant: a.montant,
    });
  }

  return lignes.sort(
    (a, b) => b.jour.localeCompare(a.jour) || (b.quand ?? "").localeCompare(a.quand ?? ""),
  );
}

export interface JourDuJournal {
  jour: string;
  ecritures: Ecriture[];
  entrees: number;
  sorties: number;
}

/** Les écritures rangées par jour, du plus récent au plus ancien. */
export function parJour(ecritures: Ecriture[]): JourDuJournal[] {
  const jours = new Map<string, JourDuJournal>();
  for (const e of ecritures) {
    const j = jours.get(e.jour) ?? { jour: e.jour, ecritures: [], entrees: 0, sorties: 0 };
    j.ecritures.push(e);
    if (e.montant >= 0) j.entrees += e.montant;
    else j.sorties -= e.montant;
    jours.set(e.jour, j);
  }
  return [...jours.values()];
}
