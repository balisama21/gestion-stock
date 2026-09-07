import React, { useState } from "react";
import { Eye, EyeOff, Languages, RotateCcw } from "lucide-react";
import { SettingsSection } from "./primitives";
import { MODULES_PERSONNALISABLES, type Personnalisation } from "../../lib/personnalisation";

interface VocabulaireSectionProps {
  personnalisation: Personnalisation;
  onSave: (p: Personnalisation) => Promise<void> | void;
}

/**
 * Le vocabulaire de la maison, et les modules qu'on garde.
 *
 * Une pharmacie dit « patients », une école dit « élèves ». Et personne
 * n'a besoin de voir treize modules quand son métier en emploie six.
 *
 * Le tableau de bord et les paramètres ne figurent pas dans la liste :
 * on ne masque pas la porte d'entrée d'une application, ni le moyen de
 * revenir en arrière quand on a tout masqué par erreur.
 */
export const VocabulaireSection: React.FC<VocabulaireSectionProps> = ({
  personnalisation,
  onSave,
}) => {
  const [brouillon, setBrouillon] = useState<Personnalisation>(personnalisation);
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  const reglage = (cle: string) => brouillon.modules?.[cle] ?? {};

  const modifier = (cle: string, patch: { libelle?: string; masque?: boolean }) =>
    setBrouillon((p) => ({
      ...p,
      modules: { ...(p.modules ?? {}), [cle]: { ...(p.modules?.[cle] ?? {}), ...patch } },
    }));

  const modifie = JSON.stringify(brouillon) !== JSON.stringify(personnalisation);

  const enregistrer = async () => {
    setEnregistrement(true);
    // Les réglages vides sont retirés avant d'écrire : une clé qui ne dit
    // rien vaut mieux absente, c'est ce qui laisse le module suivre les
    // évolutions du logiciel plutôt qu'un choix figé un jour donné.
    const propre: Personnalisation = { modules: {} };
    for (const [cle, r] of Object.entries(brouillon.modules ?? {})) {
      const libelle = r.libelle?.trim();
      const entree: { libelle?: string; masque?: boolean } = {};
      if (libelle) entree.libelle = libelle;
      if (r.masque) entree.masque = true;
      if (Object.keys(entree).length > 0) propre.modules![cle] = entree;
    }
    await onSave(propre);
    setEnregistrement(false);
    setEnregistre(true);
    window.setTimeout(() => setEnregistre(false), 3000);
  };

  return (
    <SettingsSection
      title="Vocabulaire et modules"
      description="Donnez à chaque écran le nom employé dans votre métier, et retirez ceux qui ne vous servent pas."
      icon={<Languages className="w-4 h-4" />}
    >
      <div className="app-list">
        {MODULES_PERSONNALISABLES.map(({ cle, libelleParDefaut }) => {
          const r = reglage(cle);
          const masque = Boolean(r.masque);
          return (
            <div
              key={cle}
              className="app-list-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            >
              <label
                htmlFor={`voc-${cle}`}
                className="min-w-0 shrink-0 text-sm text-muted-foreground sm:w-44"
              >
                {libelleParDefaut}
              </label>
              <input
                id={`voc-${cle}`}
                type="text"
                placeholder={libelleParDefaut}
                disabled={masque}
                className="app-field flex-1 disabled:opacity-50"
                value={r.libelle ?? ""}
                onChange={(e) => modifier(cle, { libelle: e.target.value })}
              />
              <button
                type="button"
                onClick={() => modifier(cle, { masque: !masque })}
                aria-pressed={masque}
                className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  masque
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-success-border bg-success-soft t-success"
                }`}
              >
                {masque ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    Masqué
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Visible
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Masquer un module le retire du menu, de la barre du bas et du raccourci mobile.{" "}
        <strong className="font-semibold text-foreground">
          Aucune donnée n&apos;est supprimée
        </strong>{" "}
        — le module revient tel qu&apos;il était dès que vous le réaffichez.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {enregistre && (
          <p role="status" className="text-sm font-medium t-success sm:mr-auto">
            Vos réglages sont enregistrés.
          </p>
        )}
        <button
          type="button"
          onClick={() => setBrouillon({ modules: {} })}
          disabled={enregistrement}
          className="app-btn-secondary"
        >
          <RotateCcw className="h-4 w-4" />
          Tout remettre par défaut
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={enregistrement || !modifie}
          className="app-btn-primary"
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </SettingsSection>
  );
};
