import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { supprimerFond, type ImagePixels, type OptionsFond, type ResultatFond } from "./fondCachet";

/** Côté maximal traité : au-delà, la photo d'un téléphone n'apporte que du bruit. */
const COTE_TRAITE = 2000;
/** Côté maximal enregistré : un cachet de 12 cm reste net à 300 points par pouce. */
export const COTE_ENREGISTRE = 1500;

export async function lireImage(fichier: File): Promise<ImagePixels> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Cette image n'a pas pu être lue."));
      i.src = url;
    });
    const k = Math.min(1, COTE_TRAITE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Le navigateur ne sait pas lire cette image.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: d.width, height: d.height, data: d.data };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Le détourage, dans un Web Worker pour ne pas figer l'écran ; sur place à défaut. */
export async function detourer(image: ImagePixels, options: OptionsFond): Promise<ResultatFond> {
  if (typeof Worker === "undefined") return supprimerFond(image, options);
  try {
    const worker = new Worker(new URL("./fondCachet.worker.ts", import.meta.url), {
      type: "module",
    });
    const copie = { width: image.width, height: image.height, data: image.data.slice() };
    return await new Promise<ResultatFond>((ok, ko) => {
      worker.onmessage = (e: MessageEvent<ResultatFond>) => ok(e.data);
      worker.onerror = (e) => ko(e);
      worker.postMessage({ image: copie, options }, [copie.data.buffer]);
    }).finally(() => worker.terminate());
  } catch {
    return supprimerFond(image, options);
  }
}

export function versCanvas(img: ImagePixels): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas
    .getContext("2d")
    ?.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas;
}

/** Le PNG final : recadré, ramené à `COTE_ENREGISTRE` au plus. */
export async function versPng(
  source: HTMLCanvasElement,
  cadre: { x: number; y: number; l: number; h: number },
): Promise<{ blob: Blob; largeur: number; hauteur: number }> {
  const sx = Math.round(cadre.x * source.width);
  const sy = Math.round(cadre.y * source.height);
  const sl = Math.max(1, Math.round(cadre.l * source.width));
  const sh = Math.max(1, Math.round(cadre.h * source.height));
  const k = Math.min(1, COTE_ENREGISTRE / Math.max(sl, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sl * k));
  canvas.height = Math.max(1, Math.round(sh * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur ne sait pas produire l'image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sl, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("L'image n'a pas pu être produite.");
  return { blob, largeur: canvas.width, hauteur: canvas.height };
}

const nouvelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function envoyerCachet(
  storeId: string,
  blob: Blob,
): Promise<{ id: string; chemin: string | null; error: string | null }> {
  const id = nouvelId();
  const chemin = `${storeId}/${id}.png`;
  const { error } = await supabase.storage
    .from("cachets")
    .upload(chemin, blob, { contentType: "image/png", upsert: false });
  if (!error) return { id, chemin, error: null };
  const refus = /row-level security|unauthorized|403/i.test(error.message);
  return {
    id,
    chemin: null,
    error: refus
      ? "Seuls le propriétaire, l'administrateur et le manager de la boutique peuvent ajouter un cachet."
      : `L'image n'a pas pu être envoyée : ${error.message}`,
  };
}

/*
 * L'image est lue une fois par session et gardée en data URL : une adresse
 * signée expire, et la capture du PDF ne doit pas dépendre du réseau.
 */
const cache = new Map<string, Promise<string | null>>();

export function imageCachet(chemin: string): Promise<string | null> {
  let p = cache.get(chemin);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.storage.from("cachets").download(chemin);
      if (error || !data) return null;
      return await new Promise<string>((ok) => {
        const r = new FileReader();
        r.onload = () => ok(r.result as string);
        r.readAsDataURL(data);
      });
    })();
    p.then((v) => {
      if (v === null) cache.delete(chemin);
    });
    cache.set(chemin, p);
  }
  return p;
}

export function useImageCachet(chemin: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let actif = true;
    setUrl(null);
    if (chemin) void imageCachet(chemin).then((v) => actif && setUrl(v));
    return () => {
      actif = false;
    };
  }, [chemin]);
  return url;
}
