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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Halo décoratif : opacité faible, il fonctionne sur fond clair
          comme sur fond sombre sans être redéfini par thème. */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-danger-soft blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="app-card p-6 sm:p-8" style={{ boxShadow: "var(--elev-3)" }}>
          <div className="mb-6 text-center">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-danger-border bg-danger-soft">
              <Lock className="w-8 h-8 t-danger" />
            </div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] t-danger">
              {APP_NAME}
            </p>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Votre période d'essai est terminée
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{storeName}</span> est
              temporairement verrouillée. Activez-la pour retrouver un accès normal.
            </p>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-muted/60 p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <Phone className="w-4 h-4 t-success" />
              <span className="text-sm font-semibold text-foreground">Activer par paiement</span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Payez 100 000 Ar via MVola, puis envoyez la référence à l'administrateur pour
              recevoir votre code.
            </p>
            <div className="mb-3 rounded-xl bg-card p-3 text-center">
              <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                MVola
              </p>
              <p className="font-mono text-lg font-bold tracking-wider text-foreground">
                {MVOLA_NUMBER}
              </p>
            </div>
            <a
              href={`tel:${ADMIN_CONTACT.replace(/\s/g, "")}`}
              className="flex items-center justify-center gap-2 text-xs font-medium t-success hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              {ADMIN_CONTACT}
            </a>
          </div>

          <form onSubmit={handleActivate} className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              className="app-field text-center font-mono tracking-widest"
            />
            {error && <p className="text-center text-sm font-medium t-danger">{error}</p>}
            <button type="submit" disabled={loading} className="app-btn-primary w-full">
              {loading ? "Vérification..." : "Activer ma boutique"}
            </button>
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