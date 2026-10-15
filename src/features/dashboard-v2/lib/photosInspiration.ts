import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { PHOTOS_PLANTES } from "../assets/images";

/**
 * LES PHOTOS DE « INSPIRATION DU MOMENT »
 *
 * Choisies par l'administrateur de la plateforme dans Paramètres →
 * Inspiration du moment, rangées dans la table `photos_inspiration` et
 * le seau public `inspiration`. Une seule liste pour toutes les
 * boutiques.
 *
 * Tant qu'aucune photo n'a été importée — ou si la lecture échoue — le
 * tableau de bord garde les photos livrées avec l'application : la carte
 * n'est jamais vide.
 */

const SEAU = "inspiration";

/** Le format des cadres du tableau de bord : un portrait 400 × 580. */
const LARGEUR = 800;
const HAUTEUR = 1160;

/** La même limite que celle posée sur le seau. */
const TAILLE_MAX = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface PhotoInspiration {
  id: string;
  chemin: string;
  position: number;
  url: string;
}

export const adressePhoto = (chemin: string): string =>
  supabase.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl;

export async function lirePhotos(): Promise<{
  photos: PhotoInspiration[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("photos_inspiration")
    .select("id, chemin, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { photos: [], error: error.message };
  return {
    photos: (data ?? []).map((p) => ({ ...p, url: adressePhoto(p.chemin) })),
    error: null,
  };
}

const chargerImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Cette image n'a pas pu être lue."));
    img.src = src;
  });

/**
 * Recadre la photo au format des cadres, sur son centre, et la réduit.
 * Une photo de téléphone de plusieurs mégaoctets devient un WebP d'une
 * centaine de kilo-octets, qui s'affiche net sur un écran dense.
 */
export async function preparerPhoto(fichier: File): Promise<File> {
  const source = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(source);
    const ratio = LARGEUR / HAUTEUR;
    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sw / sh > ratio) sw = sh * ratio;
    else sh = sw / ratio;
    const echelle = Math.min(1, HAUTEUR / sh);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * echelle));
    canvas.height = Math.max(1, Math.round(sh * echelle));
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(
      img,
      (img.naturalWidth - sw) / 2,
      (img.naturalHeight - sh) / 2,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const ecrire = (type: string) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
    let blob = await ecrire("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await ecrire("image/jpeg");
    if (!blob) return fichier;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `inspiration.${ext}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(source);
  }
}

const identifiant = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Prépare et envoie un fichier ; rend son chemin dans le seau. */
async function envoyer(fichier: File): Promise<{ chemin: string | null; error: string | null }> {
  if (!TYPES.includes(fichier.type)) {
    return { chemin: null, error: `${fichier.name} : seules les images JPEG, PNG ou WebP.` };
  }
  let pret: File;
  try {
    pret = await preparerPhoto(fichier);
  } catch {
    return { chemin: null, error: `${fichier.name} : cette image n'a pas pu être lue.` };
  }
  if (pret.size > TAILLE_MAX) {
    return { chemin: null, error: `${fichier.name} : plus de 3 Mo, même après réduction.` };
  }
  const chemin = `photos/${identifiant()}.${pret.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await supabase.storage
    .from(SEAU)
    .upload(chemin, pret, { contentType: pret.type, upsert: false });
  if (error) return { chemin: null, error: `${fichier.name} : ${error.message}` };
  return { chemin, error: null };
}

/** Ajoute des photos à la fin de la liste, dans l'ordre choisi. */
export async function ajouterPhotos(
  fichiers: File[],
  positionDepart: number,
): Promise<{ erreurs: string[] }> {
  const erreurs: string[] = [];
  let position = positionDepart;
  for (const f of fichiers) {
    const { chemin, error } = await envoyer(f);
    if (!chemin) {
      erreurs.push(error ?? f.name);
      continue;
    }
    const { error: e } = await supabase.from("photos_inspiration").insert({ chemin, position });
    if (e) {
      // La ligne n'a pas pu être écrite : on ne laisse pas un fichier orphelin.
      await supabase.storage.from(SEAU).remove([chemin]);
      erreurs.push(`${f.name} : ${e.message}`);
      continue;
    }
    position += 1;
  }
  return { erreurs };
}

/** Remplace le fichier d'une photo, à la même place dans la liste. */
export async function remplacerPhoto(
  photo: PhotoInspiration,
  fichier: File,
): Promise<{ error: string | null }> {
  const { chemin, error } = await envoyer(fichier);
  if (!chemin) return { error };
  const { error: e } = await supabase
    .from("photos_inspiration")
    .update({ chemin })
    .eq("id", photo.id);
  if (e) {
    await supabase.storage.from(SEAU).remove([chemin]);
    return { error: e.message };
  }
  await supabase.storage.from(SEAU).remove([photo.chemin]);
  return { error: null };
}

export async function supprimerPhoto(photo: PhotoInspiration): Promise<{ error: string | null }> {
  const { error } = await supabase.from("photos_inspiration").delete().eq("id", photo.id);
  if (error) return { error: error.message };
  await supabase.storage.from(SEAU).remove([photo.chemin]);
  return { error: null };
}

/** Réécrit les positions dans l'ordre donné : 0, 1, 2… */
export async function enregistrerOrdre(
  photos: PhotoInspiration[],
): Promise<{ error: string | null }> {
  const changees = photos
    .map((p, position) => ({ p, position }))
    .filter(({ p, position }) => p.position !== position);
  for (const { p, position } of changees) {
    const { error } = await supabase.from("photos_inspiration").update({ position }).eq("id", p.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ─── Pour le tableau de bord ──────────────────────────────────────────

const CLE_CACHE = "tantana.inspiration";

const lireCache = (): string[] | null => {
  try {
    const brut = window.localStorage.getItem(CLE_CACHE);
    const liste = brut ? (JSON.parse(brut) as unknown) : null;
    return Array.isArray(liste) && liste.length > 0 ? (liste as string[]) : null;
  } catch {
    return null;
  }
};

/**
 * Les adresses des photos à faire tourner.
 *
 * La dernière liste connue est gardée dans ce navigateur : au retour sur
 * le tableau de bord, les photos s'affichent tout de suite, sans passer
 * une seconde par celles d'origine.
 */
export function usePhotosInspiration(): string[] {
  const [photos, setPhotos] = useState<string[]>(PHOTOS_PLANTES);

  useEffect(() => {
    let actif = true;
    const cache = lireCache();
    if (cache) setPhotos(cache);
    void lirePhotos().then(({ photos: lues, error }) => {
      if (!actif || error) return;
      const urls = lues.map((p) => p.url);
      setPhotos(urls.length > 0 ? urls : PHOTOS_PLANTES);
      try {
        if (urls.length > 0) window.localStorage.setItem(CLE_CACHE, JSON.stringify(urls));
        else window.localStorage.removeItem(CLE_CACHE);
      } catch {
        /* Navigation privée : pas de cache, rien d'autre ne change. */
      }
    });
    return () => {
      actif = false;
    };
  }, []);

  return photos;
}
