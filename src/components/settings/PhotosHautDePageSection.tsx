import React, { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Images, Moon, Sun, Trash2 } from "lucide-react";
import { SettingsFeedback, SettingsSection } from "./primitives";
import {
  HERO_PAYSAGES_JOUR,
  HERO_PAYSAGES_SOIR,
  paysagesDuMoment,
  sourcePhoto,
  type Photo,
} from "../../features/dashboard-v2/assets/images";
import {
  type MomentPhoto,
  type PhotoImportee,
  ajouterPhotosHautDePage,
  lirePhotosHautDePage,
  parMomentPhotos,
  supprimerPhotoHautDePage,
} from "../../features/dashboard-v2/lib/photosHautDePage";
import { useConfirmation } from "../../hooks/useConfirmation";

/**
 * Les photos de la grande bannière du tableau de bord, pour le créateur de
 * la plateforme seulement : elles valent pour toutes les boutiques.
 *
 * Deux séries : le jour (6 h – 18 h) et le soir (18 h – 6 h). Trente et
 * une photos livrées dans chacune ; celles importées ici prennent la
 * suite. Chaque jour, la bannière en montre cinq et avance de cinq le
 * lendemain ; une fois la série parcourue, la boucle recommence.
 *
 * La base refuse de toute façon l'écriture à quiconque n'est pas super
 * admin : masquer l'onglet n'est que la politesse de ne pas montrer une
 * porte fermée.
 */

const SERIES: {
  cle: MomentPhoto;
  nom: string;
  icone: React.ReactNode;
  livrees: Photo[];
  conseil: string;
  heure: number;
}[] = [
  {
    cle: "jour",
    nom: "Jour (6 h – 18 h)",
    icone: <Sun className="h-4 w-4" />,
    livrees: HERO_PAYSAGES_JOUR,
    conseil: "Des photos lumineuses de nature : vallées, forêt, cascades, animaux, fleurs.",
    heure: 12,
  },
  {
    cle: "soir",
    nom: "Soir (18 h – 6 h)",
    icone: <Moon className="h-4 w-4" />,
    livrees: HERO_PAYSAGES_SOIR,
    conseil:
      "De vraies photos prises au coucher du soleil ou la nuit — pas des photos de jour assombries.",
    heure: 20,
  },
];

const pgcd = (a: number, b: number): number => (b === 0 ? a : pgcd(b, a % b));

/** Combien de jours avant que la même série de cinq revienne. */
const dureeBoucle = (n: number) => (n <= 5 ? 1 : n / pgcd(n, 5));

const Vignette: React.FC<{ photo: Photo; titre: string; marque?: string }> = ({
  photo,
  titre,
  marque,
}) => (
  <div className="relative aspect-[16/7] overflow-hidden rounded-lg bg-muted">
    <img
      src={sourcePhoto(photo, 480)}
      alt={titre}
      loading="lazy"
      className="h-full w-full object-cover"
      style={{ objectPosition: photo.cadrage }}
    />
    {marque && (
      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
        {marque}
      </span>
    )}
  </div>
);

