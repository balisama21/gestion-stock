/**
 * Detourer une photo de produit : rendre son fond transparent.
 *
 * ── Pourquoi ce code plutot qu'une bibliotheque ──
 *
 * Les detoureurs « par IA » qui tournent gratuitement dans un
 * navigateur sont tous fermes a un logiciel vendu. `@imgly/background-
 * removal` est sous AGPL v3 : l'employer obligerait a livrer le code
 * source complet de Tantana Suite a chaque personne qui s'en sert par
 * le reseau. Les poids RMBG de Bria, que la plupart des autres
 * reprennent, portent une licence « usage non commercial ». Restent les
 * services payants a l'image, qui demandent un compte, une cle et de
 * l'argent a chaque photo.
 *
 * D'ou celui-ci : cent lignes, aucune dependance, aucune licence a
 * respecter, rien qui sorte du telephone, et un resultat immediat.
 *
 * ── Ce qu'il sait faire, et ce qu'il ne sait pas ──
 *
 * Il excelle sur un FOND UNI : un article pose sur une table claire,
 * sur un drap, sur un carton. C'est la photo que prend un commercant.
 * Il echoue sur un fond charge — une etagere, une rue, un motif — et
 * c'est assume : dans ce cas il previent plutot que de rendre une
 * decoupe sale.
 *
 * ── Pourquoi un remplissage par diffusion, et non un simple seuil ──
 *
 * Effacer TOUS les pixels proches de la couleur de fond percerait le
 * produit lui-meme : une etiquette blanche sur un fond blanc
 * disparaitrait avec lui. La diffusion part des BORDS et ne progresse
 * que de proche en proche ; un blanc enferme dans le produit n'est
 * jamais atteint, parce qu'aucun chemin ne l'y mene.
 */

/** Trois fermetes, pour trois fonds plus ou moins nets. */
export const FORCES = [
  { cle: "faible", libelle: "Prudent", tolerance: 22 },
  { cle: "moyenne", libelle: "Normal", tolerance: 40 },
  { cle: "forte", libelle: "Insistant", tolerance: 68 },
] as const;

export type CleForce = (typeof FORCES)[number]["cle"];

export interface ResultatDetourage {
  fichier: File;
  /** Part des pixels rendus transparents, de 0 a 1. */
  retire: number;
}

/** Cote maximal traite : au-dela, on reduit avant de detourer. */
const COTE_MAX = 1600;

const distance = (d: Uint8ClampedArray, i: number, r: number, v: number, b: number): number => {
  const dr = d[i] - r;
  const dv = d[i + 1] - v;
  const db = d[i + 2] - b;
  return Math.sqrt(dr * dr + dv * dv + db * db);
};

/**
 * La couleur du fond, lue sur le pourtour.
 *
 * La MEDIANE et non la moyenne : un coin sombre ou un reflet tirerait
 * une moyenne vers une couleur qui n'existe nulle part dans l'image,
 * et la comparaison se ferait alors contre un fond imaginaire.
 */
const couleurDuBord = (d: Uint8ClampedArray, l: number, h: number): [number, number, number] => {
  const rs: number[] = [];
  const vs: number[] = [];
  const bs: number[] = [];
  const lire = (x: number, y: number) => {
    const i = (y * l + x) * 4;
    rs.push(d[i]);
    vs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };
  for (let x = 0; x < l; x++) {
    lire(x, 0);
    lire(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    lire(0, y);
    lire(l - 1, y);
  }
  const med = (t: number[]) => {
    t.sort((a, b) => a - b);
    return t[Math.floor(t.length / 2)];
  };
  return [med(rs), med(vs), med(bs)];
};

export async function detourerFondUni(
  fichier: File,
  tolerance: number,
): Promise<ResultatDetourage> {
  const bitmap = await createImageBitmap(fichier);
  const reduction = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const l = Math.max(1, Math.round(bitmap.width * reduction));
  const h = Math.max(1, Math.round(bitmap.height * reduction));

  const canvas = document.createElement("canvas");
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Le navigateur n'a pas pu lire cette image.");
  ctx.drawImage(bitmap, 0, 0, l, h);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, l, h);
  const d = image.data;
  const [r, v, b] = couleurDuBord(d, l, h);

  // ── La diffusion depuis les bords ──
  const vu = new Uint8Array(l * h);
  const file = new Int32Array(l * h);
  let debut = 0;
  let fin = 0;
  const semer = (p: number) => {
    if (vu[p]) return;
    if (distance(d, p * 4, r, v, b) > tolerance) return;
    vu[p] = 1;
    file[fin++] = p;
  };
  for (let x = 0; x < l; x++) {
    semer(x);
    semer((h - 1) * l + x);
  }
  for (let y = 0; y < h; y++) {
    semer(y * l);
    semer(y * l + l - 1);
  }

  while (debut < fin) {
    const p = file[debut++];
    const x = p % l;
    const y = (p / l) | 0;
    if (x > 0) semer(p - 1);
    if (x < l - 1) semer(p + 1);
    if (y > 0) semer(p - l);
    if (y < h - 1) semer(p + l);
  }

  // ── Effacement, et un bord adouci ──
  //
  // Une transparence franche laisse un lisere de la couleur du fond
  // tout autour du produit, qui se voit d'autant plus une fois la photo
  // posee sur du blanc. Les pixels VOISINS d'un pixel efface, encore
  // proches de la couleur de fond, recoivent donc une transparence
  // partielle : la decoupe se fond au lieu de trancher.
  const marge = tolerance * 0.6;
  let effaces = 0;
  for (let p = 0; p < l * h; p++) {
    const i = p * 4;
    if (vu[p]) {
      d[i + 3] = 0;
      effaces++;
      continue;
    }
    const x = p % l;
    const y = (p / l) | 0;
    const voisinEfface =
      (x > 0 && vu[p - 1]) ||
      (x < l - 1 && vu[p + 1]) ||
      (y > 0 && vu[p - l]) ||
      (y < h - 1 && vu[p + l]);
    if (!voisinEfface) continue;
    const ecart = distance(d, i, r, v, b);
    if (ecart >= tolerance + marge) continue;
    const part = Math.max(0, Math.min(1, (ecart - tolerance) / marge));
    d[i + 3] = Math.round(d[i + 3] * part);
  }

  ctx.putImageData(image, 0, 0);

  // ── WebP d'abord, PNG en secours ──
  //
  // Les deux savent etre transparents, mais le PNG d'une photo pese
  // plusieurs fois le WebP : une bouteille detouree fait 104 ko en PNG
  // et le quart en WebP. Sur une boutique qui se consulte en donnees
  // mobiles, cela se paie a chaque affichage. Les navigateurs qui ne
  // savent pas ecrire de WebP rendent `null`, ou un PNG deguise :
  // on verifie le type rendu plutot que de faire confiance.
  const ecrire = (type: string, qualite?: number) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, qualite));

  let blob = await ecrire("image/webp", 0.9);
  let extension = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await ecrire("image/png");
    extension = "png";
  }
  if (!blob) throw new Error("La photo détourée n'a pas pu être produite.");

  const nom = fichier.name.replace(/\.[^.]+$/, "") + "-detoure." + extension;
  return {
    fichier: new File([blob], nom, { type: blob.type }),
    retire: effaces / (l * h),
  };
}
