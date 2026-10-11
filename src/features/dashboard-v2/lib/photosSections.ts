import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  SECTIONS,
  type ChoixSection,
  type CleSection,
  type ModeSection,
  type Photo,
} from "../assets/images";
import { SEAU, adresse, envoyerPhoto } from "./photosHautDePage";

/**
 * LES PHOTOS DES BANNIÈRES DE SECTION, GÉRÉES PAR LE CRÉATEUR
 *
 * Les photos importées vivent dans `photos_sections` (fichiers dans le
 * seau `haut-de-page`, sous `sections/`), le mode de chaque section dans
 * `reglages_photos_sections` : « auto » (la photo change chaque jour) ou
 * « manuel » (une photo choisie reste affichée).
 *
 * Lecture : tout utilisateur connecté. Écriture : super admin seulement
 * (RLS). Si la lecture échoue, chaque section garde ses photos livrées,
 * en mode auto.
 */

export interface PhotoSectionImportee {
  id: string;
  section: CleSection;
  chemin: string;
  position: number;
  url: string;
}

const vide = <T>(f: () => T): Record<CleSection, T> =>
  Object.fromEntries(SECTIONS.map((s) => [s.cle, f()])) as Record<CleSection, T>;

export const CHOIX_PAR_DEFAUT: ChoixSection = { mode: "auto", photoId: null };

export async function lirePhotosSections(): Promise<{
  photos: PhotoSectionImportee[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("photos_sections")
    .select("id, section, chemin, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { photos: [], error: error.message };
  return {
    photos: ((data ?? []) as Omit<PhotoSectionImportee, "url">[]).map((p) => ({
      ...p,
      url: adresse(p.chemin),
    })),
    error: null,
  };
}

export async function lireChoixSections(): Promise<{
  choix: Record<CleSection, ChoixSection>;
  error: string | null;
}> {
  const choix = vide(() => ({ ...CHOIX_PAR_DEFAUT }));
  const { data, error } = await supabase
    .from("reglages_photos_sections")
    .select("section, mode, photo_id");
  if (error) return { choix, error: error.message };
  for (const l of (data ?? []) as {
    section: CleSection;
    mode: ModeSection;
    photo_id: string | null;
  }[]) {
    if (l.section in choix) choix[l.section] = { mode: l.mode, photoId: l.photo_id };
  }
  return { choix, error: null };
}

/** Une photo importée, sous la forme qu'attend la bannière. */
export const enPhotoSection = (p: PhotoSectionImportee): Photo => ({
  id: p.id,
  cadrage: "50% 50%",
  url: p.url,
});

export const parSection = (photos: PhotoSectionImportee[]): Record<CleSection, Photo[]> => {
  const out = vide<Photo[]>(() => []);
  for (const p of photos) if (p.section in out) out[p.section].push(enPhotoSection(p));
  return out;
};

/** Ajoute des photos à la fin de la série d'une section. */
export async function ajouterPhotosSection(
  section: CleSection,
  fichiers: File[],
  positionDepart: number,
): Promise<string[]> {
  const erreurs: string[] = [];
  let position = positionDepart;
  for (const f of fichiers) {
    const { chemin, error } = await envoyerPhoto(f, `sections/${section}`);
    if (!chemin) {
      erreurs.push(error ?? f.name);
      continue;
    }
    const { error: e } = await supabase
      .from("photos_sections")
      .insert({ section, chemin, position });
    if (e) {
      // La ligne n'a pas pu être écrite : on ne laisse pas un fichier orphelin.
      await supabase.storage.from(SEAU).remove([chemin]);
      erreurs.push(`${f.name} : ${e.message}`);
      continue;
    }
    position += 1;
  }
  return erreurs;
}

export async function supprimerPhotoSection(photo: PhotoSectionImportee): Promise<string | null> {
  const { error } = await supabase.from("photos_sections").delete().eq("id", photo.id);
  if (error) return error.message;
  await supabase.storage.from(SEAU).remove([photo.chemin]);
  return null;
}

/** Le mode d'une section, et en manuel la photo choisie. */
export async function enregistrerChoixSection(
  section: CleSection,
  choix: ChoixSection,
): Promise<string | null> {
  const { error } = await supabase.from("reglages_photos_sections").upsert({
    section,
    mode: choix.mode,
    photo_id: choix.mode === "manuel" ? choix.photoId : null,
    updated_at: new Date().toISOString(),
  });
  return error ? error.message : null;
}

// ─── Pour le tableau de bord ──────────────────────────────────────────

const CLE_CACHE = "tantana.photos-sections";

interface EtatSections {
  ajoutees: Record<CleSection, Photo[]>;
  choix: Record<CleSection, ChoixSection>;
}

/**
 * Les photos importées et le mode de chaque section, pour les bannières.
 * La dernière lecture est gardée dans ce navigateur : au retour sur le
 * tableau de bord, la bonne photo s'affiche tout de suite.
 */
export function usePhotosSections(): EtatSections {
  const [etat, setEtat] = useState<EtatSections>(() => ({
    ajoutees: vide<Photo[]>(() => []),
    choix: vide(() => ({ ...CHOIX_PAR_DEFAUT })),
  }));

  useEffect(() => {
    let actif = true;
    try {
      const brut = window.localStorage.getItem(CLE_CACHE);
      if (brut) setEtat(JSON.parse(brut) as EtatSections);
    } catch {
      /* Cache illisible : on attend la base. */
    }
    void Promise.all([lirePhotosSections(), lireChoixSections()]).then(([p, c]) => {
      if (!actif || p.error || c.error) return;
      const frais: EtatSections = { ajoutees: parSection(p.photos), choix: c.choix };
      setEtat(frais);
      try {
        window.localStorage.setItem(CLE_CACHE, JSON.stringify(frais));
      } catch {
        /* Navigation privée : pas de cache. */
      }
    });
    return () => {
      actif = false;
    };
  }, []);

  return etat;
}
