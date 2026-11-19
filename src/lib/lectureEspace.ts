import { supabase } from "./supabase";
import type { Database } from "./database.types";
import { normalizePermissions, type PermissionsMap } from "./permissions";
import { boutiqueDuDomaineCourant } from "./domaines";
import { lireAccesMarque, type AccesMarque } from "./marquesBoutiques";

type Store = Database["public"]["Tables"]["stores"]["Row"];

/**
 * Lecture des boutiques du compte, au démarrage de l'application.
 *
 * LE LOGO N'EN FAIT PAS PARTIE. Il est stocké en base64 dans la colonne
 * `logo_url`, et les logos enregistrés avant leur réduction (voir
 * compressLogo.ts) pèsent jusqu'à deux mégaoctets chacun. `select("*")`
 * les ramenait tous, pour chaque boutique du compte : mesuré le
 * 19/11/2026, 4,2 Mo pour six boutiques, et 4 à 6 secondes d'écran
 * « Ouverture de votre boutique… » sur une bonne connexion. Seul le logo
 * de la boutique ouverte s'affiche : il est lu à part, sans bloquer
 * l'ouverture (`lireLogoBoutique`).
 *
 * Une colonne ajoutée à `stores` doit être ajoutée ici pour être lue.
 */
export const COLONNES_BOUTIQUE_SANS_LOGO = [
  "id",
  "name",
  "subtitle",
  "address",
  "phone",
  "email",
  "nif_stat",
  "receipt_footer",
  "currency_symbol",
  "tva_rate",
  "owner_id",
  "suppliers",
  "enable_pin_security",
  "created_at",
  "updated_at",
  "capital_initial",
  "seuil_alerte_tresorerie",
  "activation_status",
  "trial_ends_at",
  "activated_at",
  "personnalisation",
  "abonnement_jusqu_au",
  "marque_id",
].join(",");

export interface BoutiquesDuCompte {
  owned: Store[];
  memberStoreList: Store[];
  roles: Record<string, string>;
  permissionsDetailed: Record<string, PermissionsMap>;
}

/** Boutiques possédées et collaborations, lues en parallèle, sans logo. */
export async function lireBoutiquesDuCompte(userId: string): Promise<BoutiquesDuCompte> {
  const [ownedRes, membershipsRes] = await Promise.all([
    supabase
      .from("stores")
      .select(COLONNES_BOUTIQUE_SANS_LOGO)
      .eq("owner_id", userId)
      .order("created_at"),
    supabase
      .from("store_members")
      .select(`*, store:stores(${COLONNES_BOUTIQUE_SANS_LOGO})`)
      .eq("user_id", userId),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (membershipsRes.error) throw membershipsRes.error;

  const owned = (ownedRes.data ?? []) as unknown as Store[];
  const memberships = (membershipsRes.data ?? []) as any[];
  const memberStoreList = memberships.map((m) => m.store as Store).filter(Boolean);

  const roles: Record<string, string> = {};
  const permissionsDetailed: Record<string, PermissionsMap> = {};
  memberships.forEach((m) => {
    if (m.store_id) {
      roles[m.store_id] = m.role;
      // normalizePermissions() gère aussi bien l'ancien format (tableau
      // de clés) que le nouveau (carte détaillée) — aucune donnée
      // existante n'est perdue lors de cette mise à niveau.
      permissionsDetailed[m.store_id] = normalizePermissions(m.permissions);
    }
  });

  return { owned, memberStoreList, roles, permissionsDetailed };
}

export type LectureEspace = [BoutiquesDuCompte, string | null, AccesMarque];

/** Tout ce que l'espace de travail attend avant de s'ouvrir, en une fois. */
export function lireEspace(userId: string): Promise<LectureEspace> {
  return Promise.all([
    lireBoutiquesDuCompte(userId),
    boutiqueDuDomaineCourant(),
    lireAccesMarque(),
  ]);
}

/**
 * PRÉCHARGEMENT.
 *
 * L'espace de travail n'est monté qu'une fois le profil lu (voir
 * BalsamaApp) : ses requêtes partaient donc APRÈS celle du profil, alors
 * qu'elles n'en ont pas besoin — l'identifiant du compte suffit. Le
 * préchargement les lance dès que la session est connue, en même temps
 * que le profil ; l'espace de travail reprend la réponse déjà en route au
 * lieu d'en demander une seconde.
 *
 * Une lecture n'est reprise qu'une fois, pour le même compte, et tant
 * qu'elle est fraîche : au-delà, l'espace relit normalement.
 */
const FRAICHEUR_MS = 30_000;
let precharge: { userId: string; depuis: number; lecture: Promise<LectureEspace> } | null = null;

export function prechargerEspace(userId: string): void {
  if (precharge?.userId === userId && Date.now() - precharge.depuis < FRAICHEUR_MS) return;
  let lecture: Promise<LectureEspace>;
  try {
    lecture = lireEspace(userId);
  } catch (e) {
    lecture = Promise.reject(e);
  }
  // L'erreur sera remontée à qui reprend la lecture ; ici, rien ne l'attend.
  lecture.catch(() => {});
  precharge = { userId, depuis: Date.now(), lecture };
}

/** La lecture préchargée pour ce compte, si elle est fraîche — reprise une seule fois. */
export function reprendreEspacePrecharge(userId: string): Promise<LectureEspace> | null {
  const p = precharge;
  precharge = null;
  if (!p || p.userId !== userId || Date.now() - p.depuis >= FRAICHEUR_MS) return null;
  return p.lecture;
}

/** Le logo d'une seule boutique, lu après l'ouverture. */
export async function lireLogoBoutique(storeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("logo_url")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return (data as { logo_url: string | null } | null)?.logo_url ?? null;
}
