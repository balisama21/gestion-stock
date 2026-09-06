import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Store, Sparkles, UserPlus, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import { supabase } from "../lib/supabase";
import { MotSymbole } from "./shared/MotSymbole";

/**
 * Affiché quand un utilisateur est authentifié mais ne possède/rejoint
 * encore AUCUNE boutique (nouveau compte fraîchement créé, avant
 * l'ancien blocage par paiement — supprimé le 18/08/2026). Trois choix :
 *   A. Créer sa propre boutique → devient owner, essai gratuit 7 jours.
 *   B. Rejoindre une boutique existante via un lien d'invitation reçu.
 *   C. Rejoindre avec un code d'invitation (alternative au lien, utile
 *      tant que l'envoi automatique par e-mail reste peu fiable sans
 *      domaine pro configuré).
 */
export const CreateStoreOnboarding: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { createStore, refreshStores, switchStore } = useWorkspace();

  const [storeName, setStoreName] = useState(
    profile?.full_name ? `Boutique de ${profile.full_name}` : "",
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joiningWithCode, setJoiningWithCode] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim() || creating) return;

    setCreating(true);
    setError(null);
    const { error: createError } = await createStore({ name: storeName.trim() });
    setCreating(false);

    if (createError) {
      setError(createError);
    }
    // Pas besoin de rediriger manuellement : dès que le workspace a une
    // boutique active, BalsamaApp.tsx bascule automatiquement vers
    // l'application complète.
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joiningWithCode) return;

    setJoiningWithCode(true);
    setJoinCodeError(null);
    const { data, error: rpcError } = await supabase.rpc("accept_invitation_by_code", {
      p_code: joinCode.trim(),
    });
    setJoiningWithCode(false);

    if (rpcError) {
      setJoinCodeError(rpcError.message || "Code invalide.");
      return;
    }

    await refreshStores();
    if (data?.store_id) {
      switchStore(data.store_id);
    }
    // BalsamaApp.tsx bascule automatiquement vers l'app dès que
    // workspace.activeStore existe.
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-success-soft blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          {/* Le logo lui-même, plutôt qu'un carré dégradé et une icône
              générique : c'est la marque que l'on doit reconnaître ici. */}
          <img src="/logo.svg" alt="" width={71} height={52} className="mx-auto mb-4 h-13 w-auto" />
          <MotSymbole hauteur={34} className="mb-3 text-foreground" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bienvenue{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} !
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Créez votre boutique pour commencer — ou rejoignez-en une si vous avez été invité.
          </p>
        </div>

        <div className="app-card p-6 sm:p-8" style={{ boxShadow: "var(--elev-3)" }}>
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-success-border bg-success-soft">
              <Store className="h-4 w-4 t-success" />
            </div>
            <h2 className="font-bold text-foreground">Créer ma boutique</h2>
          </div>

          <form onSubmit={handleCreateStore} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nom de la boutique
              </label>
              <input
                type="text"
                required
                autoFocus
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Ma Quincaillerie"
                className="app-field"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-success-border bg-success-soft px-3.5 py-2.5 text-xs t-success">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>7 jours d'essai gratuit inclus, sans paiement à l'inscription.</span>
            </div>

            {error && <p className="text-center text-sm font-medium t-danger">{error}</p>}

            <button type="submit" disabled={creating} className="app-btn-primary w-full">
              {creating ? "Création..." : "Créer ma boutique"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Link
            to="/accept-invite"
            search={{ token: undefined }}
            className="app-btn-secondary w-full"
          >
            <UserPlus className="w-4 h-4" />
            J'ai un lien d'invitation
          </Link>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleJoinWithCode} className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="w-3.5 h-3.5" />
              J'ai un code d'invitation
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="INV-XXXX-XXXX"
                className="app-field flex-1 text-center font-mono tracking-widest"
              />
              <button
                type="submit"
                disabled={joiningWithCode || !joinCode.trim()}
                className="app-btn-secondary shrink-0"
              >
                {joiningWithCode ? "..." : "Rejoindre"}
              </button>
            </div>
            {joinCodeError && (
              <p className="text-center text-sm font-medium t-danger">{joinCodeError}</p>
            )}
          </form>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex w-full items-center justify-center gap-1.5 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="w-3.5 h-3.5" />
          Me déconnecter
        </button>
      </div>
    </div>
  );
};