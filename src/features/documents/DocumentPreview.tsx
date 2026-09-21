import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Printer } from "lucide-react";
import type { PaperFormat } from "../../lib/paperFormats";
import { exporterImage, exporterPdf } from "../../lib/documentExport";
import { messageDErreurExport, reprendreApresDeploiement } from "../../lib/chunkRecovery";
import type { Document } from "./lib/buildDocument";
import { imprimerFeuille } from "./lib/imprimer";
import { variablesDeCouleur, type ReglagesDocuments } from "./lib/reglages";
import { Classique } from "./templates/Classique";
import "./index.css";

/**
 * L'APERÇU D'UN DOCUMENT, ET LES TROIS FAÇONS DE LE SORTIR
 *
 * ── LA FEUILLE NE SE REPLIE JAMAIS ─────────────────────────────────
 *
 * C'est tout l'objet de ce composant, et la correction du défaut le
 * plus visible des documents actuels. Ceux-ci sont en `width: 100%`
 * plafonnés par une `max-width` : sur un téléphone ils se remettent
 * en page à trois cent vingt pixels, et comme le PDF est une
 * PHOTOGRAPHIE du bloc affiché, le fichier sort avec une colonne par
 * syllabe — « PRO / DUI / T » en en-tête. Constaté sur un vrai
 * fichier.
 *
 * Ici la feuille fait 210 mm, toujours. Ce qui s'adapte à l'écran,
 * c'est une mise à l'échelle par `transform`, qui réduit la taille
 * APPARENTE sans toucher à la mise en page. Le PDF produit depuis un
 * téléphone est donc identique à celui produit depuis un ordinateur.
 *
 * ── LE FORMAT DE PAPIER EST SANS MARGE ─────────────────────────────
 *
 * `exporterPdf` ajoute les marges du format autour de la capture. Or
 * les marges de nos documents sont DANS la feuille (`.doc-pad`) :
 * reprendre les 12 mm du format A4 de l'application les compterait
 * deux fois et rétrécirait le document. D'où ce format local à marge
 * nulle, qui n'est utilisé que par les documents v2.
 */
const FEUILLE_A4: PaperFormat = {
  id: "a4",
  label: "A4",
  hint: "210 × 297 mm",
  layout: "invoice",
  widthMm: 210,
  heightMm: 297,
  marginMm: 0,
  // 210 mm à 96 points par pouce.
  previewWidth: Math.round((210 * 96) / 25.4),
};

/** La largeur de la feuille en pixels CSS, telle que le CSS la pose. */
const LARGEUR_FEUILLE = FEUILLE_A4.previewWidth;

interface DocumentPreviewProps {
  document: Document;
  reglages: ReglagesDocuments;
  /** Masque les boutons : l'aperçu en direct des réglages n'en a pas. */
  sansActions?: boolean;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document: doc,
  reglages,
  sansActions,
}) => {
  const scene = useRef<HTMLDivElement>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState<number | null>(null);
  const [exportEnCours, setExportEnCours] = useState<null | "pdf" | "image">(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /*
   * L'échelle se recalcule à chaque changement de largeur du cadre.
   * `useLayoutEffect` et non `useEffect` : la feuille est posée à
   * 210 mm avant la première image, et sans cette synchronisation on
   * verrait un document déborder pendant une fraction de seconde sur
   * un téléphone.
   *
   * La hauteur du conteneur est fixée à la hauteur RÉDUITE : une
   * transformation ne change pas la place qu'un élément occupe dans
   * le flux, et sans cela une feuille à 40 % laisserait sous elle le
   * vide de sa taille entière.
   */
  const mesurer = useCallback(() => {
    const cadre = scene.current;
    const papier = feuille.current;
    if (!cadre || !papier) return;
    const dispo = cadre.clientWidth;
    const e = dispo > 0 ? Math.min(1, dispo / LARGEUR_FEUILLE) : 1;
    setEchelle(e);
    setHauteur(papier.offsetHeight * e);
  }, []);

  useLayoutEffect(() => {
    mesurer();
    const cadre = scene.current;
    if (!cadre || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(cadre);
    return () => obs.disconnect();
  }, [mesurer]);

  // Le contenu change de hauteur quand le document change.
  useEffect(() => {
    mesurer();
  }, [doc, mesurer]);

  const exporter = async (type: "pdf" | "image") => {
    const noeud = feuille.current;
    if (!noeud || exportEnCours) return;
    setExportEnCours(type);
    setErreur(null);
    try {
      if (type === "pdf") await exporterPdf(noeud, FEUILLE_A4, doc.nomDeFichier);
      else await exporterImage(noeud, doc.nomDeFichier, "png");
    } catch (err) {
      // Un morceau manquant signifie que l'onglet exécute une version
      // périmée : la page se recharge d'elle-même.
      if (reprendreApresDeploiement(err)) return;
      setErreur(messageDErreurExport(err));
    } finally {
      setExportEnCours(null);
    }
  };

  return (
    <div className="doc-racine" style={variablesDeCouleur(reglages.couleur) as React.CSSProperties}>
      {erreur && (
        <p
          role="alert"
          className="no-print mb-3 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm t-danger"
        >
          {erreur}
        </p>
      )}

      <div className="doc-scene" ref={scene}>
        <div
          className="doc-echelle"
          style={{ transform: `scale(${echelle})`, height: hauteur ?? undefined }}
        >
          {/*
           * `printable-receipt` est l'accroche que la feuille de style
           * d'impression de l'application connaît déjà : elle masque
           * tout le reste de la modale et neutralise les conteneurs
           * qui rogneraient le document. La reprendre évite de
           * réécrire un travail qui a demandé plusieurs corrections.
           */}
          <div className="doc-feuille printable-receipt m-classique" ref={feuille}>
            <Classique document={doc} />
          </div>
        </div>
      </div>

      {!sansActions && (
        <div className="no-print mt-4 flex flex-wrap justify-end gap-2">
          {/*
           * « Imprimer » est l'action principale, et ce n'est pas un
           * détail : elle produit du TEXTE réel, sélectionnable et net
           * à toute taille. Le PDF, lui, est une photographie du bloc
           * — fidèle, mais pesante et non sélectionnable. Le bouton
           * qui donne le meilleur résultat doit être celui qu'on
           * atteint sans réfléchir.
           */}
          <button type="button" onClick={imprimerFeuille} className="app-btn-primary">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => exporter("pdf")}
            disabled={exportEnCours !== null}
            className="app-btn-secondary"
            title="Un PDF fidèle à l'aperçu, à envoyer ou à archiver"
          >
            <Download className="h-4 w-4" />
            {exportEnCours === "pdf" ? "Création…" : "PDF"}
          </button>
          <button
            type="button"
            onClick={() => exporter("image")}
            disabled={exportEnCours !== null}
            className="app-btn-secondary"
            title="Une image, pratique à envoyer par messagerie"
          >
            <ImageIcon className="h-4 w-4" />
            {exportEnCours === "image" ? "Création…" : "Image"}
          </button>
        </div>
      )}
    </div>
  );
};
