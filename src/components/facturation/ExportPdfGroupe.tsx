import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../shared/Modal";
import { FileArchive } from "lucide-react";
import { DocumentPreview } from "../../features/documents/DocumentPreview";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import { capturer } from "../../lib/documentExport";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import type { DocumentCommercial } from "./documents";
import { construireLaPiece, type SourcesDeLaPiece } from "./construireLaPiece";

/**
 * TÉLÉCHARGER LES PDF DE LA SÉLECTION, EN UN SEUL FICHIER.
 *
 * ── POURQUOI C'EST LENT, ET POURQUOI ON LE DIT ─────────────────────
 *
 * Un PDF de ce logiciel est une PHOTOGRAPHIE de la feuille réellement
 * mise en page : c'est ce qui garantit que le fichier est exactement ce
 * que l'aperçu montre, page par page. Il faut donc monter chaque
 * document, attendre que sa pagination soit faite, le photographier,
 * puis passer au suivant. Trente factures prennent une poignée de
 * secondes, et la barre d'avancement dit où l'on en est plutôt que de
 * laisser croire à un écran figé.
 *
 * ── UN SEUL DOCUMENT À LA FOIS ─────────────────────────────────────
 *
 * Monter les trente d'un coup tiendrait trente feuilles A4 en mémoire,
 * images comprises, et ferait tomber un téléphone d'entrée de gamme.
 * On en tient un, on le range, on passe au suivant.
 *
 * L'aperçu est monté HORS CHAMP et non caché : `display: none` ne
 * calcule aucune hauteur, et la pagination ne saurait alors rien
 * mesurer — toutes les factures sortiraient sur une seule feuille.
 */

const A4 = { largeur: 210, hauteur: 297 };

export const ExportPdfGroupe: React.FC<{
  documents: DocumentCommercial[];
  sources: SourcesDeLaPiece;
  reglages: ReglagesDocuments;
  nomDeFichier: string;
  onFermer: () => void;
}> = ({ documents, sources, reglages, nomDeFichier, onFermer }) => {
  const [rang, setRang] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState(false);
  const fichiers = useRef<{ nom: string; blob: Blob }[]>([]);
  const enTraitement = useRef(false);

  const aFaire = documents.filter((d) => d.entite !== "devis" || d.devis);
  const courant = aFaire[rang] ?? null;
  const piece = courant ? construireLaPiece(courant, sources) : null;

  /* Une pièce qu'on ne sait pas construire est SAUTÉE, pas fatale :
     un export de trente factures ne doit pas échouer entièrement
     parce que l'une d'elles a perdu ses lignes. */
  useEffect(() => {
    if (courant && !piece) setRang((r) => r + 1);
  }, [courant, piece]);

  useEffect(() => {
    if (rang < aFaire.length || fini) return;
    setFini(true);
    void (async () => {
      try {
        if (fichiers.current.length === 0) {
          setErreur("Aucun document n'a pu être produit.");
          return;
        }
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const f of fichiers.current) zip.file(f.nom, f.blob);
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomDeFichier}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        onFermer();
      } catch (err) {
        if (reprendreApresDeploiement(err)) return;
        setErreur(messageDErreurExport(err));
      }
    })();
  }, [rang, aFaire.length, fini, nomDeFichier, onFermer]);

  const photographier = async (feuilles: HTMLElement[]) => {
    if (enTraitement.current || !piece) return;
    enTraitement.current = true;
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        unit: "mm",
        format: [A4.largeur, A4.hauteur],
        orientation: "portrait",
      });
      for (let i = 0; i < feuilles.length; i++) {
        const canvas = await capturer(feuilles[i]);
        if (i > 0) doc.addPage();
        const hauteur = A4.largeur * (canvas.height / canvas.width);
        doc.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          A4.largeur,
          Math.min(hauteur, A4.hauteur),
        );
      }
      fichiers.current.push({ nom: `${piece.nomDeFichier}.pdf`, blob: doc.output("blob") });
    } catch (err) {
      if (reprendreApresDeploiement(err)) return;
      setErreur(messageDErreurExport(err));
    } finally {
      enTraitement.current = false;
      setRang((r) => r + 1);
    }
  };

  const avancement = aFaire.length > 0 ? Math.round((rang / aFaire.length) * 100) : 100;

  return (
    <Modal
      open
      onClose={onFermer}
      size="md"
      dismissible={false}
      icon={<FileArchive className="h-4 w-4" />}
      title="Téléchargement des PDF"
      description={`${aFaire.length} document${aFaire.length > 1 ? "s" : ""}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {erreur
            ? erreur
            : rang < aFaire.length
              ? `Document ${rang + 1} sur ${aFaire.length}…`
              : "Assemblage du fichier…"}
        </p>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${avancement}%` }}
          />
        </div>

        {erreur && (
          <button type="button" onClick={onFermer} className="app-btn-secondary w-full">
            Fermer
          </button>
        )}
      </div>

      {/* Hors champ, mais mis en page : la pagination a besoin de
          hauteurs réelles, et `display: none` n'en calcule aucune. */}
      {piece && !erreur && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: -10_000,
            top: 0,
            width: 794,
            pointerEvents: "none",
          }}
        >
          <DocumentPreview
            key={courant?.cle}
            document={piece}
            reglages={reglages}
            format="a4"
            sansActions
            onPret={(feuilles) => void photographier(feuilles)}
          />
        </div>
      )}
    </Modal>
  );
};
