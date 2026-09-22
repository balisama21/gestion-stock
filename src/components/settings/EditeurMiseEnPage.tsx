import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutTemplate,
  Lock,
  RotateCcw,
} from "lucide-react";
import { SettingsBlock, SettingsToggle } from "./primitives";
import type { ReglagesDocuments } from "../../features/documents/lib/reglages";
import { resoudreMiseEnPage } from "../../features/documents/lib/resolveur";
import {
  elementsDe,
  prereglage,
  ZONES,
  type MiseEnPage,
  type MisesEnPage,
  type Zone,
} from "../../features/documents/lib/miseEnPage";
import { DEFAUTS_TYPE, type TypeDocumentV3 } from "../../features/documents/lib/typesDocument";

/**
 * L'ÉDITEUR DE MISE EN PAGE (NIVEAU 3)
 *
 * Pour chaque élément du document : l'afficher ou non, lui donner son
 * propre mot, et le déplacer dans sa zone.
 *
 * ── IL N'EXISTE QUE SI ON L'OUVRE ──────────────────────────────────
 *
 * Tant que la boutique n'a pas cliqué sur « Personnaliser la mise en
 * page », rien n'est enregistré pour ce type et le document sort
 * comme avant. « Revenir au modèle par défaut » retire tout d'un
 * clic, sans toucher aux autres documents.
 *
 * ── DEUX FAÇONS DE DÉPLACER, ET C'EST VOULU ────────────────────────
 *
 * Le glisser-déposer pour la souris, les flèches pour le doigt. Une
 * poignée de glissement sur un téléphone se dispute le geste avec le
 * défilement de la page ; les boutiques règlent souvent leurs
 * documents depuis un téléphone.
 */

interface Props {
  reglages: ReglagesDocuments;
  type: TypeDocumentV3;
  onChange: (pages: MisesEnPage) => void;
}

