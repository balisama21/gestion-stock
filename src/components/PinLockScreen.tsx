import React, { useState, useEffect, useCallback } from "react";
import { Lock, Package, Shield } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { APP_NAME } from "../lib/appConfig";

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const { profile, signOut } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const masterPin = profile?.pin_hash || "1234";

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
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleBackspace]);

  const dots = Array.from({ length: Math.max(4, masterPin.length) });
  const firstName = profile?.full_name?.split(" ")[0] || "utilisateur";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-5 shadow-xl shadow-emerald-500/20">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs font-semibold text-emerald-500/80 uppercase tracking-widest mb-2">
            {APP_NAME}
          </p>
          <h1 className="text-2xl font-bold text-white">Session verrouillée</h1>
          <p className="text-sm text-slate-400 mt-2">
            Bonjour <span className="text-slate-200 font-medium">{firstName}</span>, entrez votre
            PIN
          </p>
        </div>

        <div
          className={`flex justify-center gap-4 mb-10 transition-transform ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        >
          {dots.map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? error
                    ? "border-red-500 bg-red-500 scale-110"
                    : "border-emerald-400 bg-emerald-400 scale-110"
                  : "border-slate-600 bg-transparent"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
            <button
              key={key || "empty"}
              type="button"
              disabled={key === ""}
              onClick={() =>
                key === "⌫" ? handleBackspace() : key !== "" ? handleDigit(key) : undefined
              }
              className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
                key === ""
                  ? "cursor-default opacity-0"
                  : key === "⌫"
                    ? "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                    : "bg-slate-800/60 text-white hover:bg-slate-700 border border-slate-700/80 hover:border-emerald-500/40 shadow-sm"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-400 text-sm font-medium mb-4">
            <Lock className="w-4 h-4" />
            Code PIN incorrect
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-slate-500 text-xs mb-8">
          <Shield className="w-3.5 h-3.5" />
          <span>Sécurité renforcée par code PIN</span>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="block w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
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
