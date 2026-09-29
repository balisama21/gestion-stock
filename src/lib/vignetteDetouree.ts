import { condense, cleDeNom } from "./teintes";
import { couleurDuBord, effacerFondDepuisBords } from "./detourage";

/**
 * LA VIGNETTE RONDE D'UN PRODUIT
 *
 * La miniature d'une liste pose le produit, sans son fond d'origine,
 * dans un disque d'une couleur tirée du produit lui-même : crème pour
 * une huile ambrée, gris clair pour un flacon blanc, beige doré pour un
 * savon.
 *
 * Le détourage est celui de la fiche produit (`detourage.ts`), appliqué
 * à la miniature : il réussit sur un fond uni, et laisse la photo
 * entière, recadrée dans le disque, quand le fond est trop chargé pour
 * être retiré proprement. Une photo déjà détourée garde sa transparence.
 */

export interface VignettePreparee {
  /** L'image à afficher : détourée (data URL) ou l'adresse d'origine. */
  src: string;
  /** Le fond du disque, pâle, dans la teinte dominante du produit. */
  fond: string;
  /** Faux quand le fond n'a pas pu être retiré : la photo remplit le disque. */
  detouree: boolean;
}

/** Des fonds pâles et leur encre, pour un produit dont on n'a pas lu la photo. */
const PASTELS: [fond: string, encre: string][] = [
  ["#F6EBD3", "#8A6420"], // crème
  ["#EFDDB5", "#7C5A17"], // beige doré
  ["#E8EBEE", "#4B5563"], // gris clair
  ["#DDF0E6", "#1F6B4A"], // vert d'eau
  ["#F6DDE3", "#9B3553"], // rose poudré
  ["#DDEBF6", "#2B5E8C"], // bleu glacier
  ["#E6E0F4", "#5B4796"], // lavande
  ["#F8E0CC", "#9A4E17"], // pêche
  ["#E3EBD9", "#4D6630"], // sauge
  ["#EEE6DA", "#6B5540"], // sable
  ["#D8F1EC", "#16675C"], // menthe
];

/** Le fond et l'encre d'un produit, d'après son nom : stables, jamais au hasard. */
export const pastelDe = (nom: string): { fond: string; encre: string } => {
  const [fond, encre] = PASTELS[condense(cleDeNom(nom)) % PASTELS.length];
  return { fond, encre };
};

const resolues = new Map<string, VignettePreparee | null>();
const enCours = new Map<string, Promise<VignettePreparee | null>>();

/** Le résultat déjà calculé pour cette adresse, s'il existe. */
export const vignetteConnue = (url: string): VignettePreparee | null | undefined =>
  resolues.get(url);

const COTE_MAX = 256;
const TOLERANCE = 40;
/** Le seuil le plus fin : un fond parfaitement lisse. */
const TOLERANCE_MIN = 14;

/**
 * Le fond du disque : la teinte dominante des pixels du produit,
 * éclaircie. Un histogramme de teintes pondéré par la saturation plutôt
 * qu'une moyenne : une étiquette rouge sur un flacon jaune donnerait en
 * moyenne un brun qui n'est nulle part sur le produit.
 */
export function fondDominant(d: Uint8ClampedArray): string {
  const bacs = new Float64Array(24);
  const somme = Array.from({ length: 24 }, () => [0, 0, 0]);
  let neutre = 0;
  let colore = 0;
  let pixelsColores = 0;
  let clarteNeutre = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i] / 255;
    const v = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const max = Math.max(r, v, b);
    const min = Math.min(r, v, b);
    const c = max - min;
    const l = (max + min) / 2;
    const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
    if (s < 0.18 || l < 0.08 || l > 0.96) {
      neutre++;
      clarteNeutre += l;
      continue;
    }
    let t: number;
    if (max === r) t = ((v - b) / c + 6) % 6;
    else if (max === v) t = (b - r) / c + 2;
    else t = (r - v) / c + 4;
    const bac = Math.floor((t * 60) / 15) % 24;
    bacs[bac] += s;
    somme[bac][0] += t * 60;
    somme[bac][1] += s;
    somme[bac][2]++;
    colore += s;
    pixelsColores++;
  }
  if (colore === 0 || neutre > pixelsColores * 1.5) {
    // Un produit blanc, gris ou noir : un gris clair, un rien chaud s'il est pâle.
    const pale = neutre > 0 && clarteNeutre / neutre > 0.6;
    return pale ? "hsl(40 12% 92%)" : "hsl(210 10% 91%)";
  }
  let meilleur = 0;
  for (let i = 1; i < 24; i++) if (bacs[i] > bacs[meilleur]) meilleur = i;
  const [teinte, sat, n] = somme[meilleur];
  const moyenneSat = sat / n;
  const saturation = Math.round(Math.min(58, Math.max(28, moyenneSat * 60)));
  return `hsl(${Math.round(teinte / n)} ${saturation}% 90%)`;
}

