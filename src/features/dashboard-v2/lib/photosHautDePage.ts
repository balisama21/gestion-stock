import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Photo } from "../assets/images";

/**
 * LES PHOTOS DU HAUT DE PAGE AJOUTÉES PAR LE CRÉATEUR
 *
 * Importées dans Paramètres → Photos du haut de page, rangées dans la
 * table `photos_haut_de_page` et le seau public `haut-de-page`. Une
 * seule liste pour toutes les boutiques, une série pour le jour et une
 * pour le soir. Elles prennent la suite des trente et une photos livrées
 * de chaque série ; une fois la série parcourue, la boucle recommence.
 *
 * Lecture : tout utilisateur connecté. Écriture : super admin seulement,
 * la base le garantit (RLS). Si la lecture échoue, le tableau de bord
 * garde les photos livrées.
 */

export type MomentPhoto = "jour" | "soir";

const SEAU = "haut-de-page";

/** Une bannière large : jusqu'à 2 400 px, et pas plus haut que 3:2. */
const LARGEUR_MAX = 2400;
const RAPPORT_MIN = 3 / 2;

/** La même limite que celle posée sur le seau. */
const TAILLE_MAX = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface PhotoImportee {
  id: string;
  moment: MomentPhoto;
  chemin: string;
  position: number;
  url: string;
}

const adresse = (chemin: string): string =>
  supabase.storage.from(SEAU).getPublicUrl(chemin).data.publicUrl;

export async function lirePhotosHautDePage(): Promise<{
  photos: PhotoImportee[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("photos_haut_de_page")
    .select("id, moment, chemin, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { photos: [], error: error.message };
  return {
    photos: ((data ?? []) as Omit<PhotoImportee, "url">[]).map((p) => ({
      ...p,
      url: adresse(p.chemin),
    })),
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
 * Prépare la photo pour la bannière : une photo trop haute est recadrée
 * sur son centre au format 3:2, puis tout est réduit à 2 400 px de large
 * au plus et converti en WebP. Une photo de téléphone de plusieurs
 * mégaoctets en ressort à quelques centaines de kilo-octets.
 */
async function preparer(fichier: File): Promise<File> {
  const source = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(source);
    const sw = img.naturalWidth;
    let sh = img.naturalHeight;
    if (sw / sh < RAPPORT_MIN) sh = Math.round(sw / RAPPORT_MIN);
    const echelle = Math.min(1, LARGEUR_MAX / sw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * echelle));
    canvas.height = Math.max(1, Math.round(sh * echelle));
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(img, 0, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    const ecrire = (type: string) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.82));
    let blob = await ecrire("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await ecrire("image/jpeg");
    if (!blob) return fichier;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `haut-de-page.${ext}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(source);
  }
}

const identifiant = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Ajoute des photos à la fin d'une série, dans l'ordre choisi. */
export async function ajouterPhotosHautDePage(
  moment: MomentPhoto,
  fichiers: File[],
  positionDepart: number,
): Promise<string[]> {
  const erreurs: string[] = [];
  let position = positionDepart;
  for (const f of fichiers) {
    if (!TYPES.includes(f.type)) {
      erreurs.push(`${f.name} : seules les images JPEG, PNG ou WebP.`);
      continue;
    }
    let pret: File;
    try {
      pret = await preparer(f);
    } catch {
      erreurs.push(`${f.name} : cette image n'a pas pu être lue.`);
      continue;
    }
    if (pret.size > TAILLE_MAX) {
      erreurs.push(`${f.name} : plus de 4 Mo, même après réduction.`);
      continue;
    }
    const chemin = `${moment}/${identifiant()}.${pret.type === "image/webp" ? "webp" : "jpg"}`;
    const { error } = await supabase.storage
      .from(SEAU)
      .upload(chemin, pret, { contentType: pret.type, upsert: false });
    if (error) {
      erreurs.push(`${f.name} : ${error.message}`);
      continue;
    }
    const { error: e } = await supabase
      .from("photos_haut_de_page")
      .insert({ moment, chemin, position });
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

export async function supprimerPhotoHautDePage(photo: PhotoImportee): Promise<string | null> {
  const { error } = await supabase.from("photos_haut_de_page").delete().eq("id", photo.id);
  if (error) return error.message;
  await supabase.storage.from(SEAU).remove([photo.chemin]);
  return null;
}

/** Une photo importée, sous la forme qu'attend la bannière. */
export const enPhoto = (p: PhotoImportee): Photo => ({
  id: p.id,
  cadrage: "50% 50%",
  url: p.url,
});

/** Les photos importées, rangées par moment. */
export const parMomentPhotos = (photos: PhotoImportee[]): Record<MomentPhoto, Photo[]> => ({
  jour: photos.filter((p) => p.moment === "jour").map(enPhoto),
  soir: photos.filter((p) => p.moment === "soir").map(enPhoto),
});

// ─── Pour le tableau de bord ──────────────────────────────────────────

const CLE_CACHE = "tantana.photos-haut";
const VIDE: Record<MomentPhoto, Photo[]> = { jour: [], soir: [] };

/**
 * Les photos importées, pour la bannière. La dernière lecture est gardée
 * dans ce navigateur : au retour sur le tableau de bord, la bonne série
 * s'affiche tout de suite.
 */
export function usePhotosHautDePage(): Record<MomentPhoto, Photo[]> {
  const [photos, setPhotos] = useState(VIDE);

  useEffect(() => {
    let actif = true;
    try {
      const brut = window.localStorage.getItem(CLE_CACHE);
      if (brut) setPhotos(JSON.parse(brut) as Record<MomentPhoto, Photo[]>);
    } catch {
      /* Cache illisible : on attend la base. */
    }
    void lirePhotosHautDePage().then(({ photos: lues, error }) => {
      if (!actif || error) return;
      const frais = parMomentPhotos(lues);
      setPhotos(frais);
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

  return photos;
}
