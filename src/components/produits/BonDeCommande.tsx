import React, { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Table } from "lucide-react";
import type { StoreSettings } from "../../types";
import { Modal } from "../shared/Modal";
import { telechargerCsv, telechargerTableur } from "../../lib/exportTableur";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import {
  cellulesDeLigne,
  COLONNES_BON_DE_COMMANDE,
  lignesDuBonDeCommande,
  totalDuBon,
  type ProduitARecommander,
} from "../../lib/bonDeCommande";
import type { ReglagesAlertesStock } from "../../lib/prealerteStock";
import { usePersonnalisation } from "../../lib/personnalisation";
import { lireReglagesDocuments } from "../../features/documents/lib/reglages";
import { documentDAchat } from "../../features/documents/lib/buildDocument";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import { dateDuJour } from "../../lib/dates";
import { nomDeFichier } from "../../lib/documentExport";

/**
 * LE BON DE COMMANDE FOURNISSEUR.
 *
 * Ce qu'on envoie au fournisseur pour réapprovisionner. Il était le
 * dernier document resté sur l'implémentation d'origine : il se
 * dessinait ici, à la main, hors du moteur commun.
 *
 * ── CE QUE LE PASSAGE AU MOTEUR COMMUN LUI APPORTE ─────────────────
 *
 * **Il tient sur un téléphone.** Il se mettait en page à la largeur de
 * l'écran : à trois cent vingt pixels, le tableau s'écrasait jusqu'à
 * écrire les en-têtes en vertical — « Q / T / É », « PRIX / UNITA /
 * IRE » — et le PDF, qui est une photographie de ce qu'on voit,
 * partait ainsi chez le fournisseur. La feuille fait désormais 210 mm
 * quelle que soit la fenêtre, et c'est une mise à l'échelle qui
 * l'adapte à l'écran.
 *
 * **Il se pagine.** Cinquante produits à racheter tenaient sur une
 * feuille unique, débitée ensuite en tranches de la hauteur d'une
 * page : la coupure tombait au milieu d'un montant. Le découpage
 * réserve maintenant sa place au total et répète l'en-tête du tableau.
 *
 * **Il suit les réglages de la boutique** — titre, préfixe, modèle,
 * couleur, mise en page — comme les huit autres types.
 *
 * ── CE QU'IL GARDE ─────────────────────────────────────────────────
 *
 * Le CSV et le tableur, que lui seul propose : celui-là, on le
 * retravaille avant de l'envoyer, et ces deux fichiers portent le
 * stock et le seuil que le papier tait.
 */

interface BonDeCommandeProps {
  ouvert: boolean;
  onFermer: () => void;
  /** Le catalogue entier : le tri se fait ici, pas chez l'appelant. */
  produits: ProduitARecommander[];
  reglages: ReglagesAlertesStock;
  settings?: StoreSettings;
}

export const BonDeCommande: React.FC<BonDeCommandeProps> = ({
  ouvert,
  onFermer,
  produits,
  reglages,
  settings,
}) => {
  const personnalisation = usePersonnalisation();
  const reglagesDocuments = useMemo(
    () => lireReglagesDocuments(personnalisation.documents),
    [personnalisation.documents],
  );

  const [exportEnCours, setExportEnCours] = useState<null | "csv" | "tableur">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const lignes = useMemo(() => lignesDuBonDeCommande(produits, reglages), [produits, reglages]);
  const total = useMemo(() => totalDuBon(lignes), [lignes]);

  /**
   * LE DESTINATAIRE, QUAND IL N'Y EN A QU'UN.
   *
   * Un bon de commande s'adresse à quelqu'un. Quand toutes les lignes
   * viennent du même fournisseur, son nom monte en tête du document —
   * c'est ainsi qu'on écrit une commande — et cesse de se répéter sous
   * chaque désignation.
   *
   * Il faut que TOUTES les lignes le portent : une seule fiche sans
   * fournisseur, et l'en-tête affirmerait quelque chose de faux sur
   * elle. Dans ce cas, le nom redescend ligne par ligne.
   */
  const fournisseurUnique = useMemo(() => {
    const noms = new Set(lignes.map((l) => l.fournisseur));
    const [seul] = [...noms];
    return noms.size === 1 && seul ? seul : null;
  }, [lignes]);

  const aujourdhui = dateDuJour();

  const document = useMemo(
    () =>
      documentDAchat({
        lignes: lignes.map((l) => ({
          id: l.id,
          designation: l.produit,
          reference: l.reference,
          quantite: l.quantiteSuggeree,
          unite: l.unite,
          prixUnitaire: l.prixAchat,
          total: l.totalEstime,
          fournisseur: l.fournisseur,
        })),
        total: total.montant,
        lignesSansPrix: total.lignesSansPrix,
        fournisseur: fournisseurUnique,
        date: aujourdhui,
        boutique: settings,
        reglages: reglagesDocuments,
      }),
    [lignes, total, fournisseurUnique, aujourdhui, settings, reglagesDocuments],
  );

  const nom = nomDeFichier("Bon_de_commande", settings?.storeName ?? "boutique", aujourdhui);

  const exporter = async (type: "csv" | "tableur") => {
    if (exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const cellules = lignes.map(cellulesDeLigne);
      if (type === "csv") telechargerCsv(nom, COLONNES_BON_DE_COMMANDE, cellules);
      else await telechargerTableur(nom, "À commander", COLONNES_BON_DE_COMMANDE, cellules);
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  const vide = lignes.length === 0;

  return (
    <Modal
      open={ouvert}
      onClose={onFermer}
      size="3xl"
      icon={<FileText className="h-4 w-4" />}
      title="Bon de commande"
      description={
        vide
          ? "Rien à réapprovisionner pour le moment"
          : `${lignes.length} produit${lignes.length > 1 ? "s" : ""}`
      }
      footer={
        !vide && (
          <>
            {/* Imprimer, PDF et image sont rendus par l'aperçu lui-même.
                Ne restent ici que les deux sorties propres à ce
                document : elles portent le stock et le seuil, que le
                papier tait. */}
            <button
              onClick={() => void exporter("csv")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <Table className="h-4 w-4" />
              {exportEnCours === "csv" ? "…" : "CSV"}
            </button>
            <button
              onClick={() => void exporter("tableur")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportEnCours === "tableur" ? "…" : "Excel"}
            </button>
          </>
        )
      }
    >
      {exportErreur && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {exportErreur}
        </p>
      )}

      {vide ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Tous vos produits sont au-dessus de leur seuil. Il n&apos;y a rien à commander.
        </p>
      ) : (
        /* Pas de choix de format : un bon de commande s'envoie ou
           s'imprime sur une feuille, il ne sort pas d'une imprimante de
           comptoir. C'est déjà le cas du devis. */
        <DocumentPreview document={document} reglages={reglagesDocuments} format="a4" />
      )}
    </Modal>
  );
};