/**
 * Recadre sur le produit : un carré centré sur ses pixels visibles, pour
 * qu'il remplisse le disque au lieu d'y flotter tout petit.
 */
function recadrer(source: HTMLCanvasElement, d: Uint8ClampedArray, l: number, h: number): string {
  let x0 = l;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (d[(y * l + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return source.toDataURL("image/png");
  const cote = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  const cible = document.createElement("canvas");
  cible.width = cote;
  cible.height = cote;
  const ctx = cible.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  ctx.drawImage(
    source,
    x0,
    y0,
    x1 - x0 + 1,
    y1 - y0 + 1,
    Math.round((cote - (x1 - x0 + 1)) / 2),
    Math.round((cote - (y1 - y0 + 1)) / 2),
    x1 - x0 + 1,
    y1 - y0 + 1,
  );
  return cible.toDataURL("image/png");
}

function charger(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, echec) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => ok(img);
    img.onerror = () => echec(new Error("image"));
    img.src = url;
  });
}

async function preparer(url: string): Promise<VignettePreparee | null> {
  const img = await charger(url);
  const reduction = Math.min(1, COTE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const l = Math.max(1, Math.round(img.naturalWidth * reduction));
  const h = Math.max(1, Math.round(img.naturalHeight * reduction));
  const canvas = document.createElement("canvas");
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, l, h);
  // Lève une SecurityError quand le stockage refuse la lecture croisée.
  const image = ctx.getImageData(0, 0, l, h);
  const d = image.data;

  let bord = 0;
  let bordTransparent = 0;
  let bordProche = 0;
  const ecarts: number[] = [];
  const [r, v, b] = couleurDuBord(d, l, h);
  const compter = (x: number, y: number) => {
    const i = (y * l + x) * 4;
    bord++;
    if (d[i + 3] < 24) bordTransparent++;
    else {
      const e = Math.hypot(d[i] - r, d[i + 1] - v, d[i + 2] - b);
      if (e <= TOLERANCE) {
        bordProche++;
        ecarts.push(e);
      }
    }
  };
  for (let x = 0; x < l; x++) {
    compter(x, 0);
    compter(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    compter(0, y);
    compter(l - 1, y);
  }

  // Déjà détourée dans la fiche produit : rien à retirer.
  if (bordTransparent / bord > 0.5) {
    return { src: recadrer(canvas, d, l, h), fond: fondDominant(d), detouree: true };
  }

  // Un fond trop varié ne se retire pas proprement : la photo reste entière.
  if (bordProche / bord < 0.6) {
    return { src: url, fond: fondDominant(d), detouree: false };
  }

  // Le seuil suit le grain du fond : juste au-dessus de son bruit. Un
  // seuil fixe et large effacerait un flacon blanc posé sur du gris clair.
  ecarts.sort((a, b) => a - b);
  const bruit = ecarts[Math.floor(ecarts.length * 0.9)] ?? 0;
  const tolerance = Math.min(TOLERANCE, Math.max(TOLERANCE_MIN, bruit * 1.8 + 6));
  const efface = effacerFondDepuisBords(d, l, h, tolerance);
  const reste = 1 - efface / (l * h);
  // Tout ou presque est parti : le produit avait la couleur du fond.
  if (reste < 0.04) {
    const origine = ctx.getImageData(0, 0, l, h).data;
    return { src: url, fond: fondDominant(origine), detouree: false };
  }
  ctx.putImageData(image, 0, 0);
  return { src: recadrer(canvas, d, l, h), fond: fondDominant(d), detouree: true };
}

/**
 * Prépare la vignette d'une adresse, une seule fois par adresse : une
 * liste de deux cents produits ne relance pas deux cents détourages à
 * chaque rendu. `null` quand l'image ne se lit pas.
 */
export function preparerVignette(url: string): Promise<VignettePreparee | null> {
  const deja = enCours.get(url);
  if (deja) return deja;
  const promesse = preparer(url)
    .catch(() => null)
    .then((resultat) => {
      resolues.set(url, resultat);
      return resultat;
    });
  enCours.set(url, promesse);
  return promesse;
}
