import type { Product, Sale, StoreSettings } from "../../../types";
import type { Database } from "../../../lib/database.types";
import {
  documentDeCommande,
  documentDeDevis,
  documentDeFactureAchat,
  documentDeVente,
  type Document,
} from "./buildDocument";
import type { ReglagesDocuments } from "./reglages";
import { resoudreType } from "./resolveur";
import type { TypeDocumentV3 } from "./typesDocument";

/**
 * L'APERÇU DU DOCUMENT QU'ON EST EN TRAIN DE RÉGLER
 *
 * ── POURQUOI LA DERNIÈRE VENTE, ET PAS UN EXEMPLE ──────────────────
 *
 * L'écran des réglages n'a sous la main qu'une chose réelle : les
 * ventes de la boutique. Un devis inventé montrerait un client qui
 * n'existe pas et des montants ronds, c'est-à-dire précisément les
 * cas qui ne cassent jamais une mise en page. La dernière vente, elle,
 * porte les vrais noms de produits, la vraie longueur des
 * désignations, le vrai client saisi à la main.
 *
 * On la REPRÉSENTE donc sous la forme du document réglé : les mêmes
 * lignes, présentées comme un devis, une proforma, un bon de commande
 * ou une facture reçue. C'est un changement de forme, jamais de
 * chiffre, et `mention` le dit sous le document plutôt que de le
 * laisser croire.
 *
 * ── CE QUI N'A PAS D'APERÇU ────────────────────────────────────────
 *
 * Le bon de commande fournisseur garde sa propre mise en page,
 * héritée de la v1 : il ne passe pas par ce moteur. Montrer ici une
 * feuille construite autrement annoncerait un papier qui ne sortira
 * pas. On rend `null`, et l'écran le dit.
 */

type Devis = Database["public"]["Tables"]["quotes"]["Row"];
type LigneDevis = Database["public"]["Tables"]["quote_items"]["Row"];
type Commande = Database["public"]["Tables"]["orders"]["Row"];
type LigneCommande = Database["public"]["Tables"]["order_items"]["Row"];
type FactureAchat = Database["public"]["Tables"]["supplier_invoices"]["Row"];
type LigneFactureAchat = Database["public"]["Tables"]["supplier_invoice_items"]["Row"];

export interface SourceApercu {
  type: TypeDocumentV3;
  /** Les ventes de la boutique, la plus récente en tête. Jamais modifiées. */
  sales: Sale[];
  produits: Product[];
  boutique?: StoreSettings;
  reglages: ReglagesDocuments;
}

export interface Apercu {
  document: Document;
  /** Ce que l'aperçu montre vraiment, en une phrase. */
  mention: string;
}

/** Les lignes du dernier ticket, comme la page Ventes les regroupe. */
function dernierTicket(sales: Sale[]): Sale[] | null {
  const derniere = sales[0];
  if (!derniere) return null;
  return derniere.ticketId ? sales.filter((v) => v.ticketId === derniere.ticketId) : [derniere];
}

const somme = (ventes: Sale[], champ: (v: Sale) => number) =>
  ventes.reduce((n, v) => n + champ(v), 0);

const horodatage = (jour: string) => jour + "T00:00:00.000Z";

