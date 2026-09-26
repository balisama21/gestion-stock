import { supabase } from "../../../lib/supabase";

/**
 * LE LOGO D'UNE PIÈCE ÉMISE
 *
 * Chaque version du logo est rangée une fois dans le seau `logos`, sous
 * `<boutique>/<empreinte SHA-256>.<ext>`. La copie figée ne garde que ce
 * chemin et l'empreinte ; à la relecture, l'empreinte du fichier est
 * vérifiée : un chemin ne peut pas désigner un autre logo.
 */

export type LogoCopie =
  | { chemin: string; empreinte: string }
  /** La boutique n'avait pas de logo : la pièce portait ses initiales. */
  | { aucun: true }
  /** Un logo déjà hébergé ailleurs : son adresse suffit. */
  | { url: string };

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function decoderDataUrl(url: string): { octets: Uint8Array; type: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m || !EXTENSIONS[m[1]]) return null;
  if (m[2]) {
    const binaire = atob(m[3]);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
    return { octets, type: m[1] };
  }
  return { octets: new TextEncoder().encode(decodeURIComponent(m[3])), type: m[1] };
}

export async function empreinte(octets: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", octets as BufferSource);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function lireLogoCopie(brut: unknown): LogoCopie | undefined {
  if (!brut || typeof brut !== "object") return undefined;
  const r = brut as Record<string, unknown>;
  if (r.aucun === true) return { aucun: true };
  if (typeof r.url === "string" && /^https?:\/\//.test(r.url)) return { url: r.url };
  if (
    typeof r.chemin === "string" &&
    typeof r.empreinte === "string" &&
    /^[0-9a-f]{64}$/.test(r.empreinte) &&
    r.chemin.includes(r.empreinte)
  ) {
    return { chemin: r.chemin, empreinte: r.empreinte };
  }
  return undefined;
}

const deposes = new Set<string>();

/** Rangé une fois : on regarde s'il y est avant d'envoyer 1 ou 2 Mo sur un réseau mobile. */
async function deposer(chemin: string, octets: Uint8Array, type: string): Promise<void> {
  if (deposes.has(chemin)) return;
  const [dossier, nom] = chemin.split("/");
  const { data } = await supabase.storage.from("logos").list(dossier, { search: nom, limit: 1 });
  if (!data?.some((f) => f.name === nom)) {
    const { error } = await supabase.storage
      .from("logos")
      .upload(chemin, new Blob([octets as BlobPart], { type }), {
        contentType: type,
        upsert: false,
      });
    // « Déjà présent » veut dire qu'un autre appareil l'a rangé entre-temps : c'est réussi.
    if (error && !/exist|duplicate|409/i.test(error.message)) return;
  }
  deposes.add(chemin);
}

/**
 * Ce que la copie figée retient du logo du moment. L'envoi du fichier se
 * fait ensuite, sans faire attendre l'ouverture du document ; s'il échoue,
 * une prochaine émission le rangera.
 */
export async function preparerLogo(
  storeId: string,
  logoUrl: string | null | undefined,
): Promise<LogoCopie | undefined> {
  const url = (logoUrl ?? "").trim();
  if (!url) return { aucun: true };
  if (/^https?:\/\//.test(url)) return { url };
  const d = decoderDataUrl(url);
  if (!d) return undefined;
  try {
    const e = await empreinte(d.octets);
    const chemin = `${storeId}/${e}.${EXTENSIONS[d.type]}`;
    void deposer(chemin, d.octets, d.type).catch(() => undefined);
    return { chemin, empreinte: e };
  } catch {
    return undefined;
  }
}

const lus = new Map<string, Promise<string | null>>();

/** Le logo d'une copie, en data URL ; `null` s'il manque ou ne correspond pas à son empreinte. */
export function lireLogo(logo: { chemin: string; empreinte: string }): Promise<string | null> {
  let p = lus.get(logo.chemin);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.storage.from("logos").download(logo.chemin);
      if (error || !data) return null;
      const octets = new Uint8Array(await data.arrayBuffer());
      if ((await empreinte(octets)) !== logo.empreinte) return null;
      return await new Promise<string>((ok) => {
        const r = new FileReader();
        r.onload = () => ok(r.result as string);
        r.readAsDataURL(data);
      });
    })().catch(() => null);
    p.then((v) => {
      if (v === null) lus.delete(logo.chemin);
    });
    lus.set(logo.chemin, p);
  }
  return p;
}

/**
 * Le logo avec lequel reconstruire la pièce. `undefined` quand la copie ne
 * dit rien (copie ancienne, ou fichier introuvable) : on garde alors celui
 * du moment, faute de mieux.
 */
export async function logoDeLaCopie(logo: LogoCopie | undefined): Promise<string | undefined> {
  if (!logo) return undefined;
  if ("aucun" in logo) return "";
  if ("url" in logo) return logo.url;
  return (await lireLogo(logo)) ?? undefined;
}
