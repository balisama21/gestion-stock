import { supabase } from "./supabase";

/**
 * L'envoi et la lecture des fichiers, dans Supabase Storage.
 *
 * Jusqu'ici l'application ne stockait aucun fichier : le logo de la
 * boutique vit en base64 dans une colonne, il repart donc entièrement à
 * chaque chargement, et il a fallu le réduire à 256 pixels pour que ce
 * soit supportable. Une photo de produit ne peut pas suivre ce chemin.
 *
 * Deux seaux, deux régimes :
 *
 *   • `produits` est public en lecture — une photo de catalogue est
 *     faite pour être vue, et son adresse est directe.
 *   • `documents` est privé — un justificatif ne se lit que par un lien
 *     signé, valable une heure.
 *
 * Le chemin porte la sécurité : tout fichier vit sous `<boutique>/…`, et
 * la politique posée sur le stockage compare ce premier dossier à
 * l'appartenance de celui qui écrit. Ce n'est donc pas une convention de
 * rangement, c'est la frontière entre deux entreprises — il ne faut pas
 * la contourner en construisant un chemin à la main ailleurs.
 */

export type Seau = "produits" | "documents";

/** Ce que le navigateur accepte d'envoyer, par seau. */
const TYPES_ACCEPTES: Record<Seau, string[]> = {
  produits: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  documents: ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"],
};

/** La même limite que celle posée sur le seau, en octets. */
const TAILLE_MAX: Record<Seau, number> = {
  produits: 5 * 1024 * 1024,
  documents: 10 * 1024 * 1024,
};

/** Côté maximal d'une image de produit, avant envoi. */
const COTE_MAX_IMAGE = 1280;
const QUALITE = 0.82;

export interface ResultatEnvoi {
  chemin: string | null;
  error: string | null;
}

const extension = (fichier: File): string => {
  const parType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "application/pdf": "pdf",
  };
  return parType[fichier.type] ?? (fichier.name.split(".").pop() || "bin").toLowerCase();
};

const identifiant = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const chargerImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Cette image n'a pas pu être lue."));
    img.src = src;
  });

/**
 * Réduit une photo avant l'envoi.
 *
 * Un cliché de téléphone pèse couramment quatre mégaoctets pour 4000
 * pixels de côté, alors qu'il ne sera jamais affiché au-delà de 1280.
 * L'envoyer tel quel ferait payer à l'utilisateur — souvent en données
 * mobiles — vingt fois ce qui est utile.
 *
 * Le format d'origine est conservé : convertir un PNG à fond transparent
 * en JPEG lui donnerait un fond noir.
 */
export async function reduireImage(fichier: File): Promise<File> {
  if (!fichier.type.startsWith("image/") || fichier.type === "image/avif") return fichier;

  const source = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(source);
    const cote = Math.max(img.naturalWidth, img.naturalHeight);
    if (cote <= COTE_MAX_IMAGE) return fichier;

    const ratio = COTE_MAX_IMAGE / cote;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const type = fichier.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, QUALITE));
    if (!blob || blob.size >= fichier.size) return fichier;

    return new File([blob], fichier.name, { type });
  } catch {
    // Une image illisible par le navigateur part telle quelle : le
    // stockage la refusera peut-être, mais ce refus-là sera explicite.
    return fichier;
  } finally {
    URL.revokeObjectURL(source);
  }
}

/**
 * Envoie un fichier et rend son chemin.
 *
 * `dossier` range à l'intérieur de la boutique — « produits/<id> »,
 * « depenses », « avatars ». Le nom final est tiré au sort : deux
 * photos appelées `IMG_0001.jpg` ne doivent pas s'écraser l'une
 * l'autre.
 */
export async function envoyerFichier(
  seau: Seau,
  storeId: string,
  dossier: string,
  fichier: File,
): Promise<ResultatEnvoi> {
  if (!storeId) return { chemin: null, error: "Aucune boutique active." };

  if (!TYPES_ACCEPTES[seau].includes(fichier.type)) {
    return {
      chemin: null,
      error:
        seau === "produits"
          ? "Seules les images JPEG, PNG, WebP ou AVIF sont acceptées."
          : "Seules les images et les fichiers PDF sont acceptés.",
    };
  }

  const aEnvoyer = seau === "produits" ? await reduireImage(fichier) : fichier;

  if (aEnvoyer.size > TAILLE_MAX[seau]) {
    const mo = Math.round(TAILLE_MAX[seau] / (1024 * 1024));
    return { chemin: null, error: `Ce fichier dépasse ${mo} Mo, même après réduction.` };
  }

  const chemin = `${storeId}/${dossier}/${identifiant()}.${extension(aEnvoyer)}`;
  const { error } = await supabase.storage.from(seau).upload(chemin, aEnvoyer, {
    contentType: aEnvoyer.type,
    upsert: false,
  });

  if (error) return { chemin: null, error: error.message };
  return { chemin, error: null };
}

/** Retire un fichier. Sans effet s'il a déjà disparu. */
export async function supprimerFichier(
  seau: Seau,
  chemin: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from(seau).remove([chemin]);
  return { error: error?.message ?? null };
}

/**
 * L'adresse d'une image de produit.
 *
 * Le seau étant public en lecture, l'adresse est directe et ne périme
 * pas : elle peut donc être mise en cache par le navigateur, ce qui
 * compte pour une grille de catalogue.
 */
export function adresseImageProduit(chemin: string): string {
  return supabase.storage.from("produits").getPublicUrl(chemin).data.publicUrl;
}

/**
 * Une adresse temporaire pour un document privé.
 *
 * Une heure : assez pour ouvrir un justificatif ou le télécharger, trop
 * peu pour qu'un lien recopié dans un message reste utilisable
 * longtemps.
 */
export async function adresseDocument(
  chemin: string,
  secondes = 3600,
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(chemin, secondes);
  return { url: data?.signedUrl ?? null, error: error?.message ?? null };
}
