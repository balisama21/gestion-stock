import React, { useMemo, useState } from "react";
import type { LocaleSetting, Payment, Product, Sale, StoreSettings } from "../types";
import type { Database } from "../lib/database.types";
import type { ReglagesDocuments } from "../features/documents/lib/reglages";
import type { Facturation } from "../hooks/useFacturation";
import { FacturationView } from "./FacturationView";
import type { DocumentCommercial } from "./facturation/documents";
import { ActionsDocument, type DroitsFacturation } from "./facturation/ActionsDocument";
import { AvoirModal, type SaisieAvoir } from "./facturation/AvoirModal";
import { PaiementModal } from "./facturation/PaiementModal";
import { repartirLePaiement } from "./facturation/paiement";
import {
  FormulaireNouveauDocument,
  MenuNouveauDocument,
  type LigneNouvelle,
  type NatureNouveau,
  type SaisieNouveauDocument,
} from "./facturation/NouveauDocument";
import { BoutonsExport } from "./facturation/BoutonsExport";
import { ExportPdfGroupe } from "./facturation/ExportPdfGroupe";
import { exporterCsv, exporterTableur, nomDeLExport } from "./facturation/exportFacturation";
import type { SourcesDeLaPiece } from "./facturation/construireLaPiece";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Fournisseur = Database["public"]["Tables"]["suppliers"]["Row"];
type LigneFactureAchat = Database["public"]["Tables"]["supplier_invoice_items"]["Row"];

/**
 * L'ORCHESTRE DE LA PAGE FACTURATION.
 *
 * La vue affiche et filtre ; c'est ici que les gestes deviennent des
 * écritures. Ce partage tient à une raison simple : la vue se vérifie
 * sur des données posées à la main, sans base, et ce qui touche à la
 * base est rassemblé en un seul endroit où l'on peut le relire.
 *
 * ── AUCUNE ÉCRITURE PROPRE À CETTE PAGE ────────────────────────────
 *
 * Établir une facture appelle `create_sale_ticket`, la fonction de la
 * caisse. Encaisser appelle `add_payment`. Rembourser appelle
 * `refund_sale`. Remettre en stock appelle `ajuster_stock`. Chacun est
 * le chemin habituel de l'application, emprunté une seule fois : c'est
 * ce qui rend le double comptage impossible plutôt que surveillé.
 */

export interface FacturationPageProps {
  documents: DocumentCommercial[];
  payments: Payment[];
  clients: Client[];
  fournisseurs: Fournisseur[];
  produits: Product[];
  lignesFactureAchat: LigneFactureAchat[];
  vendeurs: string[];
  settings: StoreSettings;
  locale: LocaleSetting;
  reglagesDocuments: ReglagesDocuments;
  facturation: Facturation;
  moiNom: string;
  voitTout: boolean;
  droits: DroitsFacturation;
  /** Établir une vente : le seul chemin d'écriture d'une facture. */
  onAddSaleTicket: (data: {
    date: string;
    vendeur: string;
    client_credit?: string | null;
    client_id?: string | null;
    montant_paye_total: number;
    methode?: string | null;
    lignes: {
      product_id: string;
      quantite: number;
      prix_vente_unit: number;
      designation?: string;
    }[];
  }) => Promise<{ ventes: Sale[]; error: string | null }>;
  onFixerCommission: (saleId: string, montant: number) => Promise<{ error: string | null }>;
  onAddPaymentToSale: (
    saleId: string,
    data: { montant: number; methode: string; reference: string | null },
  ) => Promise<{ error: string | null }>;
  onRefundSale: (
    saleId: string,
    montant: number,
    reason?: string,
  ) => Promise<{ error: string | null }>;
  onAjusterStock: (
    productId: string,
    delta: number,
    note?: string | null,
  ) => Promise<{ error: string | null }>;
  /** Les écrans qui ont déjà leur formulaire : devis, proforma, facture reçue. */
  onAllerVers: (ecran: "devis" | "factures_achat") => void;
  /**
   * Marquer l'offre convertie, et la relier au ticket qui en est sorti.
   *
   * L'écran Devis fait déjà ce geste après un passage par la caisse.
   * Ici la vente naît sur place, donc le lien se pose dans la foulée.
   */
  onDevisConverti: (devisId: string, ticketId: string) => Promise<{ error: string | null }>;
}

