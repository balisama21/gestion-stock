import React, { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { EditeurLibre } from "./EditeurLibre";
import { EditeurColonne } from "./EditeurColonne";
import type { Document } from "../../features/documents/lib/buildDocument";
import type { FormatDocument } from "../../features/documents/DocumentPreview";
import type { ModeleDocument } from "../../features/documents/lib/reglages";
import { resoudreType } from "../../features/documents/lib/resolveur";
import type { TypeDocumentV3 } from "../../features/documents/lib/typesDocument";
import { useReglagesModifiables } from "../../features/documents/contexteReglages";
import {
  creerDisposition,
  dispositionDuType,
  type Disposition,
} from "../../features/documents/lib/disposition";

interface Props {
  document: Document;
  format: FormatDocument;
  /** La disposition affichée, ou `null` en mode simple. */
  dispositionId: string | null;
  /** Le modèle affiché en mode simple : c'est de lui que part une nouvelle disposition. */
  modele: ModeleDocument;
  /** Pièce déjà émise : on règle les suivantes, pas celle-ci. */
  pieceFigee?: boolean;
  /** Après un enregistrement, la disposition que la fenêtre doit montrer. */
  onDisposition?: (id: string) => void;
  /** L'éditeur couvre l'écran : la fenêtre du dessous ne doit plus se fermer à Échap. */
  onOuverture?: (ouvert: boolean) => void;
}

/** « Modifier la mise en page » depuis un document réel, pour qui a le droit de régler les documents. */
export const ModifierMiseEnPage: React.FC<Props> = ({
  document: doc,
  format,
  dispositionId,
  modele,
  pieceFigee,
  onDisposition,
  onOuverture,
}) => {
  const ctx = useReglagesModifiables();
  const [edition, setEdition] = useState<Disposition | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ctx?.peutRegler) return null;
  const r = ctx.reglages;
  const rouleau = format !== "a4";
  const type: TypeDocumentV3 = rouleau ? "ticket" : (doc.type as TypeDocumentV3);

  const ouvrir = () => {
    setErreur(null);
    const choisie =
      !rouleau && !pieceFigee && dispositionId ? r.libre.dispositions[dispositionId] : undefined;
    const existante = choisie ?? (rouleau || pieceFigee ? dispositionDuType(r.libre, type) : null);
    const depart = pieceFigee ? resoudreType(r, type).modele : modele;
    setEdition(
      existante ??
        creerDisposition(
          type,
          rouleau ? "classique" : depart,
          `Ma disposition ${rouleau ? "ticket" : ""}`.trim(),
        ),
    );
    onOuverture?.(true);
  };

  const fermer = (d: Disposition) => {
    if (
      edition &&
      JSON.stringify(d) !== JSON.stringify(edition) &&
      !window.confirm("Quitter sans enregistrer vos changements ?")
    ) {
      return;
    }
    setEdition(null);
    onOuverture?.(false);
  };

  const enregistrer = async (d: Disposition) => {
    setEnCours(true);
    setErreur(null);
    const echec = await ctx.enregistrer({
      ...r,
      libre: {
        dispositions: { ...r.libre.dispositions, [d.id]: d },
        parType: { ...r.libre.parType, [type]: d.id },
      },
    });
    setEnCours(false);
    if (echec) {
      setErreur(echec);
      window.alert(`La mise en page n'a pas été enregistrée : ${echec}`);
      return;
    }
    setEdition(null);
    onOuverture?.(false);
    if (!pieceFigee && !rouleau) onDisposition?.(d.id);
  };

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="app-btn-secondary"
        title={
          pieceFigee
            ? "Cette pièce est déjà émise et garde sa présentation. Les changements vaudront pour les suivantes."
            : "Déplacer les blocs, régler la feuille, placer un cachet"
        }
      >
        <LayoutTemplate className="h-4 w-4" />
        Modifier la mise en page
      </button>
      {erreur && !edition && (
        <span role="alert" className="text-xs t-danger">
          {erreur}
        </span>
      )}
      {edition && rouleau && (
        <EditeurColonne
          disposition={edition}
          document={doc}
          ticket={{ ...r.ticket, largeur: format === "t58" ? 58 : 80 }}
          enCours={enCours}
          onFermer={fermer}
          onEnregistrer={(d) => void enregistrer(d)}
        />
      )}
      {edition && !rouleau && (
        <EditeurLibre
          disposition={edition}
          document={doc}
          couleur={resoudreType(r, type).couleur}
          reglages={r}
          enCours={enCours}
          onFermer={fermer}
          onEnregistrer={(d) => void enregistrer(d)}
        />
      )}
    </>
  );
};
