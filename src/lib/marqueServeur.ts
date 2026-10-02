import {
  estHoteParDefaut,
  marqueDepuisLigne,
  normaliserHote,
  SANS_ICONE,
  type LigneMarquePublique,
  type Marque,
} from "./marque";
import { estIconeRepli, urlIconeRepli } from "./iconeRepli";

/**
 * Marque blanche côté serveur : la marque de l'hôte demandé, pour le
 * HTML rendu (titre, métas d'aperçu) et le manifeste PWA.
 *
 * Hôtes Tantana : aucune requête. Autres : `get_public_branding` en
 * appel REST anonyme, gardé cinq minutes par instance. Une erreur rend
 * la dernière valeur connue ; sans elle, `sure` vaut faux.
 */

const DUREE_MS = 5 * 60 * 1000;
const DELAI_MS = 1500;
const cache = new Map<string, { marque: Marque | null; t: number }>();

export interface LectureMarque {
  marque: Marque | null;
  /** Faux : lecture en échec et rien en mémoire — `null` ne prouve pas « Tantana ». */
  sure: boolean;
}

export async function lireMarqueDeLHote(hoteBrut: string): Promise<LectureMarque> {
  const hote = normaliserHote(hoteBrut);
  if (estHoteParDefaut(hote)) return { marque: null, sure: true };

  const enCache = cache.get(hote);
  if (enCache && Date.now() - enCache.t < DUREE_MS) return { marque: enCache.marque, sure: true };
  const repli: LectureMarque = enCache
    ? { marque: enCache.marque, sure: true }
    : { marque: null, sure: false };

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !cle) return repli;

  try {
    const reponse = await fetch(`${url}/rest/v1/rpc/get_public_branding`, {
      method: "POST",
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_hostname: hote }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!reponse.ok) throw new Error(`get_public_branding : ${reponse.status}`);
    const lignes = (await reponse.json()) as LigneMarquePublique[] | null;
    const marque = lignes?.[0] ? marqueDepuisLigne(lignes[0]) : null;
    cache.set(hote, { marque, t: Date.now() });
    return { marque, sure: true };
  } catch (erreur) {
    console.error("Marque du domaine illisible :", hote, erreur);
    return repli;
  }
}

/** Pour le rendu HTML : à défaut de marque connue, Tantana. */
export async function marqueDeLHote(hoteBrut: string): Promise<Marque | null> {
  return (await lireMarqueDeLHote(hoteBrut)).marque;
}

/** Type d'image déduit de l'extension ; `undefined` si inconnu. */
function typeImage(src: string): string | undefined {
  const ext = src.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  return (
    {
      png: "image/png",
      svg: "image/svg+xml",
      webp: "image/webp",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      ico: "image/x-icon",
    } as Record<string, string>
  )[ext ?? ""];
}

/**
 * Manifeste d'une marque cliente. Même structure que
 * `public/manifest.webmanifest` ; seuls nom, description, icônes et
 * couleur de lancement changent.
 */
export function manifesteDeMarque(m: Marque): Record<string, unknown> {
  const sources = [
    ...new Set(
      [m.faviconUrl, m.logoUrl, m.splashLogoUrl].filter(
        (u) => u && u !== SANS_ICONE && !estIconeRepli(u),
      ),
    ),
  ] as string[];
  return {
    name: m.nom,
    short_name: m.nomCourt,
    description: m.slogan,
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Blanc comme Tantana : la barre d'état suit l'en-tête, qui est blanc.
    theme_color: "#ffffff",
    background_color: m.splashFond ?? "#f6f7f8",
    // Sans icône fournie, le repli : Chrome n'installe rien sans PNG 192 et 512.
    icons: sources.length
      ? sources.map((src) => {
          const type = typeImage(src);
          return { src, sizes: "any", purpose: "any", ...(type ? { type } : null) };
        })
      : iconesDeRepli(m),
  };
}

function iconesDeRepli(m: Marque): Record<string, string>[] {
  return (["any", "maskable"] as const).flatMap((purpose) =>
    ([192, 512] as const).map((t) => ({
      src: urlIconeRepli(m.nom, m.couleurPrimaire, purpose, t),
      sizes: `${t}x${t}`,
      type: "image/png",
      purpose,
    })),
  );
}
