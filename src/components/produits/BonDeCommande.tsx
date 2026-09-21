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
 * comptoir. Il porte une place pour le cachet et la signature, parce
 * qu'il engage celui qui commande. Et il se télécharge aussi en
 * tableur, ce qu'aucune facture ne fait : celui-là, on le retravaille
 * avant de l'envoyer.
 *
 * ── CE QU'IL NE DIT PAS, ET C'EST VOULU ──
 *
 * Ni le stock restant, ni le seuil d'alerte. Ce sont des affaires
 * internes : un fournisseur n'a pas à savoir combien il vous reste, et
 * les lui montrer affaiblit la position de qui commande. Ces deux
 * colonnes restent dans le fichier tableur, qui ne sort pas de la
 * maison. Le message de remerciement des reçus est écarté pour la même
 * raison : « sans reprise après la vente » ne veut rien dire adressé à
 * un fournisseur.
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

  /**
   * LE DESTINATAIRE, QUAND IL N'Y EN A QU'UN.
   *
   * Un bon de commande s'adresse à quelqu'un. Quand toutes les lignes
   * viennent du même fournisseur, son nom monte en tête du document —
   * c'est ainsi qu'on écrit une commande — et la colonne disparaît du
   * tableau, où elle répétait la même valeur à chaque ligne.
   *
   * Il faut que TOUTES les lignes le portent : une seule fiche sans
   * fournisseur, et l'en-tête affirmerait quelque chose de faux sur
   * elle. Dans ce cas, le nom redescend sous chaque désignation.
   */
  const fournisseurUnique = useMemo(() => {
    const noms = new Set(lignes.map((l) => l.fournisseur));
    const [seul] = [...noms];
    return noms.size === 1 && seul ? seul : null;
  }, [lignes]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nomBoutique = settings?.storeName || APP_NAME;
  const nom = nomDeFichier("Bon_de_commande", nomBoutique, aujourdhui);

  // Téléphone et courriel sur une ligne, séparés par un point médian.
  // Ce qui manque ne laisse pas de séparateur orphelin.
  const coordonnees = [
    invoicePrefs.showPhone && settings?.phone ? `Tél. ${settings.phone}` : null,
    invoicePrefs.showEmail ? settings?.email : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        /*
         * LE DOCUMENT EST CAPTURÉ À LA LARGEUR DU PAPIER, PAS À CELLE
         * DE L'ÉCRAN.
         *
         * `exporterPdf` photographie le nœud tel qu'il est mis en page
         * à cet instant. Sur un téléphone, l'aperçu fait trois cent
         * vingt pixels de large : le tableau s'y écrasait, et le PDF
         * sortait avec « PRO / DUI / T » en en-tête et « setr / eel /
         * a » en désignation — une colonne par syllabe. Constaté sur
         * un vrai fichier.
         *
         * On impose donc la largeur de la feuille le temps de la
         * photo, puis on la rend. Le PDF est identique quel que soit
         * l'appareil qui l'a produit, ce qui est bien le moins pour un
         * document qui part chez un fournisseur.
         */
        const largeurAvant = noeud.style.width;
        noeud.style.width = `${paper.previewWidth}px`;
        try {
          await exporterPdf(noeud, paper, nom);
        } finally {
          noeud.style.width = largeurAvant;
        }
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
            className={`printable-receipt mx-auto w-full bg-white font-sans text-slate-900 ${
              paperId === "a5" ? "p-8" : "p-10"
            }`}
            style={{ maxWidth: paper.previewWidth }}
          >
            {/* ── L'ÉMETTEUR À GAUCHE, LA NATURE DU DOCUMENT À DROITE ──
                La grammaire de la facture et du devis, pour que les
                documents d'une même maison se ressemblent. Ce qui n'y
                figure plus : le slogan de la boutique, qui n'apprend
                rien à un fournisseur, et le compte de références, qui
                ne faisait que répéter le nombre de lignes du tableau. */}
            <header className="flex items-start justify-between gap-8 border-b border-slate-200 pb-5">
              <div className="min-w-0">
                {invoicePrefs.showLogo && settings?.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt=""
                    className="mb-2 h-12 w-auto max-w-[150px] object-contain object-left"
                  />
                )}
                <p className="text-[15px] font-bold uppercase leading-tight tracking-tight text-slate-900">
                  {nomBoutique}
                </p>
                <div className="mt-1 space-y-px text-[10.5px] leading-snug text-slate-500">
                  {invoicePrefs.showAddress && settings?.address && <p>{settings.address}</p>}
                  {coordonnees && <p>{coordonnees}</p>}
                  {invoicePrefs.showNif && settings?.nifStat && <p>NIF/STAT {settings.nifStat}</p>}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-900">
                  Bon de commande
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Le{" "}
                  <span className="font-semibold text-slate-800">
                    {formatDateLocale(aujourdhui, "FR")}
                  </span>
                </p>
              </div>
            </header>

            {fournisseurUnique && (
              <section className="mt-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Fournisseur
                </p>
                <p className="mt-0.5 text-[13px] font-semibold text-slate-900">
                  {fournisseurUnique}
                </p>
              </section>
            )}

            {/* ── LE TABLEAU NE DIT QUE CE QUI CONCERNE LE FOURNISSEUR ──
                Le stock restant et le seuil d'alerte sont des affaires
                internes : ils n'ont rien à faire sur un document qui
                sort de la maison, et un fournisseur n'a pas à savoir
                combien il vous reste. Ils demeurent dans le fichier
                tableur, qui sert, lui, à travailler la liste. */}
            <table className="mt-5 w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-y border-slate-300 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 [&>th]:whitespace-nowrap [&>th]:py-2">
                  <th className="w-[10%] pr-2">Réf.</th>
                  <th className="pr-2">Désignation</th>
                  <th className="w-[11%] px-2 text-center">Qté</th>
                  <th className="w-[21%] px-2 text-right">Prix unitaire</th>
                  <th className="w-[21%] pl-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 align-top">
                    <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-500">
                      {l.reference}
                    </td>
                    <td className="py-2.5 pr-2 font-medium text-slate-900">
                      {l.produit}
                      {/* Le fournisseur ne redescend ici que lorsque la
                          commande en mêle plusieurs. */}
                      {!fournisseurUnique && l.fournisseur && (
                        <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                          {l.fournisseur}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-center font-semibold tabular-nums text-slate-900">
                      {quantite(l.quantiteSuggeree, l.unite)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-slate-600">
                      {l.prixAchat === null ? "—" : formatCurrency(l.prixAchat)}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-2 text-right font-semibold tabular-nums text-slate-900">
                      {l.totalEstime === null ? "—" : formatCurrency(l.totalEstime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="mt-5 flex justify-end">
              <div className="w-[52%] border-t-2 border-slate-900 pt-2.5">
                <div className="flex items-baseline justify-between gap-6">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Total
                  </span>
                  <span className="whitespace-nowrap text-[17px] font-bold tabular-nums text-slate-900">
                    {total.montant === null ? "—" : formatCurrency(total.montant)}
                  </span>
                </div>
              </div>
            </section>

            {/* ── LE PIED NE PORTE QUE CE QU'UN BON DE COMMANDE PORTE ──
                Plus de message de remerciement : celui-ci est réglé
                pour les reçus de VENTE, et « sans reprise après la
                vente » n'a aucun sens adressé à un fournisseur. Restent
                une mention courte sur les prix, et la place de signer. */}
            <footer className="mt-10 flex items-end justify-between gap-8">
              <p className="max-w-[55%] text-[9.5px] leading-relaxed text-slate-400">
                Prix indicatifs, d&apos;après le dernier achat connu.
                {total.lignesSansPrix > 0 &&
                  (total.lignesSansPrix > 1
                    ? ` ${total.lignesSansPrix} lignes ne sont pas chiffrées.`
                    : " 1 ligne n'est pas chiffrée.")}
              </p>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Cachet et signature
                </p>
                <div className="mt-10 w-44 border-b border-slate-300" />
              </div>
            </footer>
          </div>
        </div>
      )}
    </Modal>
  );
};
