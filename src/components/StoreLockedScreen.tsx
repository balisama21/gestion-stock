import React, { useState } from "react";
import { Lock, KeyRound, Phone, LogOut, Package } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { APP_NAME } from "../lib/appConfig";

interface StoreLockedScreenProps {
  storeName: string;
  storeId: string;
  onActivated: () => Promise<void> | void;
}

const MVOLA_NUMBER = "0389723412";
const ADMIN_CONTACT = "+261 38 97 234 12";

/**
 * Affiché à la place de TOUTE l'application quand la boutique active est
 * verrouillée (essai de 7 jours expiré sans activation). Le vrai blocage
 * est déjà assuré côté Supabase par les RLS (voir migration
 * enforce_store_lock_in_rls) — cet écran est l'expérience utilisateur,
 * pas la barrière de sécurité elle-même.
 */
export const StoreLockedScreen: React.FC<StoreLockedScreenProps> = ({
  storeName,
  storeId,
  onActivated,
}) => {
  const { signOut } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = code.toUpperCase().trim();
    if (!normalized) {
      setError("Entrez un code d'activation.");
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc("activate_store_with_code", {
        p_store_id: storeId,
        p_code: normalized,
      });
      if (rpcError) {
        setError(rpcError.message || "Code invalide ou déjà utilisé.");
        return;
      }
      await onActivated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.10),transparent_60%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-rose-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-500/15 border border-rose-500/25 rounded-2xl mb-5">
              <Lock className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-[11px] font-bold text-rose-400/90 uppercase tracking-[0.2em] mb-2">
              {APP_NAME}
            </p>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Votre période d'essai est terminée
            </h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              <span className="text-slate-200 font-semibold">{storeName}</span> est
              temporairement verrouillée. Activez-la pour retrouver un accès normal.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-2.5 mb-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">Activer par paiement</span>
            </div>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Payez 100 000 Ar via MVola, puis envoyez la référence à l'administrateur pour
              recevoir votre code.
            </p>
            <div className="bg-slate-900/70 rounded-xl p-3 text-center mb-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">MVola</p>
              <p className="text-lg font-mono font-bold text-white tracking-wider">
                {MVOLA_NUMBER}
              </p>
            </div>
            <a
              href={`tel:${ADMIN_CONTACT.replace(/\s/g, "")}`}
              className="flex items-center justify-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <Phone className="w-3.5 h-3.5" />
              {ADMIN_CONTACT}
            </a>
          </div>

          <form onSubmit={handleActivate} className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wide">
              <KeyRound className="w-3.5 h-3.5" />
              Code d'activation
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BLSM-XXXX-XXXX"
              maxLength={20}
              autoFocus
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-mono tracking-widest text-center placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
            />
            {error && (
              <p className="text-rose-400 text-sm font-medium text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              {loading ? "Vérification..." : "Activer ma boutique"}
            </button>
          </form>
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