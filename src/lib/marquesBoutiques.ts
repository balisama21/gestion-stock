import type { Database } from "./database.types";
import { estHoteParDefaut, normaliserHote } from "./marque";
import { supabase } from "./supabase";

/**
 * Séparation des marques : sur un domaine client, uniquement les
 * boutiques de cette marque ; ailleurs, uniquement celles sans étiquette.
 * La base fait foi (stores.marque_id, acces_a_la_marque) ; ce module ne
 * fait que trier ce qu'elle renvoie.
 */

type Store = Database["public"]["Tables"]["stores"]["Row"];

export interface AccesMarque {
  /** Marque du domaine visité ; `null` sur les domaines sans marque cliente. */
  marqueId: string | null;
  /** Compte inscrit (user_id) dans la liste de la marque : peut y créer des boutiques. */
  proprietaire: boolean;
}

export const ACCES_SANS_MARQUE: AccesMarque = { marqueId: null, proprietaire: false };

export const hoteVisite = (): string =>
  typeof window === "undefined" ? "" : normaliserHote(window.location.hostname);

export async function lireAccesMarque(): Promise<AccesMarque> {
  const hote = hoteVisite();
  if (estHoteParDefaut(hote)) return ACCES_SANS_MARQUE;
  const { data, error } = await supabase.rpc("acces_a_la_marque", { p_hote: hote });
  if (error) throw error;
  const ligne = (data as { marque_id: string | null; proprietaire: boolean }[] | null)?.[0];
  return { marqueId: ligne?.marque_id ?? null, proprietaire: ligne?.proprietaire === true };
}

/** Boutiques de la marque du domaine ; l'admin plateforme voit tout. */
export function boutiquesDuDomaine<T extends Partial<Pick<Store, "marque_id">>>(
  boutiques: T[],
  marqueId: string | null,
  adminPlateforme: boolean,
): T[] {
  if (adminPlateforme) return boutiques;
  return boutiques.filter((b) => (b.marque_id ?? null) === marqueId);
}

/** Création permise : partout hors marque cliente, aux seuls propriétaires listés ailleurs. */
export const peutCreerUneBoutique = (acces: AccesMarque): boolean =>
  acces.marqueId === null || acces.proprietaire;
