import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isFounder: boolean;
  isActivated: boolean;
  profileError: string | null;
  isPasswordRecovery: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  /**
   * "Continuer avec Google" — redirige vers Google puis revient sur l'app.
   * Ne court-circuite jamais le système de boutiques/rôles : un nouvel
   * utilisateur Google atterrit sur le même écran d'onboarding
   * (CreateStoreOnboarding) qu'un utilisateur email/mot de passe.
   */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  activateWithCode: (code: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
  /**
   * Revérifie le mot de passe ACTUEL du compte connecté (re-authentification).
   * Utilisé comme barrage de sécurité avant toute action sensible :
   * changer de mot de passe, supprimer le compte, etc. Ne modifie rien,
   * se contente de confirmer que le mot de passe saisi est correct.
   */
  reauthenticate: (currentPassword: string) => Promise<{ error: string | null }>;
  /** Supprime définitivement le compte connecté (irréversible). */
  deleteAccount: () => Promise<{ error: string | null }>;
}

export type AuthContext = AuthState & AuthActions;

const authContext = createContext<AuthContext | null>(null);

export function useAuth(): AuthContext {
  const ctx = useContext(authContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { authContext };

export function useAuthState(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Profile fetch error:", error);
      setProfileError("Fetch error: " + error.message);
      return;
    }

    if (data) {
      setProfile(data);
      setProfileError(null);
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const fallbackProfile = {
        id: userId,
        email: userData.user?.email ?? "",
        full_name:
          userData.user?.user_metadata?.full_name ??
          userData.user?.email?.split("@")[0] ??
          "Utilisateur",
        phone: userData.user?.phone ?? null,
        role: "pending",
        status: "pending",
        store_id: null,
        pin_hash: null,
        session_timeout_minutes: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" })
        .select("*")
        .single();

      if (!insertError && inserted) {
        setProfile(inserted);
        setProfileError(null);
      } else if (insertError) {
        setProfileError("Insert error: " + insertError.message);
      }
    } catch (createError: any) {
      console.error("Profile creation fallback failed:", createError);
      setProfileError("Catch error: " + createError.message);
    }
  }, []);

  useEffect(() => {
    // Initialize session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === "PASSWORD_RECOVERY") {
        // L'utilisateur a cliqué sur le lien de réinitialisation reçu par
        // e-mail. Supabase crée une session temporaire réservée à la
        // définition d'un nouveau mot de passe : on ne doit pas laisser
        // le reste de l'app traiter ça comme une connexion normale tant
        // que le nouveau mot de passe n'a pas été défini.
        setIsPasswordRecovery(true);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Ramène l'utilisateur à la racine après authentification Google ;
        // App() (BalsamaApp.tsx) prend alors le relais normalement (même
        // logique que pour un compte email/mot de passe : boutique
        // existante → dashboard, aucune boutique → CreateStoreOnboarding).
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  // ACTIVATION : passe désormais exclusivement par la fonction RPC
  // `redeem_access_code`, côté base. Cette fonction (SECURITY DEFINER,
  // avec verrouillage FOR UPDATE sur le code) :
  //   1. valide le code (existence, statut, expiration, propriétaire) ;
  //   2. crée une boutique dédiée à l'utilisateur s'il n'en a pas déjà une ;
  //   3. passe son profil en role='founder' + status='activated' + store_id ;
  //   4. marque le code comme 'used'.
  // Ne JAMAIS revenir à des updates manuels sur `profiles`/`access_codes`
  // ici : cela contourne la création de boutique et laisse le compte
  // bloqué sans store_id (bug corrigé le 17/08/2026).
  const activateWithCode = useCallback(
    async (code: string) => {
      if (!user) {
        return { error: "Vous devez être connecté pour activer votre compte." };
      }

      const normalizedCode = code.toUpperCase().trim();

      const { error } = await supabase.rpc("redeem_access_code", {
        p_code: normalizedCode,
      });

      if (error) {
        return { error: error.message || "Erreur lors de l'activation. Veuillez réessayer." };
      }

      await fetchProfile(user.id);
      return { error: null };
    },
    [user, fetchProfile],
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  // Revérifie le mot de passe actuel en retentant une connexion avec les
  // identifiants du compte connecté. Ne touche pas à la session existante
  // au-delà de ce que Supabase fait normalement lors d'un signIn (elle est
  // simplement rafraîchie si le mot de passe est correct).
  const reauthenticate = useCallback(
    async (currentPassword: string) => {
      if (!user?.email) {
        return { error: "Session invalide. Reconnectez-vous et réessayez." };
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (error) {
        return { error: "Mot de passe actuel incorrect." };
      }
      return { error: null };
    },
    [user],
  );

  // Suppression définitive et irréversible du compte connecté (RPC
  // `delete_own_account`, voir migration du 18/08/2026). L'appelant DOIT
  // avoir déjà revérifié le mot de passe via `reauthenticate` avant
  // d'appeler cette fonction.
  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      return { error: error.message || "Erreur lors de la suppression du compte." };
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    return { error: null };
  }, []);

  const isFounder = profile?.role === "founder";
  const isActivated = profile?.status === "activated" || isFounder;

  return {
    user,
    session,
    profile,
    loading,
    isFounder,
    isActivated,
    profileError,
    isPasswordRecovery,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    activateWithCode,
    refreshProfile,
    resetPasswordForEmail,
    updatePassword,
    clearPasswordRecovery,
    reauthenticate,
    deleteAccount,
  };
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();
  return <authContext.Provider value={authState}>{children}</authContext.Provider>;
}