export const EditeurMiseEnPage: React.FC<Props> = ({ reglages, type, onChange }) => {
  const [glisse, setGlisse] = useState<{ zone: Zone; cle: string } | null>(null);

  const page = reglages.pages[type];
  const ouvert = page !== undefined;
  const resolue = resoudreMiseEnPage(reglages, type);

  const poser = (suite: MiseEnPage | undefined) => {
    const pages = { ...reglages.pages };
    if (suite === undefined) delete pages[type];
    else pages[type] = suite;
    onChange(pages);
  };

  const changer = (cle: string, patch: { visible?: boolean; libelle?: string }) =>
    poser({ ...page, [cle]: { ...page?.[cle], ...patch } });

  /** Écrit le rang de TOUS les éléments de la zone, jamais d'un seul. */
  const reordonner = (zone: Zone, cles: string[]) => {
    const suite: MiseEnPage = { ...page };
    cles.forEach((cle, rang) => {
      suite[cle] = { ...suite[cle], ordre: rang };
    });
    poser(suite);
  };

  const clesDe = (zone: Zone) => {
    const dansLaZone = new Set(elementsDe(zone, type).map((e) => e.cle));
    return resolue.elements.filter((e) => dansLaZone.has(e.cle)).map((e) => e.cle);
  };

  const deplacer = (zone: Zone, cle: string, pas: number) => {
    const cles = clesDe(zone);
    const i = cles.indexOf(cle);
    const cible = i + pas;
    if (i < 0 || cible < 0 || cible >= cles.length) return;
    const suite = [...cles];
    [suite[i], suite[cible]] = [suite[cible], suite[i]];
    reordonner(zone, suite);
  };

  const deposer = (zone: Zone, sur: string) => {
    if (!glisse || glisse.zone !== zone || glisse.cle === sur) return;
    const cles = clesDe(zone);
    const depart = cles.indexOf(glisse.cle);
    const arrivee = cles.indexOf(sur);
    if (depart < 0 || arrivee < 0) return;
    const suite = [...cles];
    suite.splice(arrivee, 0, ...suite.splice(depart, 1));
    reordonner(zone, suite);
    setGlisse(null);
  };

  if (!ouvert) {
    return (
      <SettingsBlock>
        <p className="text-sm text-foreground">
          {DEFAUTS_TYPE[type].libelle} affiche ce que le modèle prévoit. L&apos;éditeur permet de
          masquer un élément, de le renommer ou de le déplacer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => poser({})} className="app-btn-secondary">
            <LayoutTemplate className="h-4 w-4" />
            Personnaliser la mise en page
          </button>
          <button
            type="button"
            onClick={() => poser(prereglage("minimal", type))}
            className="app-btn-secondary"
          >
            Préréglage minimal
          </button>
          <button
            type="button"
            onClick={() => poser(prereglage("complet", type))}
            className="app-btn-secondary"
          >
            Préréglage complet
          </button>
        </div>
      </SettingsBlock>
    );
  }

  return (
    <>
      <SettingsBlock className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => poser(prereglage("minimal", type))}
            className="app-btn-secondary"
          >
            Minimal
          </button>
          <button
            type="button"
            onClick={() => poser(prereglage("complet", type))}
            className="app-btn-secondary"
          >
            Complet
          </button>
        </div>
        <button type="button" onClick={() => poser(undefined)} className="app-btn-secondary">
          <RotateCcw className="h-4 w-4" />
          Revenir au modèle par défaut
        </button>
      </SettingsBlock>

      {ZONES.map((zone) => {
        const cles = clesDe(zone.cle);
        if (cles.length === 0) return null;
        const parCle = new Map(resolue.elements.map((e) => [e.cle, e]));

        return (
          <SettingsBlock key={zone.cle}>
            <p className="text-sm font-semibold text-foreground">{zone.nom}</p>
            <p className="mb-3 mt-0.5 text-xs leading-relaxed text-muted-foreground">{zone.note}</p>

            <ul className="space-y-1.5">
              {cles.map((cle, i) => {
                const e = parCle.get(cle);
                if (!e) return null;
                const catalogue = elementsDe(zone.cle, type).find((c) => c.cle === cle);
                const libellable = catalogue?.libelleParDefaut !== undefined;
                // « Adresse » existe dans l'en-tête ET chez le client :
                // sans sa zone, le nom lu à voix haute ne désigne rien.
                const designe = `${e.nom} — ${zone.nom}`;

                return (
                  <li
                    key={cle}
                    draggable
                    onDragStart={() => setGlisse({ zone: zone.cle, cle })}
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={() => deposer(zone.cle, cle)}
                    onDragEnd={() => setGlisse(null)}
                    className={`rounded-xl border border-border bg-card p-2.5 ${
                      glisse?.cle === cle ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 hidden shrink-0 cursor-grab text-muted-foreground sm:block"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{e.nom}</span>
                          {e.verrouille && (
                            <Lock
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-label="Obligatoire"
                            />
                          )}
                        </div>
                        {(e.note || e.verrouille) && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {e.verrouille
                              ? `Obligatoire sur ce document. ${e.note ?? ""}`.trim()
                              : e.note}
                          </p>
                        )}
                        {libellable && e.visible && (
                          <input
                            type="text"
                            value={e.libelle}
                            onChange={(ev) => changer(cle, { libelle: ev.target.value })}
                            className="app-field mt-2"
                            aria-label={`Libellé de « ${designe} »`}
                            placeholder={catalogue?.libelleParDefaut}
                          />
                        )}
                      </div>

                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          onClick={() => deplacer(zone.cle, cle, -1)}
                          disabled={i === 0}
                          className="app-btn-icon h-9 w-9 disabled:opacity-30"
                          aria-label={`Monter ${designe}`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deplacer(zone.cle, cle, 1)}
                          disabled={i === cles.length - 1}
                          className="app-btn-icon h-9 w-9 disabled:opacity-30"
                          aria-label={`Descendre ${designe}`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <SettingsToggle
                          checked={e.visible}
                          disabled={e.verrouille}
                          onChange={(v) => changer(cle, { visible: v })}
                          label={`Afficher ${designe}`}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SettingsBlock>
        );
      })}
    </>
  );
};
