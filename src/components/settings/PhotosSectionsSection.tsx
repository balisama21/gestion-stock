import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, LayoutPanelTop, Trash2 } from "lucide-react";
import { SettingsFeedback, SettingsSection } from "./primitives";
import {
  PHOTOS_SECTIONS,
  SECTIONS,
  photoDeSection,
  sourcePhoto,
  type ChoixSection,
  type CleSection,
  type Photo,
} from "../../features/dashboard-v2/assets/images";
import {
  CHOIX_PAR_DEFAUT,
  type PhotoSectionImportee,
  ajouterPhotosSection,
  enPhotoSection,
  enregistrerChoixSection,
  lireChoixSections,
  lirePhotosSections,
  supprimerPhotoSection,
} from "../../features/dashboard-v2/lib/photosSections";

/**
 * Les photos des bannières de section (Opérations, Ventes, L'argent,
 * Stock, Fournisseurs), pour le créateur de la plateforme seulement :
 * elles valent pour toutes les boutiques.
 *
 * Pour chaque section : les photos livrées et importées, l'import et la
 * suppression, et le mode — « Auto », la photo change chaque jour dans
 * la série ; « Manuel », la photo choisie reste affichée.
 *
 * La base refuse de toute façon l'écriture à quiconque n'est pas super
 * admin : masquer l'onglet n'est que la politesse de ne pas montrer une
 * porte fermée.
 */

