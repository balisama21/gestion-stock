import {
  estHoteParDefaut,
  marqueDepuisLigne,
  normaliserHote,
  SANS_ICONE,
  type LigneMarquePublique,
  type Marque,
} from "./marque";

/**
 * Marque blanche côté serveur : la marque de l'hôte demandé, pour le
 * HTML rendu (titre, métas d'aperçu) et le manifeste PWA.
 *
 * Hôtes Tantana : aucune requête. Autres : `get_public_branding` en
 * appel REST anonyme, gardé cinq minutes par instance. Une erreur rend
 * la dernière valeur connue, sinon Tantana — comme le client.
 */

const DUREE_MS = 5 * 60 * 1000;
const DELAI_MS = 1500;
const cache = new Map<string, { marque: Marque | null; t: number }>();

export async function marqueDeLHote(hoteBrut: string): Promise<Marque | null> {
  const hote = normaliserHote(hoteBrut);
  if (estHoteParDefaut(hote)) return null;

  const enCache = cache.get(hote);
  if (enCache && Date.now() - enCache.t < DUREE_MS) return enCache.marque;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const cle = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !cle) return enCache?.marque ?? null;

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
    return marque;
  } catch (erreur) {
    console.error("Marque du domaine illisible :", hote, erreur);
    return enCache?.marque ?? null;
  }
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
    ...new Set([m.faviconUrl, m.logoUrl, m.splashLogoUrl].filter((u) => u && u !== SANS_ICONE)),
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
    icons: sources.map((src) => {
      const type = typeImage(src);
      return { src, sizes: "any", purpose: "any", ...(type ? { type } : null) };
    }),
  };
}