export const FacturationPage: React.FC<FacturationPageProps> = ({
  documents,
  payments,
  clients,
  fournisseurs,
  produits,
  lignesFactureAchat,
  vendeurs,
  settings,
  locale,
  reglagesDocuments,
  facturation,
  moiNom,
  voitTout,
  droits,
  onAddSaleTicket,
  onFixerCommission,
  onAddPaymentToSale,
  onRefundSale,
  onAjusterStock,
  onAllerVers,
  onDevisConverti,
}) => {
  const [creation, setCreation] = useState<{
    nature: SaisieNouveauDocument["nature"];
    lignes?: LigneNouvelle[];
    client?: { id: string | null; nom: string };
    /** L'offre qu'on est en train de convertir, quand il y en a une. */
    devisId?: string;
  } | null>(null);
  const [paiement, setPaiement] = useState<DocumentCommercial | null>(null);
  const [avoir, setAvoir] = useState<DocumentCommercial | null>(null);
  const [zip, setZip] = useState<DocumentCommercial[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const devise = settings.currencySymbol ?? "Ar";

  const sources: SourcesDeLaPiece = useMemo(
    () => ({
      clients,
      fournisseurs,
      produits,
      paiements: payments,
      lignesFactureAchat,
      lignesAvoir: facturation.lignesAvoir,
      boutique: settings,
      reglages: reglagesDocuments,
      locale,
    }),
    [
      clients,
      fournisseurs,
      produits,
      payments,
      lignesFactureAchat,
      facturation.lignesAvoir,
      settings,
      reglagesDocuments,
      locale,
    ],
  );

  const choisirNature = (nature: NatureNouveau) => {
    if (nature === "devis" || nature === "proforma") return onAllerVers("devis");
    if (nature === "facture_achat") return onAllerVers("factures_achat");
    setErreur(null);
    setCreation({ nature });
  };

  /**
   * Établir une facture, c'est enregistrer une vente.
   *
   * Un seul appel, celui de la caisse. La commission, quand il y en a
   * une, se pose ENSUITE sur la première ligne du ticket : c'est une
   * part du total, pas un supplément, et `create_sale_ticket` n'avait
   * donc pas à la connaître.
   */
  const etablir = async (saisie: SaisieNouveauDocument) => {
    setEnCours(true);
    setErreur(null);
    const { ventes, error } = await onAddSaleTicket({
      date: saisie.date,
      vendeur: saisie.vendeur,
      client_credit: saisie.clientNom || null,
      client_id: saisie.clientId,
      montant_paye_total: saisie.montantPaye,
      methode: saisie.methode,
      lignes: saisie.lignes.map((l) => ({
        product_id: l.productId,
        quantite: l.quantite,
        prix_vente_unit: l.prixUnitaire,
        designation: l.designation,
      })),
    });

    if (error) {
      setErreur(error);
      setEnCours(false);
      return;
    }

    /* La vente est passée. Si la commission est refusée, le formulaire
       reste ouvert avec le message — mais la vente, elle, existe : on
       ne la rejoue pas. */
    let souci: string | null = null;
    if (saisie.commission > 0 && ventes[0]) {
      const { error: e } = await onFixerCommission(ventes[0].id, saisie.commission);
      if (e) souci = `La vente est enregistrée, mais la commission a été refusée : ${e}`;
    }

    /* L'offre devient « Convertie » et garde le ticket qui en est
       sorti. Le lien se pose APRÈS la vente : si la vente échoue, rien
       n'a bougé ; si le lien échoue, la vente reste et le devis se
       marque à la main depuis son écran. */
    const ticket = ventes[0]?.ticketId ?? ventes[0]?.id ?? null;
    if (creation?.devisId && ticket) {
      const { error: e } = await onDevisConverti(creation.devisId, ticket);
      if (e) souci = `La facture est établie, mais le devis n'a pas pu être marqué converti : ${e}`;
    }

    setEnCours(false);
    setErreur(souci);
    if (!souci) setCreation(null);
    void facturation.recharger();
  };

  /**
   * Encaisser une facture.
   *
   * La base tient le solde ligne par ligne : le règlement se répartit
   * donc sur les lignes du ticket, dans l'ordre, en soldant chacune
   * avant d'entamer la suivante — exactement comme l'acompte versé au
   * comptoir. Voir `facturation/paiement.ts`.
   */
  const encaisser = async (montant: number, methode: string, reference: string) => {
    if (!paiement) return;
    setEnCours(true);
    setErreur(null);
    for (const part of repartirLePaiement(paiement.ventes, montant)) {
      const { error } = await onAddPaymentToSale(part.saleId, {
        montant: part.montant,
        methode,
        reference: reference || null,
      });
      if (error) {
        setErreur(error);
        setEnCours(false);
        return;
      }
    }
    setEnCours(false);
    setPaiement(null);
  };

  /**
   * Établir un avoir.
   *
   * La pièce d'abord — c'est elle qui compte, et elle ne dépend de rien
   * d'autre. Le remboursement et la remise en stock ne suivent que si
   * on les a cochés, et un échec de l'un ne défait pas l'avoir : il est
   * signalé, et le geste se reprend à la main, là où il se fait
   * d'habitude.
   */
  const etablirLAvoir = async (saisie: SaisieAvoir) => {
    if (!avoir) return;
    setEnCours(true);
    setErreur(null);

    const lignes =
      saisie.montant >= avoir.montant
        ? avoir.ventes.map((v) => ({
            product_id: v.productId ?? "",
            designation: v.designation,
            quantite: v.quantite,
            prix_unitaire: v.prixVenteUnit,
          }))
        : [];

    const { error } = await facturation.creerAvoir({
      ticketId: avoir.entiteId,
      factureNumero: avoir.numero,
      clientId: avoir.clientId,
      clientNom: avoir.tiers,
      motif: saisie.motif,
      montant: saisie.montant,
      lignes,
    });

    if (error) {
      setErreur(error);
      setEnCours(false);
      return;
    }

    const soucis: string[] = [];

    if (saisie.rembourser) {
      let reste = Math.min(saisie.montant, avoir.paye);
      for (const v of avoir.ventes) {
        if (reste <= 0) break;
        const rendable = Math.max(0, v.montantPaye - v.montantRembourse);
        if (rendable <= 0) continue;
        const part = Math.min(reste, rendable);
        const { error: e } = await onRefundSale(v.id, part, saisie.motif || "Avoir");
        if (e) soucis.push(e);
        else reste -= part;
      }
    }

    if (saisie.remettreEnStock) {
      for (const v of avoir.ventes) {
        if (!v.productId || v.quantite <= 0) continue;
        const { error: e } = await onAjusterStock(
          v.productId,
          v.quantite,
          `Avoir sur ${avoir.numero}`,
        );
        if (e) soucis.push(e);
      }
    }

    setEnCours(false);
    if (soucis.length > 0) {
      setErreur(
        `L'avoir est établi. En revanche : ${soucis.join(" · ")}. Reprenez ces gestes depuis les écrans Ventes et Produits.`,
      );
      return;
    }
    setAvoir(null);
  };

  const dupliquer = (d: DocumentCommercial) => {
    const lignes: LigneNouvelle[] =
      d.entite === "vente"
        ? d.ventes.map((v) => ({
            productId: v.productId ?? "",
            designation: v.designation,
            quantite: v.quantite,
            prixUnitaire: v.prixVenteUnit,
          }))
        : d.lignesDevis.map((l) => ({
            productId: l.product_id ?? "",
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prix_unitaire,
          }));
    setErreur(null);
    setCreation({
      nature: "facture",
      lignes,
      client: { id: d.clientId, nom: d.tiers === "Client comptoir" ? "" : d.tiers },
    });
  };

  const naturesInterdites: NatureNouveau[] = droits.creer ? [] : ["facture", "recu", "commission"];

  return (
    <>
      <FacturationView
        documents={documents}
        payments={payments}
        settings={settings}
        locale={locale}
        facturation={facturation}
        moiNom={moiNom}
        voitTout={voitTout}
        peutCreer={droits.creer}
        onCreerPremiere={() => setCreation({ nature: "facture" })}
        menuNouveau={
          <MenuNouveauDocument onChoisir={choisirNature} interdites={naturesInterdites} />
        }
        exports={(visibles) => (
          <BoutonsExport
            combien={visibles.length}
            onCsv={() =>
              exporterCsv(visibles, devise, nomDeLExport("liste", facturation.aujourdhui))
            }
            onTableur={() =>
              void exporterTableur(
                visibles,
                devise,
                nomDeLExport("liste", facturation.aujourdhui),
              )
            }
            onPdf={() => setZip(visibles)}
          />
        )}
        actionsDuDocument={(d) => (
          <ActionsDocument
            document={d}
            sources={sources}
            reglages={reglagesDocuments}
            droits={droits}
            aujourdhui={facturation.aujourdhui}
            relances={facturation.relances.get(d.cle) ?? 0}
            onEmis={(type, snapshot) =>
              void facturation.marquerEmis(d.entite, d.entiteId, type, snapshot)
            }
            onEnvoye={(canal, relance) =>
              void facturation.marquerEnvoye(d.entite, d.entiteId, d.type, canal, relance)
            }
            onEncaisser={(doc) => {
              setErreur(null);
              setPaiement(doc);
            }}
            onConvertir={(doc) => {
              /* « En un clic, en reprenant TOUTES les lignes » : les
                 prestations comprises, que la caisse ne savait pas
                 reprendre faute de produit à décrémenter. Depuis que la
                 base accepte une ligne sans produit, elles passent. */
              setErreur(null);
              setCreation({
                nature: "facture",
                devisId: doc.entiteId,
                lignes: doc.lignesDevis.map((l) => ({
                  productId: l.product_id ?? "",
                  designation: l.designation,
                  quantite: l.quantite,
                  prixUnitaire: l.prix_unitaire,
                })),
                client: { id: doc.clientId, nom: doc.tiers },
              });
            }}
            onDupliquer={dupliquer}
            onAvoir={(doc) => {
              setErreur(null);
              setAvoir(doc);
            }}
          />
        )}
      />

      {creation && (
        <FormulaireNouveauDocument
          nature={creation.nature}
          produits={produits}
          clients={clients}
          vendeurs={vendeurs}
          moiNom={moiNom}
          aujourdhui={facturation.aujourdhui}
          devise={devise}
          enCours={enCours}
          erreur={erreur}
          lignesInitiales={creation.lignes}
          clientInitial={creation.client}
          onFermer={() => setCreation(null)}
          onValider={(saisie) => void etablir(saisie)}
        />
      )}

      {paiement && (
        <PaiementModal
          document={paiement}
          devise={devise}
          enCours={enCours}
          erreur={erreur}
          onFermer={() => setPaiement(null)}
          onValider={(montant, methode, reference) =>
            void encaisser(montant, methode, reference)
          }
        />
      )}

      {avoir && (
        <AvoirModal
          document={avoir}
          devise={devise}
          enCours={enCours}
          erreur={erreur}
          onFermer={() => setAvoir(null)}
          onValider={(saisie) => void etablirLAvoir(saisie)}
        />
      )}

      {zip && (
        <ExportPdfGroupe
          documents={zip}
          sources={sources}
          reglages={reglagesDocuments}
          nomDeFichier={nomDeLExport("documents", facturation.aujourdhui)}
          onFermer={() => setZip(null)}
        />
      )}
    </>
  );
};