export const PhotosHautDePageSection: React.FC = () => {
  const { confirmer, modaleConfirmation } = useConfirmation();
  const [photos, setPhotos] = useState<PhotoImportee[] | null>(null);
  const [occupe, setOccupe] = useState<MomentPhoto | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [succes, setSucces] = useState<string | null>(null);
  const [voirLivrees, setVoirLivrees] = useState<MomentPhoto | null>(null);
  const entrees = {
    jour: useRef<HTMLInputElement>(null),
    soir: useRef<HTMLInputElement>(null),
  };

  const recharger = useCallback(async () => {
    const { photos: lues, error } = await lirePhotosHautDePage();
    setPhotos(lues);
    if (error)
      setErreurs([
        /schema cache|does not exist|photos_haut_de_page/.test(error)
          ? "L'import de photos n'est pas encore activé en base : il reste à appliquer la migration 20261011120000_photos_haut_de_page. Les photos livrées s'affichent déjà."
          : error,
      ]);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const importees = (m: MomentPhoto) => (photos ?? []).filter((p) => p.moment === m);

  const importer = async (m: MomentPhoto, fichiers: File[]) => {
    if (fichiers.length === 0) return;
    const deja = importees(m);
    const depart = deja.length ? Math.max(...deja.map((p) => p.position)) + 1 : 0;
    setOccupe(m);
    setErreurs([]);
    setSucces(null);
    const errs = await ajouterPhotosHautDePage(m, fichiers, depart);
    await recharger();
    setOccupe(null);
    setErreurs(errs);
    const ok = fichiers.length - errs.length;
    if (ok > 0) {
      setSucces(ok > 1 ? `${ok} photos ajoutées.` : "Photo ajoutée.");
      window.setTimeout(() => setSucces(null), 3000);
    }
  };

  const supprimer = async (p: PhotoImportee) => {
    if (!(await confirmer("Supprimer cette photo ?", { danger: true, libelle: "Supprimer" })))
      return;
    setOccupe(p.moment);
    setErreurs([]);
    const e = await supprimerPhotoHautDePage(p);
    await recharger();
    setOccupe(null);
    if (e) setErreurs([e]);
  };

  const ajoutees = parMomentPhotos(photos ?? []);
  const maintenant = new Date();

  return (
    <SettingsSection
      title="Photos du haut de page"
      icon={<Images className="h-4 w-4" />}
      description="La grande bannière du tableau de bord, pour toutes les boutiques. Visible par vous seul."
    >
      <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        <p className="rounded-xl border border-border p-3 text-sm leading-relaxed text-muted-foreground">
          Chaque jour, la bannière montre <strong className="text-foreground">cinq photos</strong>{" "}
          de la série du moment, puis avance de cinq le lendemain. Vos photos prennent la suite des
          photos livrées ; une fois la série parcourue,{" "}
          <strong className="text-foreground">la boucle recommence</strong>. Choisissez de
          préférence des photos en paysage (plus larges que hautes) : elles sont recadrées et
          allégées avant l&apos;envoi.
        </p>

        {erreurs.length > 0 && (
          <SettingsFeedback type="error">
            {erreurs.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </SettingsFeedback>
        )}
        {succes && <SettingsFeedback type="success">{succes}</SettingsFeedback>}

        {SERIES.map(({ cle, nom, icone, livrees, conseil, heure }) => {
          const total = livrees.length + ajoutees[cle].length;
          const duJour = paysagesDuMoment(
            new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), heure),
            ajoutees,
          );
          return (
            <div key={cle} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {icone}
                    {nom}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {total} photos ({livrees.length} livrées
                    {ajoutees[cle].length > 0 ? `, ${ajoutees[cle].length} ajoutées` : ""}) · la
                    boucle recommence tous les {dureeBoucle(total)} jours
                  </p>
                </div>
                <button
                  type="button"
                  className="app-btn-primary"
                  onClick={() => entrees[cle].current?.click()}
                  disabled={occupe !== null || photos === null}
                >
                  <ImagePlus className="h-4 w-4" />
                  {occupe === cle ? "Envoi…" : "Importer des photos"}
                </button>
                <input
                  ref={entrees[cle]}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    void importer(cle, Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{conseil}</p>

              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Aujourd&apos;hui
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {duJour.map((p, i) => (
                    <Vignette key={p.id} photo={p} titre={`Photo ${i + 1} du jour`} />
                  ))}
                </div>
              </div>

              {importees(cle).length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Vos photos, dans l&apos;ordre de la boucle
                  </div>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {importees(cle).map((p, i) => (
                      <li key={p.id} className="overflow-hidden rounded-lg border border-border">
                        <Vignette
                          photo={{ id: p.id, cadrage: "50% 50%", url: p.url }}
                          titre={`Photo ajoutée ${i + 1}`}
                          marque={String(livrees.length + i + 1)}
                        />
                        <div className="flex justify-end p-1">
                          <button
                            type="button"
                            className="app-btn-icon h-8 w-8"
                            onClick={() => void supprimer(p)}
                            disabled={occupe !== null}
                            aria-label="Supprimer la photo"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="text-sm font-medium t-success hover:underline"
                onClick={() => setVoirLivrees((v) => (v === cle ? null : cle))}
                aria-expanded={voirLivrees === cle}
              >
                {voirLivrees === cle
                  ? "Masquer les photos livrées"
                  : `Voir les ${livrees.length} photos livrées`}
              </button>
              {voirLivrees === cle && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {livrees.map((p, i) => (
                    <Vignette
                      key={p.id}
                      photo={p}
                      titre={`Photo livrée ${i + 1}`}
                      marque={String(i + 1)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modaleConfirmation}
    </SettingsSection>
  );
};
