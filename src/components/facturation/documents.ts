import type { Sale, Payment } from "../../types";
import type { Devis, LigneDevis } from "../../lib/devis";
import type { Database } from "../../lib/database.types";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import { resoudreType } from "../../features/documents/lib/resolveur";
import { numeroDuDocument } from "../../features/documents/lib/typesDocument";
import type { TypeDocumentV3 } from "../../features/documents/lib/typesDocument";
import {
  echeanceExigible,
  statutDeFacture,
  statutDeFactureAchat,
  statutDOffre,
  type StatutDocument,
} from "./statuts";

export type FactureAchat = Database["public"]["Tables"]["supplier_invoices"]["Row"];
export type Avoir = Database["public"]["Tables"]["avoirs"]["Row"];
export type LigneAvoir = Database["public"]["Tables"]["avoir_items"]["Row"];

/**
 * UNE PIÈCE, UNE LIGNE.
 *
 * La page Facturation ne possède aucune table à elle : elle relit ce
 * que Ventes, Devis, Achats et Avoirs ont déjà écrit, et le range en
 * pièces. C'est ce qui garantit que ses chiffres sont ceux du tableau
 * de bord — ce sont les mêmes lignes, lues au même endroit.
 *
 * ── UN REÇU N'EST PAS UNE SECONDE LIGNE ────────────────────────────
 *
 * C'est le même ticket imprimé autrement. Un ticket de vente n'apparaît
 * donc qu'une fois, et son type dit sous quelle forme il est sorti :
 * « commission » s'il en porte une, « reçu » si c'est la seule pièce
 * qu'on en a tirée, « facture » sinon. L'onglet « Tous » liste chaque
 * opération exactement une fois, et rien ne peut s'y compter deux fois.
 */

export type TypeDocument =
  | "facture"
  | "commission"
  | "recu"
  | "devis"
  | "proforma"
  | "avoir"
  | "facture_achat";

export type EntiteDocument = "vente" | "devis" | "avoir" | "facture_achat";

export interface DocumentCommercial {
  /** Identifiant de liste, stable d'un chargement à l'autre. */
  cle: string;
  entite: EntiteDocument;
  /** Le ticket pour une vente, l'identifiant de la ligne ailleurs. */
  entiteId: string;
  type: TypeDocument;
  /** Le numéro tel qu'il s'imprime, préfixe compris. */
  numero: string;
  /** Celui de la base, pour la recherche et les jointures. */
  numeroBrut: string;
  date: string;
  echeance: string | null;
  tiers: string;
  clientId: string | null;
  vendeur: string;
  /** Qui a établi la pièce. Sert à la portée « mes documents ». */
  auteurId: string | null;
  montant: number;
  paye: number;
  reste: number;
  statut: StatutDocument;
  /** Le numéro de l'avoir qui l'annule, quand il y en a un. */
  avoirDe: string | null;
  /** Les lignes du ticket, pour bâtir le document et l'encaissement. */
  ventes: Sale[];
  devis: Devis | null;
  lignesDevis: LigneDevis[];
  factureAchat: FactureAchat | null;
  avoir: Avoir | null;
  /** La référence saisie par le client, quand la pièce en porte une. */
  reference: string | null;
}

export interface SourceFacturation {
  sales: Sale[];
  payments: Payment[];
  quotes: Devis[];
  quoteItems: LigneDevis[];
  facturesAchat: FactureAchat[];
  avoirs: Avoir[];
  /** Les pièces déclarées envoyées, par clé de document. */
  envois: Set<string>;
  /**
   * Les tickets dont la SEULE pièce émise est un reçu.
   *
   * Un ticket qu'on a imprimé en facture, ou qu'on n'a jamais imprimé,
   * n'y est pas : son type reste « facture », qui est le défaut de
   * `documentDeVente`.
   */
  recus: Set<string>;
  reglages: ReglagesDocuments;
  /** La date du jour, prise sur le serveur. */
  aujourdhui: string;
}

