import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { APP_NAME } from "../lib/appConfig";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type Status = "verifying" | "ready" | "submitting" | "success" | "error";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, updatePassword, clearPasswordRecovery } = useAuth();

  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // On attend que useAuth ait fini de traiter la session initiale.
    // Supabase transforme automatiquement le lien reçu par e-mail en une
    // session temporaire de récupération (via detectSessionInUrl) — si
    // cette session n'existe pas une fois le chargement terminé, le lien
    // est invalide, expiré, ou a été ouvert dans un navigateur/onglet qui
    // n'a pas la session (ex: ouvert depuis un autre appareil).
    if (authLoading) return;

    if (session) {
      setStatus("ready");
    } else {
      setStatus("error");
      setErrorMsg(
        "Ce lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien depuis la page de connexion.",
      );
    }
  }, [authLoading, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return; // anti double-clic / double soumission

    if (password.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setErrorMsg("");
    setStatus("submitting");

    const { error } = await updatePassword(password);

    if (error) {
      setErrorMsg(error);
      setStatus("ready");
      return;
    }

    setStatus("success");
    clearPasswordRecovery();

    // On déconnecte la session temporaire de récupération pour forcer une
    // connexion propre avec le nouveau mot de passe.
    setTimeout(async () => {
      const { supabase } = await import("../lib/supabase");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="inline-flex items-center gap-3 mb-10">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-wide">{APP_NAME}</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight mb-4">Nouveau mot de passe</h1>
            <p className="text-emerald-100/80 text-base leading-relaxed max-w-sm">
              Choisissez un mot de passe sécurisé pour continuer à accéder à votre espace.
            </p>
          </div>
          <p className="text-xs text-emerald-200/50">Invitation sécurisée · Accès contrôlé</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>

          <div className="bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/10 p-8 sm:p-10">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-6">
              <KeyRound className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1">
              Réinitialiser le mot de passe
            </h1>
            <p className="text-sm text-muted-foreground mb-8">{APP_NAME}</p>

            {status === "verifying" && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                Vérification du lien...
              </div>
            )}

            {status === "success" && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <p className="text-emerald-500 font-bold mb-2">Mot de passe mis à jour !</p>
                <p className="text-sm text-muted-foreground">
                  Redirection vers la page de connexion...
                </p>
              </div>
            )}

            {status === "error" && (
              <div>
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 text-red-500 rounded-xl p-4 mb-6 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
                <Link
                  to="/"
                  className="block w-full text-center py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors"
                >
                  Retour à la connexion
                </Link>
              </div>
            )}

            {(status === "ready" || status === "submitting") && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-500 rounded-xl p-3 mb-2 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Minimum 8 caractères"
                      className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Répétez le mot de passe"
                      className="w-full bg-muted/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full py-3 mt-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 active:scale-[0.99]"
                >
                  {status === "submitting" ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Mise à jour…
                    </span>
                  ) : (
                    "Mettre à jour le mot de passe"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}