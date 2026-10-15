import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Leaf, RefreshCw, Trash2 } from "lucide-react";
import { SettingsFeedback, SettingsSection } from "./primitives";
import { PHOTOS_PLANTES, plantesDuJour } from "../../features/dashboard-v2/assets/images";
import {
  type PhotoInspiration,
  ajouterPhotos,
  enregistrerOrdre,
  lirePhotos,
  remplacerPhoto,
  supprimerPhoto,
} from "../../features/dashboard-v2/lib/photosInspiration";

/**
 * Les photos de « Inspiration du moment », pour l'administrateur de la
 * plateforme seulement : la liste vaut pour toutes les boutiques.
 *
 * Trois photos par jour, dans l'ordre affiché ici ; une fois la liste
 * parcourue, elle recommence au début. Sans aucune photo importée, le
 * tableau de bord garde les photos livrées avec l'application.
 *
 * La base refuse de toute façon l'écriture à quiconque n'est pas super
 * admin : masquer l'onglet n'est que la politesse de ne pas montrer une
 * porte fermée.
 */
export const InspirationSection: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoInspiration[] | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [succes, setSucces] = useState<string | null>(null);
  const ajout = useRef<HTMLInputElement>(null);
  const remplacement = useRef<HTMLInputElement>(null);
  const [aRemplacer, setARemplacer] = useState<PhotoInspiration | null>(null);

  const recharger = useCallback(async () => {
    const { photos: lues, error } = await lirePhotos();
    setPhotos(lues);
    if (error) setErreurs([error]);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /** Une action à la fois : les boutons se grisent pendant l'envoi. */
  const agir = async (action: () => Promise<string[]>, message: string) => {
    setOccupe(true);
    setErreurs([]);
    setSucces(null);
    const errs = await action();
    await recharger();
    setOccupe(false);
    setErreurs(errs);
    if (errs.length === 0) {
      setSucces(message);
      window.setTimeout(() => setSucces(null), 3000);
    }
  };

  const importer = (fichiers: File[]) => {
    if (fichiers.length === 0) return;
    const fin = photos && photos.length > 0 ? Math.max(...photos.map((p) => p.position)) + 1 : 0;
    void agir(
      async () => (await ajouterPhotos(fichiers, fin)).erreurs,
      fichiers.length > 1 ? `${fichiers.length} photos ajoutées.` : "Photo ajoutée.",
    );
  };

  /**
   * Les photos livrées avec l'application, versées dans la liste comme
   * des photos importées : elles se remplacent, se suppriment et se
   * rangent ensuite comme les autres.
   */
  const reprendreOrigine = () => {
    if (
      photos &&
      photos.length > 0 &&
      !window.confirm(
        `Ajouter les ${PHOTOS_PLANTES.length} photos d'origine à la fin de la liste ? Elles s'ajoutent aux vôtres.`,
      )
    )
      return;
    const fin = photos && photos.length > 0 ? Math.max(...photos.map((p) => p.position)) + 1 : 0;
    void agir(async () => {
      const fichiers: File[] = [];
      for (const [k, url] of PHOTOS_PLANTES.entries()) {
        const blob = await (await fetch(url)).blob();
        const type = blob.type || "image/webp";
        fichiers.push(new File([blob], `origine-${k + 1}.webp`, { type }));
      }
      return (await ajouterPhotos(fichiers, fin)).erreurs;
    }, `${PHOTOS_PLANTES.length} photos d'origine ajoutées.`);
  };

  const remplacer = (photo: PhotoInspiration, fichier: File) =>
    agir(async () => {
      const { error } = await remplacerPhoto(photo, fichier);
      return error ? [error] : [];
    }, "Photo remplacée.");

  const supprimer = (photo: PhotoInspiration, numero: number) => {
    if (!window.confirm(`Supprimer la photo n° ${numero} ?`)) return;
    void agir(async () => {
      const { error } = await supprimerPhoto(photo);
      return error ? [error] : [];
    }, "Photo supprimée.");
  };

  const deplacer = (i: number, pas: -1 | 1) => {
    if (!photos) return;
    const j = i + pas;
    if (j < 0 || j >= photos.length) return;
    const suite = [...photos];
    [suite[i], suite[j]] = [suite[j], suite[i]];
    setPhotos(suite);
    void agir(async () => {
      const { error } = await enregistrerOrdre(suite);
      return error ? [error] : [];
    }, "Ordre enregistré.");
  };

  const duJour = photos
    ? plantesDuJour(
        new Date(),
        photos.map((p) => p.url),
      )
    : [];
  const jours = photos && photos.length > 0 ? Math.ceil(photos.length / 3) : 0;

  return (
    <SettingsSection
      title="Inspiration du moment"
      icon={<Leaf className="h-4 w-4" />}
      description="Les photos du tableau de bord, pour toutes les boutiques. Visible par vous seul."
      aside={
        <button
          type="button"
          onClick={() => ajout.current?.click()}
          disabled={occupe || photos === null}
          className="app-btn-primary"
        >
          <ImagePlus className="h-4 w-4" />
          {occupe ? "Envoi…" : "Importer des photos"}
        </button>
      }
    >
      <input
        ref={ajout}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          importer(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={remplacement}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && aRemplacer) void remplacer(aRemplacer, f);
          setARemplacer(null);
          e.target.value = "";
        }}
      />

      <div className="space-y-4">
        <p className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground">
          Trois photos par jour,{" "}
          <strong className="text-foreground">dans l&apos;ordre ci-dessous</strong>. Une fois toutes
          montrées, la série recommence au début
          {jours > 0 && (
            <>
              {" "}
              — ici tous les <strong className="text-foreground">{jours} jours</strong>
            </>
          )}
          . Chaque photo est recadrée en portrait et allégée avant l&apos;envoi.
          {photos !== null && photos.length === 0 && (
            <>
              {" "}
              Tant qu&apos;aucune photo n&apos;est importée, le tableau de bord utilise les photos
              d&apos;origine.
            </>
          )}
        </p>

        {erreurs.length > 0 && (
          <SettingsFeedback type="error">
            {erreurs.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </SettingsFeedback>
        )}
        {succes && <SettingsFeedback type="success">{succes}</SettingsFeedback>}

        {photos === null ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : photos.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={reprendreOrigine}
              disabled={occupe}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-success-border bg-success-soft p-8 text-sm font-medium t-success transition-colors disabled:opacity-60"
            >
              <Leaf className="h-6 w-6" />
              {occupe
                ? "Envoi des photos…"
                : `Commencer avec les ${PHOTOS_PLANTES.length} photos d'origine`}
            </button>
            <button
              type="button"
              onClick={() => ajout.current?.click()}
              disabled={occupe}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <ImagePlus className="h-6 w-6" />
              Choisissez des photos sur votre ordinateur (JPEG, PNG ou WebP)
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative aspect-[400/580] bg-muted">
                  <img
                    src={p.url}
                    alt={`Photo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  {duJour.includes(p.url) && (
                    <span className="absolute right-1.5 top-1.5 rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                      Aujourd&apos;hui
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => deplacer(i, -1)}
                      disabled={occupe || i === 0}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label={`Avancer la photo ${i + 1}`}
                      title="Avancer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(i, 1)}
                      disabled={occupe || i === photos.length - 1}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label={`Reculer la photo ${i + 1}`}
                      title="Reculer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => {
                        setARemplacer(p);
                        remplacement.current?.click();
                      }}
                      disabled={occupe}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label={`Remplacer la photo ${i + 1}`}
                      title="Remplacer"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimer(p, i + 1)}
                      disabled={occupe}
                      className="rounded-lg p-1.5 t-danger hover:bg-danger-soft disabled:opacity-30"
                      aria-label={`Supprimer la photo ${i + 1}`}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {photos !== null && photos.length > 0 && (
          <button
            type="button"
            onClick={reprendreOrigine}
            disabled={occupe}
            className="text-sm font-medium t-success hover:underline disabled:opacity-60"
          >
            Ajouter aussi les {PHOTOS_PLANTES.length} photos d&apos;origine
          </button>
        )}
      </div>
    </SettingsSection>
  );
};
