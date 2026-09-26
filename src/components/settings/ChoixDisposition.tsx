import React, { useState } from "react";
import { Copy, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { SettingsBlock } from "./primitives";
import { EditeurLibre } from "./EditeurLibre";
import { EditeurColonne } from "./EditeurColonne";
import { MODELES_DOCUMENT } from "./choixDocuments";
import type { Document } from "../../features/documents/lib/buildDocument";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import { resoudreType } from "../../features/documents/lib/resolveur";
import type { TypeDocumentV3 } from "../../features/documents/lib/typesDocument";
import {
  creerDisposition,
  dupliquerDisposition,
  type Disposition,
  type ReglagesLibres,
} from "../../features/documents/lib/disposition";

interface Props {
  reglages: ReglagesDocuments;
  type: TypeDocumentV3;
  document: Document | null;
  onChange: (libre: ReglagesLibres) => void;
  /** Enregistre tout l'écran avec cette version du mode libre. */
  onEnregistrer: (libre: ReglagesLibres) => Promise<void> | void;
}

const nomDuModele = (cle: string) => MODELES_DOCUMENT.find((m) => m.cle === cle)?.nom ?? cle;

const carte = (choisie: boolean) =>
  `rounded-xl border px-3 py-2.5 text-left transition-colors ${
    choisie ? "border-success-border bg-success-soft" : "border-border bg-card hover:bg-muted"
  }`;

export const ChoixDisposition: React.FC<Props> = ({
  reglages,
  type,
  document: doc,
  onChange,
  onEnregistrer,
}) => {
  const libre = reglages.libre;
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [depart, setDepart] = useState<string>(resoudreType(reglages, type).modele);
  const [enCours, setEnCours] = useState(false);
  const enColonne = type === "ticket";

  const duType = Object.values(libre.dispositions).filter((d) => d.type === type);
  const active = libre.parType[type];
  const choisie = active ? libre.dispositions[active] : undefined;
  const editee = ouverte ? libre.dispositions[ouverte] : undefined;

  const utiliser = (id: string | null) => {
    const parType = { ...libre.parType };
    if (id) parType[type] = id;
    else delete parType[type];
    onChange({ ...libre, parType });
  };

  const ajouter = (d: Disposition) => {
    onChange({
      dispositions: { ...libre.dispositions, [d.id]: d },
      parType: { ...libre.parType, [type]: d.id },
    });
    setOuverte(d.id);
  };

  const creer = () => {
    const source = libre.dispositions[depart];
    const nom = `Disposition ${duType.length + 1}`;
    ajouter(
      source
        ? dupliquerDisposition(source, nom)
        : creerDisposition(type, enColonne ? "classique" : (depart as never), nom),
    );
  };

  const supprimer = (d: Disposition) => {
    if (!window.confirm(`Supprimer la disposition « ${d.nom} » ?`)) return;
    const dispositions = { ...libre.dispositions };
    delete dispositions[d.id];
    const parType = { ...libre.parType };
    for (const [t, id] of Object.entries(parType)) {
      if (id === d.id) delete parType[t as TypeDocumentV3];
    }
    onChange({ dispositions, parType });
  };

  const avec = (d: Disposition): ReglagesLibres => ({
    ...libre,
    dispositions: { ...libre.dispositions, [d.id]: d },
  });

  return (
    <SettingsBlock>
      <p className="text-sm font-semibold text-foreground">Disposition sur la feuille</p>
      <p className="mb-3 mt-0.5 text-xs leading-relaxed text-muted-foreground">
        Le mode simple suit le modèle et la mise en page réglés plus bas. Une disposition libre
        place chaque bloc où vous le voulez sur la feuille ; les données restent calculées.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          type="button"
          aria-pressed={!choisie}
          onClick={() => utiliser(null)}
          className={carte(!choisie)}
        >
          <span className="block text-sm font-medium text-foreground">Mode simple</span>
          <span className="block text-xs text-muted-foreground">
            {enColonne
              ? "Ticket actuel"
              : `Modèle ${nomDuModele(resoudreType(reglages, type).modele)}`}
          </span>
        </button>
        {duType.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={choisie?.id === d.id}
            onClick={() => utiliser(d.id)}
            className={carte(choisie?.id === d.id)}
          >
            <span className="block truncate text-sm font-medium text-foreground">{d.nom}</span>
            <span className="block text-xs text-muted-foreground">
              {enColonne ? "Ordre personnalisé" : `Libre · départ ${nomDuModele(d.base)}`}
            </span>
          </button>
        ))}
      </div>

      {choisie && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOuverte(choisie.id)} className="app-btn-primary">
            <LayoutTemplate className="h-4 w-4" />
            Modifier sur la feuille
          </button>
          <button
            type="button"
            onClick={() => ajouter(dupliquerDisposition(choisie, `${choisie.nom} (copie)`))}
            className="app-btn-secondary"
          >
            <Copy className="h-4 w-4" />
            Dupliquer
          </button>
          <button type="button" onClick={() => supprimer(choisie)} className="app-btn-secondary">
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground sm:max-w-xs">
          Nouvelle disposition, à partir de
          <select
            value={depart}
            onChange={(e) => setDepart(e.target.value)}
            className="app-field mt-1 w-full"
          >
            {enColonne ? (
              <option value="classique">Le ticket actuel</option>
            ) : (
              MODELES_DOCUMENT.map((m) => (
                <option key={m.cle} value={m.cle}>
                  Modèle {m.nom}
                </option>
              ))
            )}
            {duType.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={creer} className="app-btn-secondary">
          <Plus className="h-4 w-4" />
          Créer
        </button>
      </div>

      {editee && enColonne && (
        <EditeurColonne
          key={editee.id}
          disposition={editee}
          document={doc}
          ticket={reglages.ticket}
          enCours={enCours}
          onFermer={(d) => {
            onChange(avec(d));
            setOuverte(null);
          }}
          onEnregistrer={async (d) => {
            setEnCours(true);
            try {
              await onEnregistrer(avec(d));
            } finally {
              setEnCours(false);
            }
          }}
        />
      )}

      {editee && !enColonne && (
        <EditeurLibre
          key={editee.id}
          disposition={editee}
          document={doc}
          couleur={resoudreType(reglages, type).couleur}
          reglages={reglages}
          enCours={enCours}
          onFermer={(d) => {
            onChange(avec(d));
            setOuverte(null);
          }}
          onEnregistrer={async (d) => {
            setEnCours(true);
            try {
              await onEnregistrer(avec(d));
            } finally {
              setEnCours(false);
            }
          }}
        />
      )}
    </SettingsBlock>
  );
};
