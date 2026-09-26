import React, { useState } from "react";
import { FileText } from "lucide-react";
import { Modal } from "../../components/shared/Modal";
import type { Document } from "./lib/buildDocument";
import { DocumentPreview, type FormatDocument } from "./DocumentPreview";
import type { ModeleDocument, ReglagesDocuments } from "./lib/reglages";
import { resoudreType } from "./lib/resolveur";
import { dispositionDuType } from "./lib/disposition";

/**
 * LA FENÊTRE QUI SORT UN DOCUMENT
 *
 * Une seule, pour les cinq documents et les quatre écrans qui les
 * ouvrent. Chaque écran n'a donc qu'à dire QUEL document, pas comment
 * l'afficher — c'est ce qui évite que la facture des Ventes et celle
 * des Commandes se mettent à diverger.
 *
 * ── LE CHOIX DE MODÈLE NE S'ENREGISTRE PAS ─────────────────────────
 *
 * Le modèle de la boutique s'applique partout. Sur un document
 * précis, on peut en essayer un autre — pour ce tirage-là seulement.
 * Le réglage de la boutique n'est pas touché : il se change dans
 * Paramètres → Documents, et nulle part ailleurs.
 */

const FORMATS: { cle: FormatDocument; nom: string }[] = [
  { cle: "a4", nom: "Feuille A4" },
  { cle: "t80", nom: "Ticket 80 mm" },
  { cle: "t58", nom: "Ticket 58 mm" },
];

const MODELES: { cle: ModeleDocument; nom: string }[] = [
  { cle: "classique", nom: "Classique" },
  { cle: "bandeau", nom: "Bandeau" },
  { cle: "epure", nom: "Épuré" },
  { cle: "compact", nom: "Compact" },
];

interface SortieDocumentProps {
  document: Document;
  reglages: ReglagesDocuments;
  onFermer: () => void;
  /** Un devis ne s'imprime pas sur un rouleau de caisse. */
  formats?: FormatDocument[];
  titre?: string;
}

export const SortieDocument: React.FC<SortieDocumentProps> = ({
  document: doc,
  reglages,
  onFermer,
  formats = ["a4", "t80", "t58"],
  titre,
}) => {
  const [format, setFormat] = useState<FormatDocument>(formats[0] ?? "a4");
  // Le modèle de départ est celui du TYPE, qui suit la boutique à
  // défaut du sien. Le changer ici ne vaut que pour ce tirage.
  // « libre:<id> » pour une disposition libre, sinon le nom du modèle.
  const [modele, setModele] = useState<string>(() => {
    const libre = dispositionDuType(reglages.libre, doc.type);
    return libre ? `libre:${libre.id}` : resoudreType(reglages, doc.type).modele;
  });
  const dispositions = Object.values(reglages.libre.dispositions).filter(
    (d) => d.type === doc.type,
  );
  const dispositionId = modele.startsWith("libre:") ? modele.slice(6) : null;
  const choix = FORMATS.filter((f) => formats.includes(f.cle));

  return (
    <Modal
      open
      onClose={onFermer}
      size="3xl"
      icon={<FileText className="h-4 w-4" />}
      title={titre ?? doc.titre.charAt(0) + doc.titre.slice(1).toLowerCase()}
      description={doc.numero}
      bodyClassName="space-y-4"
      headerAside={
        <div className="flex flex-wrap items-center gap-2">
          {choix.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Format du papier</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as FormatDocument)}
                className="app-field-sm w-auto"
              >
                {choix.map((f) => (
                  <option key={f.cle} value={f.cle}>
                    {f.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Le modèle ne se choisit que pour les feuilles : un ticket
              de caisse n'en a qu'un. */}
          {format === "a4" && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Modèle, pour ce document seulement</span>
              <select
                value={modele}
                onChange={(e) => setModele(e.target.value)}
                className="app-field-sm w-auto"
                title="Change le modèle pour ce document seulement. Le réglage de la boutique n'est pas modifié."
              >
                {MODELES.map((m) => (
                  <option key={m.cle} value={m.cle}>
                    {m.nom}
                  </option>
                ))}
                {dispositions.map((d) => (
                  <option key={d.id} value={`libre:${d.id}`}>
                    {d.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      }
    >
      <DocumentPreview
        document={doc}
        reglages={reglages}
        format={format}
        modele={dispositionId ? undefined : (modele as ModeleDocument)}
        dispositionId={dispositionId}
      />
    </Modal>
  );
};
