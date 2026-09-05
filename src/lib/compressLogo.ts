/**
 * Réduction du logo de boutique avant enregistrement.
 *
 * Le logo est stocké en base64 dans la colonne `logo_url` de `stores`.
 * Ce choix évite un compartiment de stockage et ses règles d'accès, mais
 * il a un prix : l'image voyage dans chaque écriture de la boutique et
 * revient à chaque chargement de l'application. Or un cliché pris au
 * téléphone pèse plusieurs mégaoctets, et le base64 ajoute encore un
 * tiers. Sur une connexion mobile malgache, cela se compte en dizaines
 * de secondes.
 *
 * Le logo n'est jamais affiché au-delà de 80 pixels de côté — vignette de
 * la barre latérale, en-tête de reçu, aperçu des paramètres. Le réduire à
 * 256 pixels laisse donc une marge confortable, y compris sur un écran à
 * forte densité, pour un poids sans commune mesure.
 */

/** Côté maximal du logo enregistré, en pixels. */
const TAILLE_MAX = 256;

/** Qualité de compression, entre 0 et 1. */
const QUALITE = 0.85;

export interface LogoCompresse {
  /** Image réduite, prête à être stockée. */
  dataUrl: string;
  /** Poids du fichier d'origine, en octets. */
  tailleOrigine: number;
  /** Poids après réduction, en octets (approché depuis le base64). */
  tailleFinale: number;
}

/** Poids réel des octets encodés dans une data URL base64. */
const poidsDataUrl = (dataUrl: string): number => {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bourrage = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - bourrage);
};

const lireFichier = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Le fichier n'a pas pu être lu."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

const chargerImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Ce fichier n'est pas une image lisible."));
    img.onload = () => resolve(img);
    img.src = src;
  });

/**
 * Réduit une image à `TAILLE_MAX` de côté au plus, en conservant ses
 * proportions — un logo étiré serait pire que lourd.
 *
 * Le WebP est tenté en premier : il pèse nettement moins que le PNG à
 * qualité égale et garde la transparence, indispensable à un logo. Les
 * navigateurs qui ne le produisent pas renvoient silencieusement un PNG ;
 * on le détecte au préfixe de la data URL plutôt que de le supposer.
 */
export async function compressLogo(file: File): Promise<LogoCompresse> {
  const original = await lireFichier(file);
  const img = await chargerImage(original);

  const cote = Math.max(img.naturalWidth, img.naturalHeight);
  const ratio = cote > TAILLE_MAX ? TAILLE_MAX / cote : 1;
  const largeur = Math.max(1, Math.round(img.naturalWidth * ratio));
  const hauteur = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur n'a pas pu préparer l'image.");
  ctx.drawImage(img, 0, 0, largeur, hauteur);

  const webp = canvas.toDataURL("image/webp", QUALITE);
  const dataUrl = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");

  // Cas limite : une petite icône déjà bien compressée peut ressortir plus
  // lourde après réencodage. On garde alors l'original, qui est meilleur.
  const tailleFinale = poidsDataUrl(dataUrl);
  if (tailleFinale >= file.size && ratio === 1) {
    return { dataUrl: original, tailleOrigine: file.size, tailleFinale: file.size };
  }

  return { dataUrl, tailleOrigine: file.size, tailleFinale };
}

/** Poids lisible par un humain : « 2,4 Mo », « 31 Ko ». */
export function formatPoids(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
