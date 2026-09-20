import React, { useState } from "react";
import { Lock, KeyRound, Phone, LogOut, Store as StoreIcon, UserCog, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { MotSymbole } from "./shared/MotSymbole";
import { prixAVie, prixMensuel } from "../lib/offres";

export interface BoutiqueJoignable {
  id: string;
  nom: string;
  verrouillee: boolean;
}

interface StoreLockedScreenProps {
  storeName: string;
  storeId: string;
  onActivated: () => Promise<void> | void;
  /**
   * Les AUTRES boutiques du compte. Une boutique expirée ne doit jamais
   * barrer l'accès à celles qui sont en règle.
   */
  autresBoutiques: BoutiqueJoignable[];
  onChangerDeBoutique: (id: string) => void;
  /** Ouvre les réglages du compte : profil, e-mail, support. */
  onOuvrirLeCompte: () => void;
}

const MVOLA_NUMBER = "0389723412";
const ADMIN_CONTACT = "+261 38 97 234 12";

/**
 * L'ÉCRAN D'UNE BOUTIQUE VERROUILLÉE — ET SES SORTIES
 *
 * Affiché à la place du CONTENU quand la boutique active est verrouillée
 * (essai expiré sans activation, ou mois d'abonnement échu). Le vrai
 * blocage est déjà assuré côté Supabase par les RLS (voir la migration
 * `enforce_store_lock_in_rls`) : cet écran est l'expérience utilisateur,
 * pas la barrière de sécurité.
 *
 * ── Ce qui a changé, et pourquoi ──
 *
 * Il remplaçait TOUTE l'application, en retournant avant l'en-tête et la
 * barre latérale. Une seule boutique expirée fermait donc l'accès aux
 * autres, qui étaient en règle, et aux réglages du compte. Il ne
 * remplace plus que la vue : l'en-tête reste, avec son sélecteur de
 * boutiques, ses notifications et ses réglages.
 *
 * Trois sorties sont malgré tout redites ici, parce qu'on ne devrait
 * jamais avoir à deviner où cliquer quand on est bloqué : changer de
 * boutique, ouvrir son compte, se déconnecter.
 *
 * LA DÉCONNEXION MONTRE QU'ELLE TRAVAILLE. Elle peut prendre jusqu'à
 * trois secondes quand le réseau ne répond pas (voir `signOut` dans
 * useAuth) ; sans ce témoin, le clic paraîtrait sans effet — ce qui
 * était précisément la plainte.
 */
export const StoreLockedScreen: React.FC<StoreLockedScreenProps> = ({
  storeName,
  storeId,
  onActivated,
  autresBoutiques,
  onChangerDeBoutique,
  onOuvrirLeCompte,
}) => {
  const { signOut } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [deconnexion, setDeconnexion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ouvertes = autresBoutiques.filter((b) => !b.verrouillee);

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

  const seDeconnecter = async () => {
    setDeconnexion(true);
    try {
      await signOut();
    } finally {
      setDeconnexion(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md py-4">
      <div className="app-card p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-danger-border bg-danger-soft">
            <Lock className="w-8 h-8 t-danger" />
          </div>
          <MotSymbole hauteur={30} className="mb-3 text-foreground" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Votre période d&apos;essai est terminée
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{storeName}</span> est temporairement
            verrouillée. Activez-la pour retrouver un accès normal.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-border bg-muted/60 p-4">
          <div className="mb-2 flex items-center gap-2.5">
            <Phone className="w-4 h-4 t-success" />
            <span className="text-sm font-semibold text-foreground">Activer par paiement</span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            {prixMensuel()} pour un mois, à renouveler, ou {prixAVie()} une seule fois à vie.
            L&apos;activation vaut pour <span className="font-semibold">tout votre compte</span> :
            vos autres boutiques s&apos;ouvrent en même temps. Payez via MVola, puis envoyez la
            référence à l&apos;administrateur pour recevoir votre code.
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
            Code d&apos;activation
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

      {/* ── Les sorties ──
          Une boutique expirée n'est pas une impasse : les autres
          boutiques du compte restent ouvertes, et le compte lui-même
          reste joignable. */}
      {autresBoutiques.length > 0 && (
        <div className="mt-4 app-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <StoreIcon className="w-4 h-4 t-success" />
            Changer de boutique
          </p>
          <div className="flex flex-col gap-1.5">
            {autresBoutiques.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onChangerDeBoutique(b.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <span className="truncate text-sm font-medium text-foreground">{b.nom}</span>
                {b.verrouillee ? (
                  <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold t-danger">
                    Verrouillée
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold t-success">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
          {ouvertes.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Toutes vos boutiques attendent une activation. Un seul code les ouvre toutes.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={onOuvrirLeCompte}
          className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <UserCog className="w-3.5 h-3.5" />
          Mon compte
        </button>
        <button
          type="button"
          onClick={seDeconnecter}
          disabled={deconnexion}
          className="flex w-full items-center justify-center gap-1.5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <LogOut className="w-3.5 h-3.5" />
          {deconnexion ? "Déconnexion…" : "Me déconnecter"}
        </button>
      </div>
    </div>
  );
};
