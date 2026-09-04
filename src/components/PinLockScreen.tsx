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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-success-soft blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-info-soft blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="app-card p-6 sm:p-8" style={{ boxShadow: "var(--elev-3)" }}>
          {mode === "pin" ? (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-5 shadow-lg shadow-emerald-500/25 ">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <p className="text-[11px] font-bold t-success uppercase tracking-[0.2em] mb-2">
                  {APP_NAME}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Session verrouillée
                </h1>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <div className="w-6 h-6 rounded-full border border-success-border bg-success-soft flex items-center justify-center text-[11px] font-bold t-success">
                    {initial}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Bonjour <span className="font-semibold text-foreground">{firstName}</span>,
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
                          ? "border-danger bg-danger scale-110"
                          : "border-success bg-success scale-110"
                        : "border-border bg-transparent"
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
                          ? "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-border"
                          : "bg-muted text-foreground hover:bg-accent border border-border hover:border-success-border shadow-sm"
                    }`}
                  >
                    {key === "del" ? <Delete className="w-5 h-5" /> : key}
                  </button>
                ))}
              </div>

              <div className="h-5 mb-2">
                {error && (
                  <div className="flex items-center justify-center gap-1.5 t-danger text-sm font-medium">
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
                className="block w-full text-center text-sm t-success hover:underline font-medium transition-colors py-2"
              >
                Code PIN oublié ?
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode("pin")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour au code PIN
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 border border-warning-border bg-warning-soft rounded-2xl mb-4">
                  <KeyRound className="w-6 h-6 t-warning" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Réinitialiser le code PIN
                </h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
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
                    className="app-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  <p className="t-danger text-sm font-medium text-center">{resetError}</p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="app-btn-primary w-full"
                >
                  {resetLoading ? "Vérification..." : "Réinitialiser le code PIN"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs mt-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sécurité renforcée par code PIN</span>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-3 mt-1"
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
