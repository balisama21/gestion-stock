import type { LocaleSetting, Product, StoreSettings } from "../../types";
import type { Database } from "../../lib/database.types";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import type { Document } from "../../features/documents/lib/buildDocument";
import {
  documentDAvoir,
  documentDeDevis,
  documentDeFactureAchat,
  documentDeVente,
} from "../../features/documents/lib/buildDocument";
import type { DocumentCommercial, LigneAvoir } from "./documents";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];
/**
 * Le règlement, réduit à ce que le document en lit : sa méthode, et la
 * vente qu'il solde. Décrit par sa FORME plutôt que par le type de la
 * base, parce que l'application le traduit déjà en `Payment` — et que
 * ce partage-là n'est pas l'affaire de ce fichier.
 */
type Reglement = { saleId: string | null; methode: string; createdAt: string };
type LigneFactureAchat = Database["public"]["Tables"]["supplier_invoice_items"]["Row"];

/**
 * DE LA LIGNE DE LISTE AU PAPIER.
 *
 * Un seul endroit où l'on choisit quel constructeur appelle quoi. Les
 * constructeurs eux-mêmes ne sont pas touchés : ce sont ceux des
 * écrans Ventes, Devis et Achats, et c'est ce qui garantit qu'une
 * facture imprimée depuis Facturation est au caractère près celle
 * qu'imprime la caisse.
 */

export interface SourcesDeLaPiece {
  clients: Client[];
  fournisseurs: Fournisseur[];
  produits: Product[];
  paiements: Reglement[];
  lignesFactureAchat: LigneFactureAchat[];
  lignesAvoir: LigneAvoir[];
  boutique: StoreSettings;
  reglages: ReglagesDocuments;
  locale: LocaleSetting;
}

/**
 * Le type de sortie demandé.
 *
 * Une même vente donne une facture ou un reçu selon ce qu'on vient
 * chercher : la première réclame un paiement, le second en constate un.
 */
export type SortieVoulue = "facture" | "recu";

export function construireLaPiece(
  d: DocumentCommercial,
  s: SourcesDeLaPiece,
  sortie: SortieVoulue = "facture",
): Document | null {
  const commun = { boutique: s.boutique, reglages: s.reglages, locale: s.locale };

  if (d.entite === "vente") {
    if (d.ventes.length === 0) return null;
    const identifiants = new Set(d.ventes.map((v) => v.id));
    return documentDeVente({
      ...commun,
      type: sortie,
      ventes: d.ventes,
      produits: s.produits,
      client: s.clients.find((c) => c.id === d.clientId) ?? null,
      /* Du plus récent au plus ancien : le document affiche le mode du
         dernier règlement reçu. */
      paiements: s.paiements
        .filter((p) => p.saleId && identifiants.has(p.saleId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({ methode: p.methode }) as never),
    });
  }

  if (d.entite === "devis" && d.devis) {
    return documentDeDevis({
      ...commun,
      devis: d.devis,
      lignes: d.lignesDevis,
      client: s.clients.find((c) => c.id === d.clientId) ?? null,
    });
  }

  if (d.entite === "avoir" && d.avoir) {
    return documentDAvoir({
      ...commun,
      avoir: d.avoir,
      lignes: s.lignesAvoir.filter((l) => l.avoir_id === d.avoir!.id),
      client: s.clients.find((c) => c.id === d.clientId) ?? null,
    });
  }

  if (d.entite === "facture_achat" && d.factureAchat) {
    return documentDeFactureAchat({
      ...commun,
      facture: d.factureAchat,
      lignes: s.lignesFactureAchat.filter((l) => l.invoice_id === d.factureAchat!.id),
      fournisseur:
        s.fournisseurs.find((f) => f.id === d.factureAchat!.supplier_id) ?? null,
    });
  }

  return null;
}

/**
 * Le téléphone et l'adresse du destinataire, pour l'envoi.
 *
 * La fiche client d'abord, parce qu'elle est tenue à jour ; rien
 * ensuite, plutôt qu'un numéro deviné. Un lien WhatsApp vers un numéro
 * inventé est pire que pas de bouton du tout.
 */
export function coordonneesDuTiers(
  d: DocumentCommercial,
  s: Pick<SourcesDeLaPiece, "clients" | "fournisseurs">,
): { telephone: string | null; email: string | null } {
  if (d.entite === "facture_achat" && d.factureAchat?.supplier_id) {
    const f = s.fournisseurs.find((x) => x.id === d.factureAchat!.supplier_id);
    return { telephone: f?.telephone ?? null, email: f?.email ?? null };
  }
  const c = d.clientId ? s.clients.find((x) => x.id === d.clientId) : null;
  return { telephone: c?.telephone ?? null, email: c?.email ?? null };
}
