import React, { useState, useEffect, useCallback } from "react";
import { Delete, KeyRound, Lock, Package, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { APP_NAME } from "../lib/appConfig";

interface PinLockScreenProps {
  onUnlock: () => void;
}

type ScreenMode = "pin" | "forgot";

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const { profile, user, signOut, reauthenticate, refreshProfile } = useAuth();
  const [mode, setMode] = useState<ScreenMode>("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const masterPin = profile?.pin_hash || "1234";

  // "Code PIN oublié ?" — réinitialisation protégée par le mot de passe
  // du compte (jamais un simple "oubli" sans vérification).
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 6) return;
      const next = pin + digit;
      setPin(next);
      setError(false);

      if (next.length >= masterPin.length) {
        if (next === masterPin) {
          onUnlock();
        } else {
          setError(true);
          setShake(true);
          setTimeout(() => {
            setPin("");
            setShake(false);
          }, 500);
        }
      }
    },
    [pin, masterPin, onUnlock],
  );

  const handleBackspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  }, []);

  useEffect(() => {
    if (mode !== "pin") return;
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, handleDigit, handleBackspace]);

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!resetPassword) {
      setResetError("Entrez votre mot de passe pour confirmer.");
      return;
    }
    if (!user) {
      setResetError("Session invalide. Reconnectez-vous.");
      return;
    }

    setResetLoading(true);
    try {
      const { error: reauthError } = await reauthenticate(resetPassword);
      if (reauthError) {
        setResetError(reauthError);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ pin_hash: null })
        .eq("id", user.id);

      if (updateError) {
        setResetError("Erreur lors de la réinitialisation : " + updateError.message);
        return;
      }

      await refreshProfile();
      // Plus aucun PIN n'est requis : l'accès est débloqué directement.
      // L'utilisateur pourra en redéfinir un depuis Paramètres > Sécurité.
      onUnlock();
    } finally {
      setResetLoading(false);
    }
  };

  const dots = Array.from({ length: Math.max(4, masterPin.length) });
  const firstName = profile?.full_name?.split(" ")[0] || "utilisateur";
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(2,6,23,0.6))]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 p-8">
          {mode === "pin" ? (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-5 shadow-lg shadow-emerald-500/25 ring-1 ring-white/10">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-[0.2em] mb-2">
                  {APP_NAME}
                </p>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Session verrouillée
                </h1>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                    {initial}
                  </div>
                  <p className="text-sm text-slate-400">
                    Bonjour <span className="text-slate-200 font-semibold">{firstName}</span>,
                    entrez votre PIN
                  </p>
                </div>
              </div>

              <div
                className={`flex justify-center gap-4 mb-8 transition-transform ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
              >
                {dots.map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                      i < pin.length
                        ? error
                          ? "border-red-500 bg-red-500 scale-110"
                          : "border-emerald-400 bg-emerald-400 scale-110"
                        : "border-slate-700 bg-transparent"
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => (
                  <button
                    key={key || "empty"}
                    type="button"
                    disabled={key === ""}
                    onClick={() =>
                      key === "del" ? handleBackspace() : key !== "" ? handleDigit(key) : undefined
                    }
                    className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 flex items-center justify-center ${
                      key === ""
                        ? "cursor-default opacity-0"
                        : key === "del"
                          ? "bg-slate-800/70 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/80"
                          : "bg-slate-800/50 text-white hover:bg-slate-700/80 border border-slate-700/60 hover:border-emerald-500/50 shadow-sm"
                    }`}
                  >
                    {key === "del" ? <Delete className="w-5 h-5" /> : key}
                  </button>
                ))}
              </div>

              <div className="h-5 mb-2">
                {error && (
                  <div className="flex items-center justify-center gap-1.5 text-red-400 text-sm font-medium">
                    <Lock className="w-3.5 h-3.5" />
                    Code PIN incorrect
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setResetError(null);
                  setResetPassword("");
                }}
                className="block w-full text-center text-sm text-emerald-400/90 hover:text-emerald-300 font-medium transition-colors py-2"
              >
                Code PIN oublié ?
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode("pin")}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour au code PIN
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/15 border border-amber-500/25 rounded-2xl mb-4">
                  <KeyRound className="w-6 h-6 text-amber-400" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Réinitialiser le code PIN
                </h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Confirmez avec votre mot de passe pour supprimer le code PIN actuel. Vous
                  pourrez en définir un nouveau depuis les Paramètres.
                </p>
              </div>

              <form onSubmit={handleResetPin} className="space-y-4">
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Mot de passe du compte"
                    autoComplete="current-password"
                    autoFocus
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showResetPassword ? "Masquer" : "Afficher"}
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {resetError && (
                  <p className="text-red-400 text-sm font-medium text-center">{resetError}</p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                >
                  {resetLoading ? "Vérification..." : "Réinitialiser le code PIN"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs mt-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sécurité renforcée par code PIN</span>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="block w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-3 mt-1"
        >
          Me déconnecter complètement
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};
