import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, Store, Sparkles, UserPlus, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useWorkspace } from "../hooks/useWorkspace";
import { APP_NAME } from "../lib/appConfig";

/**
 * Affiché quand un utilisateur est authentifié mais ne possède/rejoint
 * encore AUCUNE boutique (nouveau compte fraîchement créé, avant
 * l'ancien blocage par paiement — supprimé le 18/08/2026). Deux choix,
 * comme prévu dans l'architecture cible :
 *   A. Créer sa propre boutique → devient owner, essai gratuit 7 jours.
 *   B. Rejoindre une boutique existante via une invitation reçue.
 */
export const CreateStoreOnboarding: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { createStore } = useWorkspace();

  const [storeName, setStoreName] = useState(
    profile?.full_name ? `Boutique de ${profile.full_name}` : "",
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-5 shadow-lg shadow-emerald-500/25 ring-1 ring-white/10">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-[0.2em] mb-2">
            {APP_NAME}
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bienvenue{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} !
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Créez votre boutique pour commencer — ou rejoignez-en une si vous avez été invité.
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 p-8">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Store className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <h2 className="font-bold text-white">Créer ma boutique</h2>
          </div>

          <form onSubmit={handleCreateStore} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Nom de la boutique
              </label>
              <input
                type="text"
                required
                autoFocus
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Ma Quincaillerie"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300/90">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>7 jours d'essai gratuit inclus, sans paiement à l'inscription.</span>
            </div>

            {error && <p className="text-red-400 text-sm font-medium text-center">{error}</p>}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {creating ? "Création..." : "Créer ma boutique"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">ou</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <Link
            to="/accept-invite"
            search={{ token: undefined }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            J'ai un lien d'invitation
          </Link>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors py-4 mt-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          Me déconnecter
        </button>
      </div>
    </div>
  );
};