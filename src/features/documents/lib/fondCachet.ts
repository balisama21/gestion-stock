/**
 * SUPPRESSION DU FOND D'UN CACHET OU D'UNE SIGNATURE
 *
 * Sans service externe ni modèle à télécharger : tout se fait sur les pixels.
 *  1. Le fond est estimé par zones (le papier est ce qu'il y a de plus clair
 *     dans chaque zone) : un éclairage inégal ou une ombre douce ne passent
 *     pas pour de l'encre.
 *  2. L'écart de chaque pixel à son fond donne l'encre ; le seuil est trouvé
 *     automatiquement (Otsu) et la transparence est progressive sur les bords.
 *  3. Les lignes d'un papier ligné — longues, fines, répétées, plus pâles que
 *     l'encre — sont retirées ; l'encre qui les croise reste.
 *  4. L'image est recadrée au plus près de l'encre.
 *
 * Limites : encre de la couleur du papier, ombre portée très marquée, ligne
 * du papier aussi foncée que l'encre.
 */

export interface ImagePixels {
  width: number;
  height: number;
  /** RGBA, 4 octets par pixel. */
  data: Uint8ClampedArray;
}

export type Encre = "originale" | "noir" | "bleu";

export interface OptionsFond {
  /** 1 par défaut ; plus haut garde davantage de traits pâles. */
  sensibilite: number;
  encre: Encre;
}

export interface ResultatFond {
  image: ImagePixels;
  /** Le coin haut-gauche du recadrage, dans l'image d'origine. */
  origine: { x: number; y: number };
  /** Part de l'image d'origine gardée comme encre, de 0 à 1. */
  couverture: number;
  avertissement: string | null;
}

export const OPTIONS_PAR_DEFAUT: OptionsFond = { sensibilite: 1, encre: "originale" };

const ENCRES: Record<Exclude<Encre, "originale">, [number, number, number]> = {
  noir: [22, 24, 28],
  bleu: [28, 48, 140],
};

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Une image dont une part notable des pixels est déjà transparente a été détourée ailleurs. */
export function estDejaDetouree(img: ImagePixels): boolean {
  let transparents = 0;
  const n = img.width * img.height;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 250) transparents++;
  return n > 0 && transparents / n > 0.05;
}

/** La couleur du papier, zone par zone : la moyenne des pixels les plus clairs de chaque zone. */
function estimerFond(img: ImagePixels) {
  const { width: w, height: h, data } = img;
  const tuile = Math.max(12, Math.round(Math.max(w, h) / 24));
  const gw = Math.ceil(w / tuile);
  const gh = Math.ceil(h / tuile);
  const fond = new Float32Array(gw * gh * 3);
  const histo = new Uint32Array(256);

  for (let ty = 0; ty < gh; ty++) {
    for (let tx = 0; tx < gw; tx++) {
      histo.fill(0);
      const x0 = tx * tuile;
      const y0 = ty * tuile;
      const x1 = Math.min(w, x0 + tuile);
      const y1 = Math.min(h, y0 + tuile);
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          histo[Math.round(luminance(data[i], data[i + 1], data[i + 2]))]++;
          total++;
        }
      }
      // Le 85e centile : au-dessus, c'est du papier, même si l'encre couvre la zone aux deux tiers.
      let cumul = 0;
      let seuil = 255;
      for (let v = 0; v < 256; v++) {
        cumul += histo[v];
        if (cumul >= total * 0.85) {
          seuil = v;
          break;
        }
      }
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          if (Math.round(luminance(data[i], data[i + 1], data[i + 2])) >= seuil) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            k++;
          }
        }
      }
      const j = (ty * gw + tx) * 3;
      fond[j] = r / Math.max(1, k);
      fond[j + 1] = g / Math.max(1, k);
      fond[j + 2] = b / Math.max(1, k);
    }
  }

  // Interpolation bilinéaire entre les centres des zones.
  return (x: number, y: number, sortie: number[]) => {
    const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / tuile - 0.5));
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / tuile - 0.5));
    const ax = Math.floor(fx);
    const ay = Math.floor(fy);
    const bx = Math.min(gw - 1, ax + 1);
    const by = Math.min(gh - 1, ay + 1);
    const dx = fx - ax;
    const dy = fy - ay;
    for (let c = 0; c < 3; c++) {
      const v00 = fond[(ay * gw + ax) * 3 + c];
      const v10 = fond[(ay * gw + bx) * 3 + c];
      const v01 = fond[(by * gw + ax) * 3 + c];
      const v11 = fond[(by * gw + bx) * 3 + c];
      sortie[c] = (v00 * (1 - dx) + v10 * dx) * (1 - dy) + (v01 * (1 - dx) + v11 * dx) * dy;
    }
  };
}

/** Seuil d'Otsu sur un histogramme de 256 valeurs. */
function otsu(histo: Uint32Array): number {
  let total = 0;
  let somme = 0;
  for (let v = 0; v < 256; v++) {
    total += histo[v];
    somme += v * histo[v];
  }
  let sommeB = 0;
  let poidsB = 0;
  let meilleur = 0;
  let seuil = 0;
  for (let v = 0; v < 256; v++) {
    poidsB += histo[v];
    if (poidsB === 0) continue;
    const poidsF = total - poidsB;
    if (poidsF === 0) break;
    sommeB += v * histo[v];
    const mB = sommeB / poidsB;
    const mF = (somme - sommeB) / poidsF;
    const entre = poidsB * poidsF * (mB - mF) * (mB - mF);
    if (entre > meilleur) {
      meilleur = entre;
      seuil = v;
    }
  }
  return seuil;
}

const mediane = (valeurs: number[]) => {
  if (valeurs.length === 0) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)];
};

