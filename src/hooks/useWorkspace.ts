import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { useAuth } from "./useAuth";
import {
  normalizePermissions,
  permissionsToVisibleModules,
  type PermissionsMap,
} from "../lib/permissions";

type Store = Database["public"]["Tables"]["stores"]["Row"];

interface WorkspaceState {
  /** La boutique actuellement active (contexte de travail) */
  activeStore: Store | null;
  /** Toutes les boutiques accessibles (propres + collaborations) */
  accessibleStores: Store[];
  /** Est-ce que l'utilisateur est propriétaire de la boutique active ? */
  isOwner: boolean;
  /** Rôle dans la boutique active (si collaborateur) */
  memberRole: string | null;
  /**
   * Permissions accordées dans la boutique active — `null` si owner
   * (accès total, illimité), sinon la liste des clés de modules VISIBLES
   * choisies par le propriétaire (vue "à plat", rétro-compatible avec le
   * système v1). Voir src/lib/permissions.ts.
   */
  memberPermissions: string[] | null;
  /**
   * Nouvelle carte détaillée (visibilité + portée + actions + champs) —
   * `null` si owner. Utilisée progressivement module par module au fur
   * et à mesure de la mise à niveau vers le système de permissions v2.
   */
  memberPermissionsDetailed: PermissionsMap | null;
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
  /**
   * Copie une boutique possédée (config uniquement : nom donné par
   * l'utilisateur, devise, TVA, fournisseurs, adresse... jamais les
   * produits/ventes). L'activation est héritée de façon sécurisée côté
   * Supabase (RPC copy_store) : une boutique active reste active, une
   * boutique en essai ne génère jamais un nouvel essai complet.
   */
  copyStore: (
    sourceStoreId: string,
    newName: string,
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

const ACTIVE_STORE_STORAGE_KEY = "balsama-active-store-id";

export function useWorkspaceState(): WorkspaceContext {
  const { user } = useAuth();
  // ÉTAPE 6 (18/08/2026) : un compte peut désormais posséder PLUSIEURS
  // boutiques. `ownedStores` est un TABLEAU (auparavant un seul objet
  // récupéré via .maybeSingle(), qui plantait dès qu'un utilisateur avait
  // 2 boutiques ou plus — c'était la cause du blocage multi-boutiques).
  const [ownedStores, setOwnedStores] = useState<Store[]>([]);
  const [memberStores, setMemberStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(null);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [memberPermissionsDetailedByStore, setMemberPermissionsDetailedByStore] = useState<
    Record<string, PermissionsMap>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitializedActiveStore, setHasInitializedActiveStore] = useState(false);

  const fetchAllStores = useCallback(async () => {
    if (!user)
      return {
        owned: [] as Store[],
        memberStoreList: [] as Store[],
        roles: {} as Record<string, string>,
        permissionsDetailed: {} as Record<string, PermissionsMap>,
      };

    const [ownedRes, membershipsRes] = await Promise.all([
      supabase.from("stores").select("*").eq("owner_id", user.id).order("created_at"),
      supabase.from("store_members").select("*, store:stores(*)").eq("user_id", user.id),
    ]);

    if (ownedRes.error) throw ownedRes.error;
    if (membershipsRes.error) throw membershipsRes.error;

    const owned = ownedRes.data ?? [];
    const memberStoreList = (membershipsRes.data ?? [])
      .map((m: any) => m.store as Store)
      .filter(Boolean);

    const roles: Record<string, string> = {};
    const permissionsDetailed: Record<string, PermissionsMap> = {};
    (membershipsRes.data ?? []).forEach((m: any) => {
      if (m.store_id) {
        roles[m.store_id] = m.role;
        // normalizePermissions() gère aussi bien l'ancien format (tableau
        // de clés) que le nouveau (carte détaillée) — aucune donnée
        // existante n'est perdue lors de cette mise à niveau.
        permissionsDetailed[m.store_id] = normalizePermissions(m.permissions);
      }
    });

    return { owned, memberStoreList, roles, permissionsDetailed };
  }, [user]);

  const loadStores = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { owned, memberStoreList, roles, permissionsDetailed } = await fetchAllStores();
      setOwnedStores(owned);
      setMemberStores(memberStoreList);
      setMemberRoles(roles);
      setMemberPermissionsDetailedByStore(permissionsDetailed);

      if (!hasInitializedActiveStore) {
        // Priorité : dernière boutique active mémorisée (localStorage) si
        // elle est toujours accessible, sinon la première boutique
        // possédée, sinon la première boutique où l'utilisateur est
        // collaborateur.
        const allIds = new Set([...owned.map((s) => s.id), ...memberStoreList.map((s) => s.id)]);
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(`${ACTIVE_STORE_STORAGE_KEY}:${user.id}`)
            : null;
        const defaultId =
          stored && allIds.has(stored) ? stored : (owned[0]?.id ?? memberStoreList[0]?.id ?? null);

        setActiveStoreIdState(defaultId);
        setHasInitializedActiveStore(true);
      }
    } catch (err: any) {
      setError(err.message ?? "Erreur lors du chargement des boutiques.");
    } finally {
      setLoading(false);
    }
  }, [user, fetchAllStores, hasInitializedActiveStore]);

  useEffect(() => {
    setHasInitializedActiveStore(false);
    setActiveStoreIdState(null);
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fusionne propriétés + collaborations, sans doublons (un cas limite
  // improbable mais possible : owner ET membre de sa propre boutique).
  const allStores = [
    ...ownedStores,
    ...memberStores.filter((s) => !ownedStores.some((o) => o.id === s.id)),
  ];

  const activeStore = allStores.find((s) => s.id === activeStoreId) ?? null;
  const isOwner = activeStore?.owner_id === user?.id;
  const memberRole = activeStore ? (memberRoles[activeStore.id] ?? null) : null;
  // Owner = accès total (null = illimité). Collaborateur = uniquement les
  // permissions choisies par le propriétaire à l'invitation.
  const memberPermissionsDetailed =
    activeStore && !isOwner ? (memberPermissionsDetailedByStore[activeStore.id] ?? {}) : null;
  // Vue "à plat" dérivée automatiquement — garde tout le code déjà écrit
  // (Header.tsx, BalsamaApp.tsx, VentesView.tsx...) fonctionnel sans
  // modification tant qu'il n'a pas été mis à niveau vers la granularité
  // fine (scope/actions/fields), module par module.
  const memberPermissions = memberPermissionsDetailed
    ? permissionsToVisibleModules(memberPermissionsDetailed)
    : null;

  const switchStore = useCallback(
    (storeId: string) => {
      setActiveStoreIdState(storeId);
      if (user && typeof window !== "undefined") {
        window.localStorage.setItem(`${ACTIVE_STORE_STORAGE_KEY}:${user.id}`, storeId);
      }
      // Best-effort, ne bloque jamais l'UI : sert uniquement de "dernière
      // boutique ouverte" pour d'éventuels usages futurs (ex: e-mails).
      // La donnée d'autorité reste toujours `stores`/`store_members`.
      if (user) {
        supabase.from("profiles").update({ store_id: storeId }).eq("id", user.id);
      }
    },
    [user],
  );

  const refreshStores = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { owned, memberStoreList, roles, permissionsDetailed } = await fetchAllStores();
      setOwnedStores(owned);
      setMemberStores(memberStoreList);
      setMemberRoles(roles);
      setMemberPermissionsDetailedByStore(permissionsDetailed);
    } catch (err: any) {
      setError(err.message ?? "Erreur lors du rafraîchissement des boutiques.");
    } finally {
      setLoading(false);
    }
  }, [user, fetchAllStores]);

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
        // activation_status / trial_ends_at ne sont volontairement PAS
        // envoyés ici : la colonne a un DEFAULT ('trial', now()+7 jours)
        // côté base (voir Étape 1), donc chaque nouvelle boutique démarre
        // automatiquement son propre essai gratuit indépendant.
      };

      const { data: created, error } = await supabase
        .from("stores")
        .insert(payload as any)
        .select("*")
        .single();

      if (error) return { store: null, error: error.message };

      // "Dernière boutique ouverte" — best effort, non bloquant.
      supabase.from("profiles").update({ store_id: created.id }).eq("id", user.id);

      setOwnedStores((prev) => [...prev, created]);
      setActiveStoreIdState(created.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${ACTIVE_STORE_STORAGE_KEY}:${user.id}`, created.id);
      }
      setHasInitializedActiveStore(true);

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

      setOwnedStores((prev) => prev.map((s) => (s.id === storeId ? (updated as Store) : s)));
      setMemberStores((prev) => prev.map((s) => (s.id === storeId ? (updated as Store) : s)));

      return { store: updated as Store, error: null };
    },
    [],
  );

  const copyStore = useCallback(
    async (
      sourceStoreId: string,
      newName: string,
    ): Promise<{ store: Store | null; error: string | null }> => {
      if (!user) return { store: null, error: "Non authentifié." };

      const { data, error } = await supabase.rpc("copy_store", {
        p_source_store_id: sourceStoreId,
        p_new_name: newName,
      });

      if (error) return { store: null, error: error.message };

      const created = data as Store;

      setOwnedStores((prev) => [...prev, created]);
      setActiveStoreIdState(created.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`${ACTIVE_STORE_STORAGE_KEY}:${user.id}`, created.id);
      }

      return { store: created, error: null };
    },
    [user],
  );

  return {
    activeStore,
    accessibleStores: allStores,
    isOwner,
    memberRole,
    memberPermissions,
    memberPermissionsDetailed,
    loading,
    error,
    switchStore,
    refreshStores,
    createStore,
    updateStore,
    copyStore,
  };
}