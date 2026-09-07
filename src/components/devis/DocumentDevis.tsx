import React, { useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Printer } from "lucide-react";
import type { StoreSettings } from "../../types";
import { APP_NAME } from "../../lib/appConfig";
import { formatCurrency, formatDateLocale } from "../../utils/formulas";
import { Modal } from "../shared/Modal";
import { useInvoicePrefs } from "../../lib/invoicePrefs";
import {
  exporterImage,
  exporterPdf,
  imprimerDocument,
  nomDeFichier,
} from "../../lib/documentExport";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import { getPaperFormat, PAPER_FORMATS, type PaperFormatId } from "../../lib/paperFormats";
import { classeStatut, texteStatut, type Devis, type LigneDevis } from "../../lib/devis";

interface DocumentDevisProps {
  devis: Devis | null;
  lignes: LigneDevis[];
  settings?: StoreSettings;
  onClose: () => void;
}

/**
 * Un devis sur papier.
 *
 * Il reprend la grammaire de la facture — identité à gauche, référence à
 * droite, tableau des lignes, total détaché en bas — pour que les deux
 * documents d'une même boutique se ressemblent.
 *
 * Deux différences tiennent au rôle du document. Il n'y a pas de format
 * ticket : un devis se remet ou s'envoie, il ne sort pas d'une
 * imprimante de comptoir. Et le bas de page ne porte pas « Net à payer »
 * mais la date de validité — un devis ne réclame rien, il engage celui
 * qui le signe jusqu'à une date.
 */
export const DocumentDevis: React.FC<DocumentDevisProps> = ({
  devis,
  lignes,
  settings,
  onClose,
}) => {
  const [invoicePrefs] = useInvoicePrefs();
  const [paperId, setPaperId] = useState<PaperFormatId>("a4");
  const paper = getPaperFormat(paperId);
  const documentRef = useRef<HTMLDivElement>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [exportErreur, setExportErreur] = useState<string | null>(null);

  // Un devis se remet en main propre ou s'envoie : les formats de
  // rouleau thermique n'ont pas de sens ici.
  const formatsFeuille = PAPER_FORMATS.filter((f) => f.layout === "invoice");

  const exporter = async (type: "pdf" | "image") => {
    const noeud = documentRef.current;
    if (!noeud || !devis || exportEnCours) return;
    setExportEnCours(type);
    setExportErreur(null);
    try {
      const nom = nomDeFichier("Devis", devis.numero ?? devis.id.slice(0, 6));
      if (type === "pdf") await exporterPdf(noeud, paper, nom);
      else await exporterImage(noeud, nom, "png");
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setExportErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  if (!devis) return null;

  const total = lignes.reduce((n, l) => n + (l.total ?? l.quantite * l.prix_unitaire), 0);

  return (
    <Modal
      open
      onClose={onClose}
      size="3xl"
      icon={<FileText className="h-4 w-4" />}
      title="Devis"
      description={`N° ${devis.numero ?? ""} · ${paper.label}`}
      headerAside={
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
      }
      footer={
        <>
          <button onClick={() => imprimerDocument(paper)} className="app-btn-secondary">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            onClick={() => exporter("image")}
            disabled={exportEnCours !== null}
            className="app-btn-secondary"
          >
            <ImageIcon className="h-4 w-4" />
            {exportEnCours === "image" ? "…" : "Image"}
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
                  {settings?.storeName || APP_NAME}
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
                Devis
              </p>
              <p className="font-mono text-xl font-bold tracking-tight text-slate-900">
                {devis.numero}
              </p>
              <dl className="space-y-0.5 pt-1 text-[11px] text-slate-500">
                <div className="flex gap-2 sm:justify-end">
                  <dt>Établi le</dt>
                  <dd className="font-medium text-slate-700">
                    {formatDateLocale(devis.date, "FR")}
                  </dd>
                </div>
                {devis.valide_jusqu_au && (
                  <div className="flex gap-2 sm:justify-end">
                    <dt>Valable jusqu&apos;au</dt>
                    <dd className="font-medium text-slate-700">
                      {formatDateLocale(devis.valide_jusqu_au, "FR")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </header>

          <section className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Proposé à
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {devis.client_nom || "—"}
              </p>
            </div>
            <div className="min-w-0 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Statut
              </p>
              <span className={`app-badge mt-1 ${classeStatut(devis)}`}>{texteStatut(devis)}</span>
            </div>
          </section>

          <table className="mt-6 w-full border-collapse text-left text-[11px]">
            <thead>
              {/* Un mot coupé en deux se lit mal : les en-têtes ne se
                  cassent pas, et le tableau défile plutôt que de se serrer. */}
              <tr className="border-b border-slate-300 text-[10px] font-semibold uppercase tracking-wider text-slate-500 [&>th]:whitespace-nowrap">
                <th className="py-2 pr-3 font-semibold">Désignation</th>
                <th className="px-2 py-2 text-center font-semibold">Qté</th>
                <th className="px-2 py-2 text-right font-semibold">Prix unitaire</th>
                <th className="py-2 pl-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr
                  key={l.id}
                  className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/70" : ""}`}
                >
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-slate-900">{l.designation}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-700">
                    {l.quantite}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatCurrency(l.prix_unitaire)}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono font-medium tabular-nums text-slate-900">
                    {formatCurrency(l.total ?? l.quantite * l.prix_unitaire)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Un devis ne réclame rien : le bas de page porte le montant
              proposé, pas un « net à payer ». */}
          <div className="mt-5 flex justify-end">
            <dl className="w-full max-w-[16rem] space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-4 border-t-2 border-slate-900 pt-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                  Montant proposé
                </dt>
                <dd className="font-mono text-base font-bold tabular-nums text-slate-900">
                  {formatCurrency(total)}
                </dd>
              </div>
            </dl>
          </div>

          {devis.note && (
            <section className="mt-6 rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Note
              </p>
              <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">
                {devis.note}
              </p>
            </section>
          )}

          <footer className="mt-8 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-600">Validité</p>
            <p>
              {devis.valide_jusqu_au
                ? `Cette proposition est valable jusqu'au ${formatDateLocale(devis.valide_jusqu_au, "FR")}. Passé cette date, les prix sont susceptibles d'être revus.`
                : "Cette proposition ne comporte pas de date limite. Les prix restent susceptibles d'être revus."}
            </p>
          </footer>
        </div>
      </div>
    </Modal>
  );
};