/** La clé d'une pièce, la même partout : liste, envois, émissions. */
export const cleDocument = (entite: EntiteDocument, id: string) => `${entite}:${id}`;

/**
 * Les ventes d'un même passage en caisse.
 *
 * Une vente sans `ticketId` a été enregistrée seule : elle est son
 * propre ticket, et sa clé est son identifiant.
 */
export function grouperParTicket(sales: Sale[]): Map<string, Sale[]> {
  const par = new Map<string, Sale[]>();
  for (const v of sales) {
    const cle = v.ticketId ?? v.id;
    const deja = par.get(cle);
    if (deja) deja.push(v);
    else par.set(cle, [v]);
  }
  return par;
}

function sommeTicket(ventes: Sale[]) {
  return ventes.reduce(
    (acc, v) => ({
      montant: acc.montant + v.totalVente,
      paye: acc.paye + v.montantPaye,
      commission: acc.commission + (v.commission ?? 0),
    }),
    { montant: 0, paye: 0, commission: 0 },
  );
}

/**
 * Le type d'un ticket de vente.
 *
 * Une facture avec commission est une facture tant que le ticket n'en
 * porte pas — c'est déjà la règle de `documentDeVente`, reprise ici
 * pour que la liste et le papier ne divergent pas.
 */
function typeDeVente(commission: number, recuSeul: boolean): TypeDocument {
  if (commission > 0) return "commission";
  return recuSeul ? "recu" : "facture";
}

function nomDuClient(ventes: Sale[]): string {
  const avecNom = ventes.find((v) => (v.clientCredit ?? "").trim());
  return avecNom?.clientCredit?.trim() || "Client comptoir";
}