export const PhotosSectionsSection: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoSectionImportee[] | null>(null);
  const [choix, setChoix] = useState<Record<CleSection, ChoixSection> | null>(null);
  const [occupe, setOccupe] = useState<CleSection | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [succes, setSucces] = useState<string | null>(null);
  const entree = useRef<HTMLInputElement>(null);
  const [cible, setCible] = useState<CleSection | null>(null);

  const recharger = useCallback(async () => {
    const [p, c] = await Promise.all([lirePhotosSections(), lireChoixSections()]);
    setPhotos(p.photos);
    setChoix(c.choix);
    const e = p.error ?? c.error;
    if (e)
      setErreurs([
        /schema cache|does not exist|photos_sections|reglages_photos_sections/.test(e)
          ? "La gestion des photos de section n'est pas encore activée en base : il reste à appliquer la migration 20261011140000_photos_sections. Les photos livrées s'affichent déjà, en mode Auto."
          : e,
      ]);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const importees = (s: CleSection) => (photos ?? []).filter((p) => p.section === s);

  const agir = async (s: CleSection, action: () => Promise<string[]>, message: string) => {
    setOccupe(s);
    setErreurs([]);
    setSucces(null);
    const errs = await action();
    await recharger();
    setOccupe(null);
    setErreurs(errs);
    if (errs.length === 0) {
      setSucces(message);
      window.setTimeout(() => setSucces(null), 3000);
    }
  };

  const importer = (s: CleSection, fichiers: File[]) => {
    if (fichiers.length === 0) return;
    const deja = importees(s);
    const depart = deja.length ? Math.max(...deja.map((p) => p.position)) + 1 : 0;
    void agir(
      s,
      () => ajouterPhotosSection(s, fichiers, depart),
      fichiers.length > 1 ? `${fichiers.length} photos ajoutées.` : "Photo ajoutée.",
    );
  };

  const choisir = (s: CleSection, c: ChoixSection) =>
    void agir(
      s,
      async () => {
        const e = await enregistrerChoixSection(s, c);
        return e ? [e] : [];
      },
      "Choix enregistré.",
    );

  const supprimer = (p: PhotoSectionImportee) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    void agir(
      p.section,
      async () => {
        const e = await supprimerPhotoSection(p);
        const c = choix?.[p.section];
        // La photo fixée en manuel disparaît : la section repasse en auto.
        if (!e && c?.mode === "manuel" && c.photoId === p.id)
          await enregistrerChoixSection(p.section, CHOIX_PAR_DEFAUT);
        return e ? [e] : [];
      },
      "Photo supprimée.",
    );
  };

  const aujourdhui = new Date();

  return (
    <SettingsSection
      title="Photos des sections"
      icon={<LayoutPanelTop className="h-4 w-4" />}
      description="Les bannières entre les cartes du tableau de bord, pour toutes les boutiques. Visible par vous seul."
    >
      <input
        ref={entree}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          if (cible) importer(cible, Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        <p className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground">
          Chaque section a sa série de photos. En mode{" "}
          <strong className="text-foreground">Auto</strong>, la photo change chaque jour et la série
          recommence une fois parcourue. En mode <strong className="text-foreground">Manuel</strong>
          , cliquez sur une photo pour la fixer. Choisissez de préférence des photos en paysage :
          elles sont recadrées et allégées avant l&apos;envoi.
        </p>

        {erreurs.length > 0 && (
          <SettingsFeedback type="error">
            {erreurs.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </SettingsFeedback>
        )}
        {succes && <SettingsFeedback type="success">{succes}</SettingsFeedback>}

        {SECTIONS.map(({ cle, nom }) => {
          const c = choix?.[cle] ?? CHOIX_PAR_DEFAUT;
          const ajoutees = importees(cle);
          const serie: Photo[] = [...PHOTOS_SECTIONS[cle], ...ajoutees.map(enPhotoSection)];
          const affichee = photoDeSection(cle, aujourdhui, ajoutees.map(enPhotoSection), c);
          const manuel = c.mode === "manuel";
          return (
            <div key={cle} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{nom}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {serie.length} photos ({PHOTOS_SECTIONS[cle].length} livrées
                    {ajoutees.length > 0 ? `, ${ajoutees.length} ajoutées` : ""})
                  </p>
                </div>
                <button
                  type="button"
                  className="app-btn-primary"
                  onClick={() => {
                    setCible(cle);
                    entree.current?.click();
                  }}
                  disabled={occupe !== null || photos === null}
                >
                  <ImagePlus className="h-4 w-4" />
                  {occupe === cle ? "Envoi…" : "Importer des photos"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Mode — ${nom}`}>
                {(
                  [
                    ["auto", "Auto", "la photo change chaque jour"],
                    ["manuel", "Manuel", "la photo choisie reste affichée"],
                  ] as const
                ).map(([mode, titre, detail]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={c.mode === mode}
                    disabled={occupe !== null || choix === null}
                    onClick={() =>
                      choisir(cle, {
                        mode,
                        photoId: mode === "manuel" ? (c.photoId ?? affichee.id) : null,
                      })
                    }
                    className={`rounded-lg border px-3 py-1.5 text-left text-sm ${
                      c.mode === mode
                        ? "border-success-border bg-success-soft t-success font-medium"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {titre}
                    <span className="block text-xs font-normal opacity-80">{detail}</span>
                  </button>
                ))}
              </div>

              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {serie.map((p, i) => {
                  const importee = ajoutees.find((a) => a.id === p.id);
                  const estAffichee = p.id === affichee.id;
                  return (
                    <li
                      key={p.id}
                      className={`overflow-hidden rounded-lg border ${
                        estAffichee
                          ? "border-success-border ring-2 ring-success-border"
                          : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        className="relative block aspect-[16/7] w-full bg-muted disabled:cursor-default"
                        disabled={!manuel || occupe !== null}
                        onClick={() => choisir(cle, { mode: "manuel", photoId: p.id })}
                        aria-label={manuel ? `Fixer la photo ${i + 1}` : `Photo ${i + 1}`}
                        title={manuel ? "Fixer cette photo" : undefined}
                      >
                        <img
                          src={sourcePhoto(p, 480)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={{ objectPosition: p.cadrage }}
                        />
                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                          {i + 1}
                        </span>
                        {estAffichee && (
                          <span className="absolute right-1 top-1 flex items-center gap-1 rounded bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                            <Check className="h-3 w-3" />
                            {manuel ? "Fixée" : "Aujourd'hui"}
                          </span>
                        )}
                      </button>
                      {importee && (
                        <div className="flex justify-end p-1">
                          <button
                            type="button"
                            className="app-btn-icon h-8 w-8"
                            onClick={() => supprimer(importee)}
                            disabled={occupe !== null}
                            aria-label="Supprimer la photo"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
};