/** Le jour de la vente, décalé du nombre de jours demandé. */
function plusTard(jour: string, jours: number): string {
  const d = new Date(horodatage(jour));
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function enDevis(ventes: Sale[], type: "devis" | "proforma", jours: number): Devis {
  const premiere = ventes[0];
  return {
    client_id: premiere.clientId ?? null,
    client_nom: premiere.clientCredit ?? "",
    created_at: horodatage(premiere.date),
    created_by: null,
    date: premiere.date,
    duree_validite_jours: jours,
    id: "apercu",
    note: null,
    numero: premiere.numero,
    statut: "envoye",
    store_id: "apercu",
    total: somme(ventes, (v) => v.totalVente),
    type,
    updated_at: horodatage(premiere.date),
    valide_jusqu_au: plusTard(premiere.date, jours),
    vente_ticket_id: null,
  };
}

const lignesDeDevis = (ventes: Sale[]): LigneDevis[] =>
  ventes.map((v, i) => ({
    created_at: horodatage(v.date),
    designation: v.designation,
    id: "apercu-" + i,
    ordre: i,
    prix_unitaire: v.prixVenteUnit,
    product_id: v.productId,
    quantite: v.quantite,
    quote_id: "apercu",
    store_id: "apercu",
    total: v.totalVente,
  }));

function enCommande(ventes: Sale[]): Commande {
  const premiere = ventes[0];
  const total = somme(ventes, (v) => v.totalVente);
  const paye = somme(ventes, (v) => v.montantPaye);
  return {
    client_id: premiere.clientId ?? null,
    created_at: horodatage(premiere.date),
    date_livraison: null,
    id: "apercu",
    idempotency_key: null,
    montant_paye: paye,
    montant_rembourse: 0,
    montant_total: total,
    note: null,
    numero: premiere.numero,
    owner_id: null,
    reste_a_payer: Math.max(0, total - paye),
    statut_commande: "en_cours",
    statut_paiement: paye <= 0 ? "impaye" : paye >= total ? "paye" : "partiel",
    store_id: "apercu",
    updated_at: horodatage(premiere.date),
  };
}

const lignesDeCommande = (ventes: Sale[]): LigneCommande[] =>
  ventes.map((v, i) => ({
    created_at: horodatage(v.date),
    designation: v.designation,
    id: "apercu-" + i,
    marge_totale: v.margeTotale,
    order_id: "apercu",
    prix_achat_unit: v.prixAchatUnitRef,
    prix_vente_unit: v.prixVenteUnit,
    product_id: v.productId,
    quantite: v.quantite,
    total_achat_ref: v.totalAchatRef,
    total_vente: v.totalVente,
  }));

function enFactureAchat(ventes: Sale[], produits: Product[]): FactureAchat {
  const premiere = ventes[0];
  // Le fournisseur du produit vendu : le seul nom réel dont cet écran
  // dispose. Absent, le bloc reste vide plutôt qu'inventé.
  const fournisseur = produits.find((p) => p.id === premiere.productId)?.fournisseur ?? "";
  const total = somme(ventes, (v) => v.totalVente);
  return {
    created_at: horodatage(premiere.date),
    created_by: null,
    date: premiere.date,
    date_echeance: plusTard(premiere.date, 30),
    fournisseur,
    id: "apercu",
    montant_paye: somme(ventes, (v) => v.montantPaye),
    note: null,
    numero: premiere.numero,
    numero_fournisseur: null,
    piece_jointe: null,
    store_id: "apercu",
    supplier_id: null,
    total,
    updated_at: horodatage(premiere.date),
  };
}

const lignesDeFactureAchat = (ventes: Sale[], produits: Product[]): LigneFactureAchat[] =>
  ventes.map((v, i) => ({
    created_at: horodatage(v.date),
    designation: v.designation,
    id: "apercu-" + i,
    invoice_id: "apercu",
    prix_unitaire: v.prixVenteUnit,
    product_id: v.productId,
    quantite: v.quantite,
    store_id: "apercu",
    total: v.totalVente,
    unite: produits.find((p) => p.id === v.productId)?.unite ?? null,
  }));

const COMME_UNE_VENTE = "Votre dernière vente, mise en page avec les réglages ci-dessus.";

const PRESENTEE_COMME = (forme: string) =>
  "Votre dernière vente, présentée comme " +
  forme +
  ". Les chiffres sont les siens ; seule la forme change.";

export function apercuDesReglages(source: SourceApercu): Apercu | null {
  const { type, sales, produits, boutique, reglages } = source;

  // Le bon de commande fournisseur ne passe pas par ce moteur.
  if (type === "achat") return null;

  const ticket = dernierTicket(sales);
  if (!ticket) return null;

  const commun = { produits, boutique, reglages };

  if (type === "facture" || type === "recu") {
    return {
      document: documentDeVente({ ...commun, ventes: ticket, type }),
      mention: COMME_UNE_VENTE,
    };
  }

  if (type === "commission") {
    /*
     * Une facture ne devient « avec commission » que si la vente en
     * porte une. On cherche donc la dernière qui en porte vraiment,
     * plutôt que d'en attribuer une à un ticket qui n'en a pas : le
     * document montrerait alors une part que la boutique n'a jamais
     * encaissée.
     */
    const avec = sales.find((v) => (v.commission ?? 0) > 0);
    const lignes = avec
      ? avec.ticketId
        ? sales.filter((v) => v.ticketId === avec.ticketId)
        : [avec]
      : ticket;
    return {
      document: documentDeVente({ ...commun, ventes: lignes, type: "facture" }),
      mention: avec
        ? "Votre dernière vente portant une commission."
        : "Aucune vente ne porte encore de commission : l'aperçu montre une facture ordinaire. Le détail en deux lignes apparaîtra dès qu'une vente en portera une.",
    };
  }

  if (type === "devis" || type === "proforma") {
    const jours = resoudreType(reglages, type).validiteJours;
    return {
      document: documentDeDevis({
        ...commun,
        devis: enDevis(ticket, type, jours),
        lignes: lignesDeDevis(ticket),
      }),
      mention: PRESENTEE_COMME(type === "proforma" ? "une proforma" : "un devis"),
    };
  }

  if (type === "commande") {
    return {
      document: documentDeCommande({
        ...commun,
        commande: enCommande(ticket),
        lignes: lignesDeCommande(ticket),
      }),
      mention: PRESENTEE_COMME("un bon de commande"),
    };
  }

  return {
    document: documentDeFactureAchat({
      ...commun,
      facture: enFactureAchat(ticket, produits),
      lignes: lignesDeFactureAchat(ticket, produits),
    }),
    mention: PRESENTEE_COMME("une facture reçue"),
  };
}
