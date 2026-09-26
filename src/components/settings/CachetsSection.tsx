import React, { useState } from "react";
import { Plus, Stamp, Trash2 } from "lucide-react";
import { SettingsBlock, SettingsSection } from "./primitives";
import { ImportCachet } from "./ImportCachet";
import { largeurNetteMm, type Cachet } from "../../features/documents/lib/cachets";
import { useImageCachet } from "../../features/documents/lib/traiterCachet";

interface Props {
  cachets: Cachet[];
  storeId?: string;
  onChange: (cachets: Cachet[]) => void;
  /** Enregistre aussitôt : l'image est déjà dans le seau, la liste doit suivre. */
  onEnregistrer: (cachets: Cachet[]) => Promise<void> | void;
}

const DAMIER = "repeating-conic-gradient(#eef1ef 0% 25%, #ffffff 0% 50%) 50% / 12px 12px";

const Vignette: React.FC<{ cachet: Cachet }> = ({ cachet }) => {
  const url = useImageCachet(cachet.chemin);
  return (
    <div
      className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md"
      style={{ background: DAMIER }}
    >
      {url && (
        <img
          src={url}
          alt=""
          className="max-h-full max-w-full object-contain"
          style={{ opacity: cachet.opacite }}
        />
      )}
    </div>
  );
};

export const CachetsSection: React.FC<Props> = ({ cachets, storeId, onChange, onEnregistrer }) => {
  const [ajout, setAjout] = useState(false);

  const renommer = (id: string, nom: string) =>
    onChange(cachets.map((c) => (c.id === id ? { ...c, nom } : c)));

  const retirer = (c: Cachet) => {
    if (!window.confirm(`Retirer « ${c.nom} » de la liste ? Les documents déjà émis le gardent.`)) {
      return;
    }
    onChange(cachets.filter((x) => x.id !== c.id));
  };

  return (
    <SettingsSection
      title="Cachets et signatures"
      icon={<Stamp className="h-4 w-4" />}
      description="Photographiés depuis le téléphone ou importés, le fond retiré automatiquement. Plusieurs par boutique, chacun nommé."
    >
      <SettingsBlock>
        {cachets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun cachet ni signature pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {cachets.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <Vignette cachet={c} />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={c.nom}
                    onChange={(e) => renommer(c.id, e.target.value)}
                    aria-label="Nom du cachet"
                    className="app-field w-full"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.largeur} × {c.hauteur} px · net jusqu&apos;à {largeurNetteMm(c)} mm de large
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => retirer(c)}
                  className="inline-flex h-[34px] w-[34px] items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={`Retirer ${c.nom}`}
                  title="Retirer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setAjout(true)}
          disabled={!storeId}
          className="app-btn-secondary mt-3"
        >
          <Plus className="h-4 w-4" />
          Ajouter un cachet ou une signature
        </button>
      </SettingsBlock>

      {ajout && storeId && (
        <ImportCachet
          storeId={storeId}
          onFermer={() => setAjout(false)}
          onAjoute={async (c) => {
            await onEnregistrer([...cachets, c]);
            setAjout(false);
          }}
        />
      )}
    </SettingsSection>
  );
};
