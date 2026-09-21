import React, { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, Table } from "lucide-react";
import type { StoreSettings } from "../../types";
import { APP_NAME } from "../../lib/appConfig";
import { formatCurrency, formatDateLocale } from "../../utils/formulas";
import { Modal } from "../shared/Modal";
import { useInvoicePrefs } from "../../lib/invoicePrefs";
import { exporterPdf, imprimerDocument, nomDeFichier } from "../../lib/documentExport";
import { telechargerCsv, telechargerTableur } from "../../lib/exportTableur";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import { getPaperFormat, PAPER_FORMATS, type PaperFormatId } from "../../lib/paperFormats";
import {
  cellulesDeLigne,
  COLONNES_BON_DE_COMMANDE,
  lignesDuBonDeCommande,
  totalDuBon,
  type ProduitARecommander,
} from "../../lib/bonDeCommande";
import type { ReglagesAlertesStock } from "../../lib/prealerteStock";

/**
 * LE BON DE COMMANDE.
 *
 * Ce qu'on envoie au fournisseur. Il reprend la grammaire de la facture
 * et du devis — identité à gauche, référence à droite, tableau, total
 * détaché en bas — pour que les documents d'une même boutique se
 * ressemblent.
 *
 * Trois différences tiennent à son rôle. Pas de format rouleau : un bon
 * de commande s'envoie ou s'imprime, il ne sort pas d'une imprimante de
 * comptoir. Le total est dit ESTIMÉ, parce qu'il repose sur le dernier
 * prix d'achat connu et non sur une offre du fournisseur. Et le
 * document se télécharge aussi en tableur, ce qu'aucune facture ne
 * fait : celui-là, on le retravaille avant de l'envoyer.
 *
 * ── Le PDF est une photographie ──
 *
 * `exporterPdf` capture ce bloc tel que le navigateur l'affiche. Ce
 * qu'on voit à l'écran est, au pixel près, ce qui part chez le
 * fournisseur — le raisonnement complet est en tête de
 * `lib/documentExport.ts`.
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
  const [invoicePrefs] = useInvoicePrefs();
  const [paperId, setPaperId] = useState<PaperFormatId>("a4");
  const paper = getPaperFormat(paperId);
  const documentRef = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "csv" | "tableur">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  const lignes = useMemo(() => lignesDuBonDeCommande(produits, reglages), [produits, reglages]);
  const total = useMemo(() => totalDuBon(lignes), [lignes]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nomBoutique = settings?.storeName || APP_NAME;
  const nom = nomDeFichier("Bon_de_commande", nomBoutique, aujourdhui);

  // Un bon de commande se remet ou s'envoie : le rouleau thermique n'a
  // pas de sens ici, exactement comme pour le devis.
  const formatsFeuille = PAPER_FORMATS.filter((f) => f.layout === "invoice");

  const exporter = async (type: "pdf" | "csv" | "tableur") => {
    if (exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      if (type === "pdf") {
        const noeud = documentRef.current;
        if (!noeud) return;
        await exporterPdf(noeud, paper, nom);
      } else {
        const cellules = lignes.map(cellulesDeLigne);
        if (type === "csv") telechargerCsv(nom, COLONNES_BON_DE_COMMANDE, cellules);
        else await telechargerTableur(nom, "À commander", COLONNES_BON_DE_COMMANDE, cellules);
      }
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  /** « 4 unités », et l'unité de la fiche quand elle en porte une. */
  const quantite = (n: number, unite: string | null) => (unite ? `${n} ${unite}` : String(n));

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
          : `${lignes.length} produit${lignes.length > 1 ? "s" : ""} · ${paper.label}`
      }
      headerAside={
        !vide && (
          <select
            value={paperId}
            onChange={(e) => setPaperId(e.target.value as PaperFormatId)}
            className="app-field w-auto"
            aria-label="Format de papier"
          >
            {formatsFeuille.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        )
      }
      footer={
        !vide && (
          <>
            <button onClick={() => imprimerDocument(paper)} className="app-btn-secondary">
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
            <button
              onClick={() => exporter("csv")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <Table className="h-4 w-4" />
              {exportEnCours === "csv" ? "…" : "CSV"}
            </button>
            <button
              onClick={() => exporter("tableur")}
              disabled={exportEnCours !== null}
              className="app-btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportEnCours === "tableur" ? "…" : "Excel"}
            </button>
            <button
              onClick={() => exporter("pdf")}
              disabled={exportEnCours !== null}
              className="app-btn-primary"
            >
              <Download className="h-4 w-4" />
              {exportEnCours === "pdf" ? "…" : "PDF"}
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
        <div className="overflow-x-auto">
          <div
            ref={documentRef}
            className={`printable-receipt mx-auto min-w-0 w-full rounded-lg border border-slate-200 bg-white font-sans text-xs text-slate-900 shadow-sm ${
              paperId === "a5" ? "p-6" : "p-8"
            }`}
            style={{ maxWidth: paper.previewWidth }}
          >
            <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
              <div className="min-w-0 space-y-2">
                {invoicePrefs.showLogo && settings?.logoUrl && (
                  <img src={settings.logoUrl} alt="" className="h-14 w-14 rounded object-contain" />
                )}
                <div className="space-y-0.5">
                  <p className="text-base font-bold uppercase tracking-tight text-slate-900">
                    {nomBoutique}
                  </p>
                  {settings?.subtitle && (
                    <p className="text-[11px] text-slate-500">{settings.subtitle}</p>
                  )}
                  {invoicePrefs.showAddress && settings?.address && (
                    <p className="text-[11px] text-slate-500">{settings.address}</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {[
                      invoicePrefs.showPhone && settings?.phone ? `Tél. ${settings.phone}` : null,
                      invoicePrefs.showEmail ? settings?.email : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {invoicePrefs.showNif && settings?.nifStat && (
                    <p className="text-[10px] text-slate-400">{settings.nifStat}</p>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-1 sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Bon de commande
                </p>
                <dl className="space-y-0.5 pt-1 text-[11px] text-slate-500">
                  <div className="flex gap-2 sm:justify-end">
                    <dt>Établi le</dt>
                    <dd className="font-medium text-slate-700">
                      {formatDateLocale(aujourdhui, "FR")}
                    </dd>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    <dt>Références</dt>
                    <dd className="font-medium text-slate-700">{lignes.length}</dd>
                  </div>
                </dl>
              </div>
            </header>

            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                {/* Un mot coupé en deux se lit mal : les en-têtes ne se
                    cassent pas, et le tableau défile plutôt que de se serrer. */}
                <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500 [&>th]:whitespace-nowrap">
                  <th className="py-2 pr-3 font-semibold">Produit</th>
                  <th className="px-2 py-2 text-center font-semibold">Stock</th>
                  <th className="px-2 py-2 text-center font-semibold">Seuil</th>
                  <th className="px-2 py-2 text-center font-semibold">À commander</th>
                  <th className="px-2 py-2 text-right font-semibold">Prix d&apos;achat</th>
                  <th className="py-2 pl-2 text-right font-semibold">Total estimé</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr
                    key={l.id}
                    className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                  >
                    <td className="py-2 pr-3 align-top">
                      <span className="font-medium text-slate-900">{l.produit}</span>
                      {/* La référence et le fournisseur sur une seule
                          ligne grise : deux colonnes de plus rendraient
                          le tableau illisible sur une A5, et ce sont des
                          informations secondaires. Ce qui manque ne
                          s'affiche pas. */}
                      {(l.reference || l.fournisseur) && (
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          {[l.reference, l.fournisseur].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center align-top tabular-nums text-slate-600">
                      {quantite(l.stock, l.unite)}
                    </td>
                    <td className="px-2 py-2 text-center align-top tabular-nums text-slate-500">
                      {l.seuil}
                    </td>
                    <td className="px-2 py-2 text-center align-top font-semibold tabular-nums text-slate-900">
                      {quantite(l.quantiteSuggeree, l.unite)}
                    </td>
                    <td className="px-2 py-2 text-right align-top tabular-nums text-slate-600">
                      {l.prixAchat === null ? "" : formatCurrency(l.prixAchat)}
                    </td>
                    <td className="py-2 pl-2 text-right align-top tabular-nums font-medium text-slate-900">
                      {l.totalEstime === null ? "" : formatCurrency(l.totalEstime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t-2 border-slate-900 pt-3">
              <p className="max-w-[60%] text-[10px] leading-relaxed text-slate-500">
                Total établi d&apos;après le dernier prix d&apos;achat connu. Il ne vaut pas offre :
                seul le fournisseur fixe son prix.
                {total.lignesSansPrix > 0 && (
                  <>
                    {" "}
                    {total.lignesSansPrix > 1
                      ? `${total.lignesSansPrix} lignes sans prix d'achat n'y sont pas comptées.`
                      : "1 ligne sans prix d'achat n'y est pas comptée."}
                  </>
                )}
              </p>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Total estimé
                </p>
                <p className="text-lg font-bold tabular-nums text-slate-900">
                  {total.montant === null ? "—" : formatCurrency(total.montant)}
                </p>
              </div>
            </section>

            {settings?.receiptFooter && (
              <p className="mt-6 whitespace-pre-line text-center text-[10px] text-slate-500">
                {settings.receiptFooter}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
