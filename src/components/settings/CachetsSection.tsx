import React, { useState } from "react";
import { PenLine, Plus, RefreshCw, Stamp, Trash2 } from "lucide-react";
import { SettingsBlock, SettingsSection } from "./primitives";
import { ImportCachet } from "./ImportCachet";
import {
  largeurNetteMm,
  NOM_PAR_ROLE,
  type Cachet,
  type RoleCachet,
} from "../../features/documents/lib/cachets";
import { useImageCachet } from "../../features/documents/lib/traiterCachet";
import { useConfirmation } from "../../hooks/useConfirmation";

interface Props {
  cachets: Cachet[];
  storeId?: string;
  onChange: (cachets: Cachet[]) => void;
  /** Enregistre aussitôt : l'image est déjà dans le seau, la liste doit suivre. */
  onEnregistrer: (cachets: Cachet[]) => Promise<void> | void;
}

const DAMIER = "repeating-conic-gradient(#eef1ef 0% 25%, #ffffff 0% 50%) 50% / 12px 12px";

const Vignette: React.FC<{ cachet: Cachet; grande?: boolean }> = ({ cachet, grande }) => {
  const url = useImageCachet(cachet.chemin);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md ${
        grande ? "h-28 w-full" : "h-14 w-20"
      }`}
      style={{ background: DAMIER }}
    >
      {url && (
        <img
          src={url}
          alt=""
          className="max-h-full max-w-full object-contain p-1"
          style={{ opacity: cachet.opacite }}
        />
      )}
    </div>
  );
};

const ROLES: {
  role: RoleCachet;
  icone: React.ReactNode;
  explication: string;
}[] = [
  {
    role: "cachet",
    icone: <Stamp className="h-4 w-4" />,
    explication: "Le tampon de l'entreprise. Photographiez-le sur une feuille blanche.",
  },
  {
    role: "signature",
    icone: <PenLine className="h-4 w-4" />,
    explication: "La signature de la personne qui engage la boutique, au stylo sur papier blanc.",
  },
];

/**
 * LE CACHET, LA SIGNATURE : DEUX EMPLACEMENTS
 *
 * Un tampon et une signature ne se remplacent pas l'un l'autre : le
 * premier dit quelle entreprise émet la pièce, la seconde qui l'engage.
 * Chacun a donc sa case. Sur la facture, la signature se pose à cheval
 * sur le tampon, au-dessus de la ligne « Cachet et signature ».
 *
 * Remplacer une image n'efface rien : les pièces déjà émises gardent
 * celle qu'elles portaient.
 */
export const CachetsSection: React.FC<Props> = ({ cachets, storeId, onChange, onEnregistrer }) => {
  const { confirmer, modaleConfirmation } = useConfirmation();
  const [ajout, setAjout] = useState<{ role: RoleCachet; remplace?: string } | null>(null);

  const principal = (role: RoleCachet) => cachets.find((c) => c.role === role);
  const autres = cachets.filter(
    (c) => c.id !== principal("cachet")?.id && c.id !== principal("signature")?.id,
  );

  /** Une image rangée dans la mauvaise case passe dans l'autre, en tête : c'est elle qui s'imprime. */
  const changerDeRole = (c: Cachet, role: RoleCachet) =>
    onChange([{ ...c, role }, ...cachets.filter((x) => x.id !== c.id)]);

  const renommer = (id: string, nom: string) =>
    onChange(cachets.map((c) => (c.id === id ? { ...c, nom } : c)));

  const retirer = async (c: Cachet) => {
    if (
      !(await confirmer(`Retirer « ${c.nom} » ? Les documents déjà émis le gardent.`, {
        danger: true,
        libelle: "Retirer",
      }))
    ) {
      return;
    }
    onChange(cachets.filter((x) => x.id !== c.id));
  };

  return (
    <SettingsSection
      title="Cachet et signature"
      icon={<Stamp className="h-4 w-4" />}
      description="Deux images distinctes, posées d'elles-mêmes sur vos factures, devis et reçus. Le fond est retiré automatiquement."
    >
      <SettingsBlock>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map(({ role, icone, explication }) => {
            const c = principal(role);
            return (
              <div key={role} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {icone}
                  {NOM_PAR_ROLE[role]}
                </div>
                {c ? (
                  <>
                    <Vignette cachet={c} grande />
                    <p className="text-xs text-muted-foreground">
                      Net jusqu&apos;à {largeurNetteMm(c)} mm de large
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAjout({ role, remplace: c.id })}
                        disabled={!storeId}
                        className="app-btn-secondary"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Remplacer
                      </button>
                      <button
                        type="button"
                        onClick={() => retirer(c)}
                        className="app-btn-secondary"
                        aria-label={`Retirer ${NOM_PAR_ROLE[role].toLowerCase()}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Retirer
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => changerDeRole(c, role === "cachet" ? "signature" : "cachet")}
                      className="self-start text-xs font-medium text-primary hover:underline"
                    >
                      {role === "cachet"
                        ? "C'est une signature ? La ranger en signature"
                        : "C'est un cachet ? Le ranger en cachet"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">{explication}</p>
                    <button
                      type="button"
                      onClick={() => setAjout({ role })}
                      disabled={!storeId}
                      className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      <Plus className="h-5 w-5" />
                      {role === "cachet" ? "Ajouter le cachet" : "Ajouter la signature"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {autres.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Autres images, à placer en mode libre
            </p>
            <ul className="divide-y divide-border">
              {autres.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <Vignette cachet={c} />
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={c.nom}
                      onChange={(e) => renommer(c.id, e.target.value)}
                      aria-label="Nom de l'image"
                      className="app-field w-full"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.role === "signature" ? "Signature" : "Cachet"} · net jusqu&apos;à{" "}
                      {largeurNetteMm(c)} mm de large
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
          </div>
        )}
      </SettingsBlock>

      {ajout && storeId && (
        <ImportCachet
          storeId={storeId}
          role={ajout.role}
          onFermer={() => setAjout(null)}
          onAjoute={async (c) => {
            // Le nouveau prend la place de l'ancien, en tête de liste : c'est lui que la facture appose.
            const reste = cachets.filter((x) => x.id !== ajout.remplace);
            await onEnregistrer([c, ...reste]);
            setAjout(null);
          }}
        />
      )}
      {modaleConfirmation}
    </SettingsSection>
  );
};