/**
 * Retire les lignes du papier : des rangées (ou colonnes) presque entièrement
 * « encrées », au moins trois, et nettement plus pâles que l'encre elle-même.
 * Le cadre d'un tampon n'est ni assez long, ni assez répété, ni assez pâle.
 */
function retirerLignes(
  alpha: Float32Array,
  ecart: Float32Array,
  w: number,
  h: number,
  horizontal: boolean,
  seuil: number,
) {
  const longueur = horizontal ? w : h;
  const nombre = horizontal ? h : w;
  const idx = (rang: number, pos: number) => (horizontal ? rang * w + pos : pos * w + rang);

  // Une ligne pâle sur un papier mal éclairé n'est opaque qu'à moitié : on la
  // repère à sa trace, même faible, sur toute la longueur.
  const trace = seuil * 0.35;
  const marques: boolean[] = [];
  for (let r = 0; r < nombre; r++) {
    let n = 0;
    for (let p = 0; p < longueur; p++) if (ecart[idx(r, p)] > trace) n++;
    marques.push(n / longueur > 0.6);
  }

  let bandes = 0;
  for (let r = 0; r < nombre; r++) if (marques[r] && !marques[r - 1]) bandes++;
  if (bandes < 3) return;

  const encre: number[] = [];
  const ligne: number[] = [];
  for (let r = 0; r < nombre; r++) {
    for (let p = 0; p < longueur; p += 3) {
      const i = idx(r, p);
      if (marques[r] ? ecart[i] > trace : alpha[i] > 0.5)
        (marques[r] ? ligne : encre).push(ecart[i]);
    }
  }
  const dLigne = mediane(ligne);
  const dEncre = mediane(encre);
  if (encre.length > 0 && dLigne > dEncre * 0.75) return;

  const plafond = dLigne * 1.6;
  for (let r = 0; r < nombre; r++) {
    if (!marques[r]) continue;
    // La rangée voisine du trait est souvent à moitié couverte : on l'emporte aussi.
    for (const rr of [r - 1, r, r + 1]) {
      if (rr < 0 || rr >= nombre) continue;
      for (let p = 0; p < longueur; p++) {
        const i = idx(rr, p);
        if (ecart[i] < plafond) alpha[i] = 0;
      }
    }
  }
}

export function supprimerFond(
  img: ImagePixels,
  options: OptionsFond = OPTIONS_PAR_DEFAUT,
): ResultatFond {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const fond = estimerFond(img);
  const bg = [0, 0, 0];
  const ecart = new Float32Array(n);
  const fonds = new Float32Array(n * 3);
  const histo = new Uint32Array(256);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      fond(x, y, bg);
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const sombre = luminance(bg[0], bg[1], bg[2]) - luminance(r, g, b);
      const teinte = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
      const d = Math.min(255, Math.max(0, sombre, 0.6 * teinte));
      ecart[p] = d;
      fonds[p * 3] = bg[0];
      fonds[p * 3 + 1] = bg[1];
      fonds[p * 3 + 2] = bg[2];
      histo[Math.round(d)]++;
    }
  }

  // Le bruit du papier et du capteur reste sous 18 : pas d'encre en dessous.
  const seuil = Math.max(18, otsu(histo)) / Math.max(0.25, options.sensibilite);
  const bas = seuil * 0.6;
  const haut = seuil * 1.4;
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) alpha[p] = Math.min(1, Math.max(0, (ecart[p] - bas) / (haut - bas)));

  retirerLignes(alpha, ecart, w, h, true, seuil);
  retirerLignes(alpha, ecart, w, h, false, seuil);

  let couvert = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + x];
      couvert += a;
      if (a > 0.1) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const couverture = n > 0 ? couvert / n : 0;

  if (x1 < 0) {
    x0 = 0;
    y0 = 0;
    x1 = w - 1;
    y1 = h - 1;
  } else {
    const marge = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03) + 2;
    x0 = Math.max(0, x0 - marge);
    y0 = Math.max(0, y0 - marge);
    x1 = Math.min(w - 1, x1 + marge);
    y1 = Math.min(h - 1, y1 + marge);
  }

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const sortie = new Uint8ClampedArray(cw * ch * 4);
  const fixe = options.encre === "originale" ? null : ENCRES[options.encre];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const p = (y + y0) * w + (x + x0);
      const i = p * 4;
      const o = (y * cw + x) * 4;
      const a = alpha[p];
      if (fixe) {
        sortie[o] = fixe[0];
        sortie[o + 1] = fixe[1];
        sortie[o + 2] = fixe[2];
      } else {
        // L'encre sans le papier qui la délave sur les bords.
        const k = Math.max(a, 0.05);
        for (let c = 0; c < 3; c++) {
          sortie[o + c] = (data[i + c] - (1 - k) * fonds[p * 3 + c]) / k;
        }
      }
      sortie[o + 3] = Math.round(a * 255);
    }
  }

  const avertissement =
    couverture > 0.45
      ? "Le fond n'a pas été reconnu : une grande partie de la photo a été gardée. Essayez une photo sur papier uni, bien éclairée, ou baissez la sensibilité."
      : couverture < 0.0005
        ? "Presque rien n'a été gardé. Rapprochez-vous du cachet ou montez la sensibilité."
        : null;

  return {
    image: { width: cw, height: ch, data: sortie },
    origine: { x: x0, y: y0 },
    couverture,
    avertissement,
  };
}

/** Recadre une image déjà détourée au plus près de ce qui n'est pas transparent. */
export function recadrerTransparent(img: ImagePixels): ImagePixels {
  const { width: w, height: h, data } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 25) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const sortie = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    sortie.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * cw * 4);
  }
  return { width: cw, height: ch, data: sortie };
}
