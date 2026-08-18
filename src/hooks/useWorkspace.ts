import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { useAuth } from "./useAuth";

type Store = Database["public"]["Tables"]["stores"]["Row"];
type StoreMember = Database["public"]["Tables"]["store_members"]["Row"] & {
  store: Store;
};

interface WorkspaceState {
  /** La boutique actuellement active (contexte de travail) */
  activeStore: Store | null;
  /** Toutes les boutiques accessibles (propres + collaborations) */
  accessibleStores: Store[];
  /** Est-ce que l'utilisateur est propriétaire de la boutique active ? */
  isOwner: boolean;
  /** Rôle dans la boutique active (si collaborateur) */
  memberRole: string | null;
  loading: boolean;
  error: string | null;
}

interface WorkspaceActions {
  switchStore: (storeId: string) => void;
  refreshStores: () => Promise<void>;
  createStore: (data: Partial<Store>) => Promise<{ store: Store | null; error: string | null }>;
  updateStore: (
    storeId: string,
    updates: Partial<Store>,
  ) => Promise<{ store: Store | null; error: string | null }>;
}

export type WorkspaceContext = WorkspaceState & WorkspaceActions;

const workspaceContext = createContext<WorkspaceContext | null>(null);

export function useWorkspace(): WorkspaceContext {
  const ctx = useContext(workspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export { workspaceContext };

export function useWorkspaceState(): WorkspaceContext {
  const { user, profile } = useAuth();
  const [ownedStore, setOwnedStore] = useState<Store | null>(null);
  const [memberStores, setMemberStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Charger la boutique possédée
      const { data: owned, error: ownedError } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (ownedError) throw ownedError;
      setOwnedStore(owned ?? null);

      // 2. Charger les boutiques en tant que membre (collaborateur)
      const { data: memberships, error: membError } = await supabase
        .from("store_members")
        .select("*, store:stores(*)")
        .eq("user_id", user.id);

      if (membError) throw membError;

      const memberStoreList = (memberships ?? []).map((m: any) => m.store as Store).filter(Boolean);
      setMemberStores(memberStoreList);

      // Stocker les rôles
      const roles: Record<string, string> = {};
      (memberships ?? []).forEach((m: any) => {
        if (m.store_id) roles[m.store_id] = m.role;
      });
      setMemberRoles(roles);

      // 3. Définir la boutique active par défaut
      if (!activeStoreId) {
        const defaultId = owned?.id ?? memberStoreList[0]?.id ?? null;
        setActiveStoreId(defaultId);
      }
    } catch (err: any) {
      setError(err.message ?? "Erreur lors du chargement des boutiques.");
    } finally {
      setLoading(false);
    }
  }, [user, activeStoreId]);

  useEffect(() => {
    loadStores();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allStores = [
    ...(ownedStore ? [ownedStore] : []),
    ...memberStores.filter((s) => s.id !== ownedStore?.id),
  ];

  const activeStore = allStores.find((s) => s.id === activeStoreId) ?? null;
  const isOwner = activeStore?.owner_id === user?.id;
  const memberRole = activeStore ? (memberRoles[activeStore.id] ?? null) : null;

  const switchStore = useCallback((storeId: string) => {
    setActiveStoreId(storeId);
  }, []);

  const refreshStores = useCallback(async () => {
    // Force reload without cached activeStoreId constraint
    setLoading(true);
    setError(null);
    try {
      const { data: owned } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user?.id ?? "")
        .maybeSingle();
      setOwnedStore(owned ?? null);

      const { data: memberships } = await supabase
        .from("store_members")
        .select("*, store:stores(*)")
        .eq("user_id", user?.id ?? "");
      const memberStoreList = (memberships ?? []).map((m: any) => m.store as Store).filter(Boolean);
      setMemberStores(memberStoreList);

      const roles: Record<string, string> = {};
      (memberships ?? []).forEach((m: any) => {
        if (m.store_id) roles[m.store_id] = m.role;
      });
      setMemberRoles(roles);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const createStore = useCallback(
    async (data: Partial<Store>): Promise<{ store: Store | null; error: string | null }> => {
      if (!user) return { store: null, error: "Non authentifié." };

      const payload = {
        name: data.name ?? "Ma Boutique",
        subtitle: data.subtitle ?? null,
        owner_id: user.id,
        currency_symbol: data.currency_symbol ?? "Ar",
        tva_rate: data.tva_rate ?? 0,
        suppliers: data.suppliers ?? [],
        enable_pin_security: data.enable_pin_security ?? true,
        capital_initial: (data as any).capital_initial ?? 0,
        seuil_alerte_tresorerie: (data as any).seuil_alerte_tresorerie ?? 50000,
      };

      const { data: created, error } = await supabase
        .from("stores")
        .insert(payload as any)
        .select("*")
        .single();

      if (error) return { store: null, error: error.message };

      // Mettre à jour le profil avec le store_id
      await supabase.from("profiles").update({ store_id: created.id }).eq("id", user.id);

      setOwnedStore(created);
      setActiveStoreId(created.id);
      return { store: created, error: null };
    },
    [user],
  );

  const updateStore = useCallback(
    async (
      storeId: string,
      updates: Partial<Store>,
    ): Promise<{ store: Store | null; error: string | null }> => {
      const { data: updated, error } = await supabase
        .from("stores")
        .update(updates as any)
        .eq("id", storeId)
        .select("*")
        .single();

      if (error) return { store: null, error: error.message };

      // Refléter la mise à jour dans l'état local (boutique possédée ou boutique membre)
      setOwnedStore((prev) => (prev && prev.id === storeId ? (updated as Store) : prev));
      setMemberStores((prev) => prev.map((s) => (s.id === storeId ? (updated as Store) : s)));

      return { store: updated as Store, error: null };
    },
    [],
  );

  return {
    activeStore,
    accessibleStores: allStores,
    isOwner,
    memberRole,
    loading,
    error,
    switchStore,
    refreshStores,
    createStore,
    updateStore,
  };
}