export function construireDocuments(source: SourceFacturation): DocumentCommercial[] {
  const {
    sales,
    quotes,
    quoteItems,
    facturesAchat,
    avoirs,
    envois,
    recus,
    reglages,
    aujourdhui,
  } = source;

  const documents: DocumentCommercial[] = [];

  /*
   * Les avoirs, rassemblés par le ticket qu'ils couvrent.
   *
   * Une facture n'est ANNULÉE que lorsque les avoirs couvrent tout son
   * montant. Un avoir partiel — celui qui corrige une ligne — laisse la
   * facture vivante et se contente d'en afficher le lien : la déclarer
   * annulée ferait disparaître une créance encore due.
   */
  const avoirsParTicket = new Map<string, Avoir[]>();
  for (const a of avoirs) {
    if (!a.ticket_id) continue;
    const deja = avoirsParTicket.get(a.ticket_id);
    if (deja) deja.push(a);
    else avoirsParTicket.set(a.ticket_id, [a]);
  }

  /* Les ventes, groupées par ticket. */
  for (const [ticket, ventes] of grouperParTicket(sales)) {
    const premiere = ventes[0];
    const { montant, paye, commission } = sommeTicket(ventes);
    const cle = cleDocument("vente", ticket);
    const type = typeDeVente(commission, recus.has(ticket));
    const regle = resoudreType(reglages, type as TypeDocumentV3);
    const echeance = echeanceExigible(premiere.date, regle.echeance);
    const couvrants = avoirsParTicket.get(ticket) ?? [];
    const montantAvoire = couvrants.reduce((n, a) => n + a.montant, 0);

    documents.push({
      cle,
      entite: "vente",
      entiteId: ticket,
      type,
      numero: numeroDuDocument(premiere.numero, regle.prefixe, premiere.date),
      numeroBrut: premiere.numero ?? "",
      date: premiere.date,
      echeance,
      tiers: nomDuClient(ventes),
      clientId: premiere.clientId ?? null,
      vendeur: premiere.vendeur ?? "",
      auteurId: null,
      montant,
      paye,
      reste: Math.max(0, arrondi(montant - paye)),
      statut: statutDeFacture({
        montant,
        paye,
        annulee: montant > 0 && montantAvoire >= montant,
        envoyee: envois.has(cle),
        echeance,
        aujourdhui,
      }),
      avoirDe: couvrants.map((a) => a.numero).filter(Boolean).join(", ") || null,
      ventes,
      devis: null,
      lignesDevis: [],
      factureAchat: null,
      avoir: null,
      reference: null,
    });
  }

  /* Devis et proformas. */
  const lignesParDevis = new Map<string, LigneDevis[]>();
  for (const l of quoteItems) {
    const deja = lignesParDevis.get(l.quote_id);
    if (deja) deja.push(l);
    else lignesParDevis.set(l.quote_id, [l]);
  }

  for (const d of quotes) {
    const type: TypeDocument = d.type === "proforma" ? "proforma" : "devis";
    const regle = resoudreType(reglages, type as TypeDocumentV3);
    documents.push({
      cle: cleDocument("devis", d.id),
      entite: "devis",
      entiteId: d.id,
      type,
      numero: numeroDuDocument(d.numero, regle.prefixe, d.date),
      numeroBrut: d.numero ?? "",
      date: d.date,
      echeance: d.valide_jusqu_au,
      tiers: d.client_nom || "Client",
      clientId: d.client_id,
      vendeur: "",
      auteurId: d.created_by,
      montant: d.total,
      paye: 0,
      reste: 0,
      statut: statutDOffre(d.statut, d.valide_jusqu_au, d.vente_ticket_id, aujourdhui),
      avoirDe: null,
      ventes: [],
      devis: d,
      lignesDevis: lignesParDevis.get(d.id) ?? [],
      factureAchat: null,
      avoir: null,
      reference: null,
    });
  }

  /* Les avoirs, qui sont des pièces à part entière. */
  for (const a of avoirs) {
    const regle = resoudreType(reglages, "avoir");
    documents.push({
      cle: cleDocument("avoir", a.id),
      entite: "avoir",
      entiteId: a.id,
      type: "avoir",
      numero: numeroDuDocument(a.numero, regle.prefixe, a.date),
      numeroBrut: a.numero ?? "",
      date: a.date,
      echeance: null,
      tiers: a.client_nom || "Client",
      clientId: a.client_id,
      vendeur: "",
      auteurId: a.created_by,
      montant: a.montant,
      paye: 0,
      reste: 0,
      statut: "emise",
      avoirDe: a.facture_numero,
      ventes: [],
      devis: null,
      lignesDevis: [],
      factureAchat: null,
      avoir: a,
      reference: null,
    });
  }

  /* Les factures reçues des fournisseurs : un classeur, pas un flux. */
  for (const f of facturesAchat) {
    const regle = resoudreType(reglages, "facture_achat");
    documents.push({
      cle: cleDocument("facture_achat", f.id),
      entite: "facture_achat",
      entiteId: f.id,
      type: "facture_achat",
      numero: numeroDuDocument(f.numero, regle.prefixe, f.date),
      numeroBrut: f.numero ?? "",
      date: f.date,
      echeance: f.date_echeance,
      tiers: f.fournisseur || "Fournisseur",
      clientId: null,
      vendeur: "",
      auteurId: f.created_by,
      montant: f.total,
      paye: f.montant_paye,
      reste: Math.max(0, arrondi(f.total - f.montant_paye)),
      statut: statutDeFactureAchat(f.total, f.montant_paye),
      avoirDe: null,
      ventes: [],
      devis: null,
      lignesDevis: [],
      factureAchat: f,
      avoir: null,
      reference: f.numero_fournisseur,
    });
  }

  return documents.sort((a, b) => (a.date === b.date ? b.cle.localeCompare(a.cle) : b.date.localeCompare(a.date)));
}

const arrondi = (n: number) => Math.round(n * 100) / 100;
