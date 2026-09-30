import { supabase } from "./supabase";
import { estHoteParDefaut, normaliserHote } from "./marque";

/**
 * Domaines personnalisés et identités visuelles.
 *
 * Lecture : membres de la boutique (RLS). Écriture : super admin
 * uniquement (RLS) — ces fonctions sont prêtes pour son futur écran,
 * aucun domaine ne demande de modifier le code.
 */

export interface DomainePersonnalise {
  id: string;
  hostname: string;
  store_id: string;
  is_active: boolean;
  created_at: string;
}

export interface ReglagesBranding {
  store_id: string;
  app_name: string;
  short_name?: string | null;
  tagline?: string | null;
  page_title?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  splash_logo_url?: string | null;
  login_image_url?: string | null;
  login_title?: string | null;
  login_subtitle?: string | null;
  primary_color?: string | null;
  primary_color_dark?: string | null;
  splash_background?: string | null;
}

/**
 * La boutique rattachée au domaine visité, si l'utilisateur connecté en
 * est membre. `null` partout ailleurs, y compris en cas d'erreur : on
 * retombe alors sur le choix habituel de boutique.
 */
export async function boutiqueDuDomaineCourant(): Promise<string | null> {
  if (typeof window === "undefined" || estHoteParDefaut(window.location.hostname)) return null;
  const { data, error } = await supabase
    .from("custom_domains")
    .select("store_id")
    .eq("hostname", normaliserHote(window.location.hostname))
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { store_id: string }).store_id;
}

// ─── Super admin ─────────────────────────────────────────────────────

export async function listerDomaines(): Promise<DomainePersonnalise[]> {
  const { data, error } = await supabase
    .from("custom_domains")
    .select("id, hostname, store_id, is_active, created_at")
    .order("hostname");
  if (error) throw error;
  return (data ?? []) as DomainePersonnalise[];
}

export async function ajouterDomaine(hostname: string, storeId: string): Promise<void> {
  const { error } = await supabase
    .from("custom_domains")
    .insert({ hostname: normaliserHote(hostname), store_id: storeId });
  if (error) throw error;
}

export async function activerDomaine(id: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from("custom_domains").update({ is_active: actif }).eq("id", id);
  if (error) throw error;
}

export async function retirerDomaine(id: string): Promise<void> {
  const { error } = await supabase.from("custom_domains").delete().eq("id", id);
  if (error) throw error;
}

export async function lireBranding(storeId: string): Promise<ReglagesBranding | null> {
  const { data, error } = await supabase
    .from("branding")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReglagesBranding | null) ?? null;
}

export async function enregistrerBranding(reglages: ReglagesBranding): Promise<void> {
  const { error } = await supabase.from("branding").upsert(reglages, { onConflict: "store_id" });
  if (error) throw error;
}
