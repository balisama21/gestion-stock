import React from "react";
import {
  champsDe,
  valeurEnClair,
  type ChampPerso,
  type EntiteChamp,
  type ValeursPerso,
} from "../../lib/champsPersonnalises";

/**
 * Les champs qu'une entreprise a ajoutés elle-même, affichés et saisis.
 *
 * Le produit ne peut pas prévoir le numéro de patient d'une pharmacie,
 * la taille de palette d'un emballeur ou le code douane d'un
 * importateur. Ces champs-là sont définis dans les Paramètres, stockés
 * dans une colonne JSON de la fiche, et rendus ici — un seul composant
 * pour les quatre entités, sans quoi chaque écran redévelopperait sa
 * propre version de la même chose.
 *
 * Ce fichier ne connaît aucune entité en particulier : il reçoit des
 * définitions et des valeurs, il rend. C'est ce qui permettra d'ajouter
 * les dossiers ou les commandes plus tard sans le rouvrir.
 */

interface SaisieProps {
  definitions: ChampPerso[];
  entite: EntiteChamp;
  valeurs: ValeursPerso;
  onChange: (valeurs: ValeursPerso) => void;
  /** Préfixe des identifiants, pour ne pas collisionner entre formulaires. */
  prefixe: string;
}

export const ChampsPersoSaisie: React.FC<SaisieProps> = ({
  definitions,
  entite,
  valeurs,
  onChange,
  prefixe,
}) => {
  const champs = champsDe(definitions, entite);
  if (champs.length === 0) return null;

  const modifier = (cle: string, valeur: ValeursPerso[string]) =>
    onChange({ ...valeurs, [cle]: valeur });

  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Vos champs
      </legend>
      {champs.map((champ) => {
        const id = `${prefixe}-cp-${champ.cle}`;
        const valeur = valeurs[champ.cle];
        const texte = valeur === null || valeur === undefined ? "" : String(valeur);
        const aide = champ.aide ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{champ.aide}</p>
        ) : null;

        // Une case à cocher ne se présente pas comme une case de saisie :
        // son libellé est à côté, pas au-dessus.
        if (champ.type === "booleen") {
          return (
            <div key={champ.id} className="flex items-start gap-2.5 sm:pt-5">
              <input
                id={id}
                type="checkbox"
                checked={Boolean(valeur)}
                onChange={(e) => modifier(champ.cle, e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
              />
              <span>
                <label htmlFor={id} className="text-sm text-foreground">
                  {champ.libelle}
                </label>
                {aide}
              </span>
            </div>
          );
        }

        return (
          <div key={champ.id} className={champ.type === "texte_long" ? "sm:col-span-2" : undefined}>
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
              {champ.libelle}
              {champ.obligatoire && <span className="t-danger"> *</span>}
            </label>

            {champ.type === "texte_long" ? (
              <textarea
                id={id}
                rows={2}
                className="app-field resize-none"
                value={texte}
                onChange={(e) => modifier(champ.cle, e.target.value)}
              />
            ) : champ.type === "liste" ? (
              <select
                id={id}
                className="app-field"
                value={texte}
                onChange={(e) => modifier(champ.cle, e.target.value)}
              >
                <option value="">Non précisé</option>
                {(champ.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={champ.type === "nombre" ? "number" : champ.type === "date" ? "date" : "text"}
                inputMode={champ.type === "nombre" ? "decimal" : undefined}
                step={champ.type === "nombre" ? "any" : undefined}
                className="app-field"
                value={texte}
                onChange={(e) =>
                  modifier(
                    champ.cle,
                    champ.type === "nombre"
                      ? e.target.value === ""
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
            {aide}
          </div>
        );
      })}
    </fieldset>
  );
};

interface LectureProps {
  definitions: ChampPerso[];
  entite: EntiteChamp;
  valeurs: ValeursPerso;
  titre?: string;
}

export const ChampsPersoLecture: React.FC<LectureProps> = ({
  definitions,
  entite,
  valeurs,
  titre = "Vos champs",
}) => {
  // Un champ défini mais laissé vide sur cette fiche ne s'affiche pas :
  // c'est la règle de tout l'écran, une valeur absente ne prend pas de
  // place.
  const remplis = champsDe(definitions, entite)
    .map((champ) => ({ champ, texte: valeurEnClair(champ, valeurs[champ.cle]) }))
    .filter((x) => x.texte !== null);

  if (remplis.length === 0) return null;

  return (
    <div className="app-card p-5">
      <h4 className="mb-3 text-sm font-bold text-foreground">{titre}</h4>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {remplis.map(({ champ, texte }) => (
          <div key={champ.id} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{champ.libelle}</dt>
            {/* Une référence sans espace ne doit pas élargir la fiche. */}
            <dd className="break-words text-sm text-foreground">{texte}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
