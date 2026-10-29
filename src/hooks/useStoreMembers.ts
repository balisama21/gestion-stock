import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface StoreMemberWithProfile {
  id: string; // store_members.id
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string | null;
  email: string;
}

/**
 * Charge les vrais membres (collaborateurs) d'une boutique donnée,
 * avec leur nom/email récupérés depuis "profiles".
 * C'est la source de vérité pour "qui fait partie de l'équipe",
 * indépendamment de l'historique des ventes/dépenses en texte libre.
 */
export function useStoreMembers(storeId: string | null) {
  const [members, setMembers] = useState<StoreMemberWithProfile[]>([]);
  /**
   * Le responsable du compte, qui n'est jamais dans `store_members`.
   * Chargé pour tous : un invité doit pouvoir le reconnaître dans
   * l'historique, et ne pas le prendre pour un vendeur sans compte.
   */
  const [proprietaire, setProprietaire] = useState<{
    user_id: string;
    nom: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setMembers([]);
      setProprietaire(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("store_members")
      .select("id, user_id, role, joined_at, profile:profiles!user_id(full_name, email)")
      .eq("store_id", storeId);

    if (fetchError) {
      setError(fetchError.message);
      setMembers([]);
    } else {
      setMembers(
        (data ?? []).map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          full_name: m.profile?.full_name ?? null,
          email: m.profile?.email ?? "",
        })),
      );
    }

    // Lisible par tout membre de la boutique (politique « teammates »
    // sur `profiles`). Un échec ne bloque rien : le nom reste inconnu.
    const { data: boutique } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", storeId)
      .maybeSingle();
    if (boutique?.owner_id) {
      const { data: profil } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", boutique.owner_id)
        .maybeSingle();
      const nom = (profil?.full_name || profil?.email || "").trim();
      setProprietaire(nom ? { user_id: boutique.owner_id, nom } : null);
    } else {
      setProprietaire(null);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const removeMember = useCallback(async (memberId: string) => {
    const { error: deleteError } = await supabase.from("store_members").delete().eq("id", memberId);

    if (deleteError) return { error: deleteError.message };
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    return { error: null };
  }, []);

  return { members, proprietaire, loading, error, refresh: load, removeMember };
}
