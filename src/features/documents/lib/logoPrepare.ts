import { useEffect, useMemo, useState } from "react";
import { useMarque } from "../../../hooks/useMarque";

/**
 * LE LOGO, PRÉPARÉ POUR LA FEUILLE
 *
 * Les boutiques envoient ce qu'elles ont : un PNG avec une large marge
 * transparente, une photo prise sur fond blanc, parfois une capture
 * d'écran de deux mégaoctets. Posé tel quel, le dessin ne remplit qu'un
 * coin de son cadre et paraît minuscule.
 *
 * Avant l'affichage, on rogne donc ce qui n'est que du vide — transparent
 * ou presque blanc — sur les quatre bords, et on ramène l'image à une
 * taille qui reste nette à l'impression (600 px pour 44 mm, plus de
 * 300 points par pouce) sans peser sur le PDF.
 *
 * Rien n'est réenregistré : le logo de la boutique reste celui qu'elle a
 * choisi. En cas d'échec — image illisible, navigateur sans canevas —, on
 * rend l'image d'origine : mieux vaut un logo mal cadré qu'un logo absent.
 */

/** Côté maximal du logo préparé, en pixels. */
export const COTE_MAX = 600;

/** En dessous, un pixel est du vide : transparent, ou blanc cassé. */
const ALPHA_VIDE = 12;
const BLANC = 245;

/** Le cadre utile d'une image, en pixels : ce qui n'est pas du vide. */
export interface Cadre {
  x: number;
  y: number;
  l: number;
  h: number;
}

/**
 * Le plus petit rectangle qui contient tout le dessin.
 *
 * `null` quand l'image n'est que du vide : on la laisse alors telle quelle.
 */
export function cadreUtile(
  pixels: Uint8ClampedArray,
  largeur: number,
  hauteur: number,
): Cadre | null {
  const plein = (i: number) => {
    const a = pixels[i + 3];
    if (a <= ALPHA_VIDE) return false;
    return !(pixels[i] >= BLANC && pixels[i + 1] >= BLANC && pixels[i + 2] >= BLANC);
  };
  let haut = -1;
  let bas = -1;
  let gauche = largeur;
  let droite = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (!plein((y * largeur + x) * 4)) continue;
      if (haut < 0) haut = y;
      bas = y;
      if (x < gauche) gauche = x;
      if (x > droite) droite = x;
    }
  }
  if (haut < 0) return null;
  // Un liseré de 2 % garde l'air dont un dessin a besoin.
  const marge = Math.round(Math.max(droite - gauche, bas - haut) * 0.02);
  const x = Math.max(0, gauche - marge);
  const y = Math.max(0, haut - marge);
  return {
    x,
    y,
    l: Math.min(largeur, droite + marge + 1) - x,
    h: Math.min(hauteur, bas + marge + 1) - y,
  };
}

const memoire = new Map<string, Promise<string>>();

function charger(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error("Logo illisible"));
    img.src = src;
  });
}

async function preparer(src: string): Promise<string> {
  const img = await charger(src);
  const l0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!l0 || !h0) return src;

  // On cherche le cadre sur une copie réduite : rapide, et assez précise.
  const k = Math.min(1, 400 / Math.max(l0, h0));
  const lm = Math.max(1, Math.round(l0 * k));
  const hm = Math.max(1, Math.round(h0 * k));
  const mesure = document.createElement("canvas");
  mesure.width = lm;
  mesure.height = hm;
  const cm = mesure.getContext("2d", { willReadFrequently: true });
  if (!cm) return src;
  cm.drawImage(img, 0, 0, lm, hm);
  const c = cadreUtile(cm.getImageData(0, 0, lm, hm).data, lm, hm);
  const cadre = c
    ? { x: c.x / k, y: c.y / k, l: c.l / k, h: c.h / k }
    : { x: 0, y: 0, l: l0, h: h0 };

  const r = Math.min(1, COTE_MAX / Math.max(cadre.l, cadre.h));
  const sortie = document.createElement("canvas");
  sortie.width = Math.max(1, Math.round(cadre.l * r));
  sortie.height = Math.max(1, Math.round(cadre.h * r));
  const cs = sortie.getContext("2d");
  if (!cs) return src;
  cs.imageSmoothingQuality = "high";
  cs.drawImage(img, cadre.x, cadre.y, cadre.l, cadre.h, 0, 0, sortie.width, sortie.height);
  return sortie.toDataURL("image/png");
}

/** Le logo rogné et allégé ; l'original si quoi que ce soit échoue. Mémorisé par adresse. */
export function logoPrepare(src: string): Promise<string> {
  let p = memoire.get(src);
  if (!p) {
    p = preparer(src).catch(() => src);
    memoire.set(src, p);
  }
  return p;
}

/**
 * Le logo d'une marque, servi par le même site que l'application.
 *
 * Les marques le déclarent en adresse https absolue (les e-mails
 * l'exigent). Ses fichiers sont aussi dans `public/marques/` : lu depuis
 * ici, il ne dépend ni d'un autre domaine ni de ses en-têtes CORS, que le
 * canevas du rognage et la capture du PDF réclameraient.
 */
export function logoDeMarqueLocal(url: string): string {
  try {
    const u = new URL(url, "https://local.invalid");
    return u.pathname.startsWith("/marques/") ? u.pathname : url;
  } catch {
    return url;
  }
}

/**
 * Faute de logo importé, une boutique d'une marque blanche porte celui de
 * sa marque (le K bleu de Kinvest) plutôt que ses initiales. Tantana garde
 * les initiales sur sa feuille.
 */
export function avecLogoDeMarque<
  T extends {
    emetteur: { logoUrl: string | null; initiales?: string | null; fauteDeLogo?: boolean };
  } | null,
>(doc: T, logoDeMarque: string | null): T {
  if (!doc || !logoDeMarque || !doc.emetteur.fauteDeLogo || doc.emetteur.logoUrl) return doc;
  return { ...doc, emetteur: { ...doc.emetteur, logoUrl: logoDeMarque, initiales: null } };
}

/**
 * Le document avec son logo préparé, et si la préparation est finie.
 *
 * Tant qu'elle ne l'est pas, le document garde le logo d'origine : l'aperçu
 * s'affiche aussitôt, mais l'export attend (`pret`), pour que le PDF porte
 * le logo rogné et non l'image lourde.
 */
export function useDocumentAvecLogo<
  T extends {
    emetteur: { logoUrl: string | null; initiales?: string | null; fauteDeLogo?: boolean };
  } | null,
>(source: T): { doc: T; pret: boolean } {
  const marque = useMarque();
  const logoDeMarque =
    !marque.parDefaut && marque.logoUrl ? logoDeMarqueLocal(marque.logoUrl) : null;
  const doc = useMemo(() => avecLogoDeMarque(source, logoDeMarque), [source, logoDeMarque]);
  const brut = doc?.emetteur.logoUrl ?? null;
  const [pretes, setPretes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!brut || pretes[brut]) return;
    let actif = true;
    void logoPrepare(brut).then((url) => {
      if (actif) setPretes((p) => ({ ...p, [brut]: url }));
    });
    return () => {
      actif = false;
    };
  }, [brut, pretes]);
  const url = brut ? pretes[brut] : undefined;
  const sortie = useMemo(
    () => (url && doc ? ({ ...doc, emetteur: { ...doc.emetteur, logoUrl: url } } as T) : doc),
    [doc, url],
  );
  return { doc: sortie, pret: !brut || url !== undefined };
}
