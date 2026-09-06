import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { APP_NAME, APP_SUPPORT_PHONE, APP_TAGLINE } from "../lib/appConfig";
import { supabase } from "../lib/supabase";
import { HeroAccueil } from "./landing/HeroAccueil";
import { SectionModules } from "./landing/SectionModules";
import { ArgumentaireConnexion } from "./landing/ArgumentaireConnexion";
import { useDefilement } from "./landing/useDefilement";
import { traduireErreurAuth } from "../lib/messagesAuth";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
} from "lucide-react";

type AuthMode = "login" | "register" | "activate" | "forgot-password";

export const AuthPage: React.FC = () => {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    activateWithCode,
    signOut,
    user,
    profile,
    profileError,
    resetPasswordForEmail,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => {
    return "login";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const ancreConnexion = useRef<HTMLElement>(null);

  // Publie la position de défilement ; tout le mouvement de la page
  // d'accueil s'y adosse.
  useDefilement();

  const allerAuFormulaire = () => {
    ancreConnexion.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  // NOTE (18/08/2026) : l'ancien blocage "paiement obligatoire avant accès"
  // est supprimé. Dès que `user` existe, App() (BalsamaApp.tsx) bascule
  // directement vers l'espace de travail — cet écran (AuthPage) n'est plus
  // affiché du tout après connexion, donc ce useEffect n'a plus besoin de
  // gérer de mode "activate" automatique. Le mode "activate" reste
  // disponible dans le JSX ci-dessous pour un usage futur (activation
  // payante PAR BOUTIQUE, gérée depuis Paramètres > Paiements & Activation),
  // mais n'est plus déclenché automatiquement ici.
  useEffect(() => {
    if (!user) {
      // Ne pas écraser le mode "mot de passe oublié" : ce mode s'utilise
      // précisément quand l'utilisateur n'est pas connecté.
      setMode((current) => (current === "forgot-password" ? current : "login"));
    }
  }, [user, profile]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError(traduireErreurAuth(signInError));
      return;
    }
    // Rien d'autre à faire : dès que `user` devient non-null, BalsamaApp.tsx
    // bascule automatiquement vers l'espace de travail (WorkspaceLoader).
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: googleError } = await signInWithGoogle();
    // En cas de succès, le navigateur est redirigé vers Google : ce code
    // ne continue pas d'exécution. On ne coupe le loading que si l'appel
    // a échoué avant même la redirection (ex: provider mal configuré).
    if (googleError) {
      setGoogleLoading(false);
      setError(traduireErreurAuth(googleError));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signUpError } = await signUp(email, password, fullName);
    setLoading(false);
    if (signUpError) {
      setError(traduireErreurAuth(signUpError));
    } else {
      setSuccess(
        "Compte créé ! Vérifiez votre e-mail puis connectez-vous pour créer votre boutique.",
      );
      setMode("login");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: activateError } = await activateWithCode(activationCode);
    setLoading(false);
    if (activateError) {
      setError(traduireErreurAuth(activateError));
    } else {
      setSuccess(`Compte activé avec succès ! Bienvenue sur ${APP_NAME}.`);
    }
  };

  /**
   * Dépose une demande de réinitialisation auprès de l'administrateur.
   *
   * L'envoi d'e-mails n'atteint aujourd'hui qu'une seule adresse, faute
   * de domaine vérifié : passer par `resetPasswordForEmail` ne produisait
   * qu'une erreur. La demande est donc enregistrée, l'administrateur la
   * voit dans son espace et délivre le lien lui-même.
   *
   * La réponse est la même que l'adresse existe ou non. Dire « cette
   * adresse n'est pas connue » livrerait à n'importe qui la liste des
   * comptes de l'application, une adresse à la fois.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: fnError } = await supabase.functions.invoke("demander-recuperation", {
      body: { email: forgotEmail.trim() },
    });
    setLoading(false);
    if (fnError) {
      setError("Demande impossible pour l'instant. Réessayez dans un moment.");
      return;
    }
    setForgotSent(true);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
    if (next === "forgot-password") {
      setForgotSent(false);
      setForgotEmail(email);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Barre d'accès permanente.
          La page d'accueil est faite pour qui découvre le logiciel ; celui
          qui revient chaque matin, lui, veut son formulaire. Sans ce
          raccourci il lui faudrait parcourir toute la présentation à
          chaque connexion. */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-emerald-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <img src="/logo.svg" alt="" width={24} height={24} className="h-6 w-6 rounded-md" />
            <span className="text-sm font-semibold text-white">{APP_NAME}</span>
          </span>
          <button
            type="button"
            onClick={allerAuFormulaire}
            className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            Se connecter
          </button>
        </div>
      </div>

      <HeroAccueil onRejoindreConnexion={allerAuFormulaire} />

      <SectionModules />

      {/* Formulaire — inchangé, seulement replacé dans la page. */}
      <section
        id="connexion"
        ref={ancreConnexion}
        className="relative scroll-mt-14 overflow-hidden border-t border-border bg-muted/40 px-4 py-16 sm:px-8 sm:py-24"
      >
        {/* Halo discret, décalé au défilement : la section respire au
            lieu de présenter un aplat. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          style={{ transform: "translate(-50%, calc(var(--defilement, 0) * -0.05px))" }}
        />
        <div className="relative mx-auto grid w-full max-w-5xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <ArgumentaireConnexion />

          <div className="order-1 mx-auto w-full max-w-[420px] lg:order-2 lg:mx-0">
            {/* Onglets login / register */}
            {mode !== "activate" && mode !== "forgot-password" && (
              <div className="flex p-1 bg-muted/60 rounded-xl mb-6 border border-border/60">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    mode === "login"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    mode === "register"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Inscription
                </button>
              </div>
            )}

            <div className="bg-card border border-border/80 rounded-2xl shadow-2xl shadow-black/5 p-7 sm:p-8">
              {mode === "activate" && (
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 t-success" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Activation du compte</h2>
                    <p className="text-xs text-muted-foreground">
                      Dernière étape avant l&apos;accès
                    </p>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-foreground">Bon retour</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connectez-vous à votre espace {APP_NAME}
                  </p>
                </div>
              )}

              {mode === "register" && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-foreground">Créer un compte</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Commencez à gérer votre stock en quelques minutes
                  </p>
                </div>
              )}

              {mode === "forgot-password" && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Retour à la connexion
                  </button>
                  <h2 className="text-xl font-bold text-foreground">Mot de passe oublié</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Entrez votre e-mail : votre demande sera transmise à l&apos;administrateur, qui
                    vous remettra un lien de réinitialisation.
                  </p>

                  {/* Un compte créé par Google n'a jamais eu de mot de
                      passe : il n'y a rien à réinitialiser, et l'écran
                      ne pouvait que produire une erreur incompréhensible.
                      Le dire avant la tentative plutôt qu'après l'échec.
                      Nous ne vérifions pas le compte saisi pour autant :
                      répondre « ce compte utilise Google » révélerait
                      quelles adresses sont enregistrées. */}
                  <div className="mt-4 rounded-xl border border-border bg-muted p-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Vous vous êtes inscrit avec Google ? Ce compte n'a pas de mot de passe — il
                      n'y a donc rien à réinitialiser.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={googleLoading}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                    >
                      Se connecter avec Google
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 bg-danger-soft border border-danger-border t-danger rounded-xl p-3.5 mb-5 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-3 bg-success-soft border border-success-border t-success rounded-xl p-3.5 mb-5 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {(mode === "login" || mode === "register") && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-2.5 py-3 mb-5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-semibold text-sm rounded-xl border border-slate-300 transition-colors shadow-sm"
                  >
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.2 3.56-8.84Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.11C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.29 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.39-2.29V6.6H1.28A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4.01-3.11Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
                      />
                    </svg>
                    {googleLoading ? "Redirection..." : "Continuer avec Google"}
                  </button>

                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      ou
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              {mode === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Adresse e-mail" icon={Mail}>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Mot de passe" icon={Lock}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClass} pr-10`}
                      />
                      <PasswordToggle
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                      />
                    </div>
                  </Field>

                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => switchMode("forgot-password")}
                      className="text-xs font-semibold t-success hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  <SubmitButton loading={loading} label="Se connecter" loadingLabel="Connexion…" />
                </form>
              )}

              {mode === "register" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Nom complet" icon={User}>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Prénom et nom"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Adresse e-mail" icon={Mail}>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Mot de passe" icon={Lock}>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 caractères"
                        className={`${inputClass} pr-10`}
                      />
                      <PasswordToggle
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                      />
                    </div>
                  </Field>

                  <div className="rounded-xl border border-success-border bg-success-soft p-4 text-sm">
                    <p className="font-semibold t-success mb-1">7 jours d'essai gratuit</p>
                    <p className="t-success text-xs leading-relaxed">
                      Créez votre boutique et utilisez-la immédiatement. Aucun paiement requis pour
                      commencer.
                    </p>
                  </div>

                  <SubmitButton
                    loading={loading}
                    label="Créer mon compte"
                    loadingLabel="Création…"
                  />
                </form>
              )}

              {mode === "forgot-password" &&
                (forgotSent ? (
                  <div className="py-2 text-center">
                    <CheckCircle2 className="w-12 h-12 t-success mx-auto mb-4" />
                    <p className="text-foreground font-semibold mb-2">Demande enregistrée</p>
                    {/* Le message est le même que l'adresse existe ou non :
                        répondre « ce compte n'existe pas » livrerait la
                        liste des utilisateurs, une adresse à la fois. */}
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      L&apos;envoi par e-mail n&apos;est pas encore disponible. Votre demande pour{" "}
                      <strong className="text-foreground">{forgotEmail}</strong> a été transmise à
                      l&apos;administrateur.
                    </p>
                    <div className="mt-4 rounded-xl border border-border bg-muted p-3.5 text-left">
                      <p className="text-xs font-semibold text-foreground">
                        Contactez l&apos;administrateur pour recevoir votre lien
                      </p>
                      <a
                        href={`tel:${APP_SUPPORT_PHONE.replace(/s/g, "")}`}
                        className="mt-1.5 inline-block text-base font-bold text-primary hover:underline"
                      >
                        {APP_SUPPORT_PHONE}
                      </a>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        Il vous transmettra un lien personnel pour choisir un nouveau mot de passe.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="w-full mt-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold rounded-xl transition-colors"
                    >
                      Retour à la connexion
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <Field label="Adresse e-mail" icon={Mail}>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className={inputClass}
                      />
                    </Field>

                    <SubmitButton
                      loading={loading}
                      label="Demander la réinitialisation"
                      loadingLabel="Envoi de la demande…"
                    />
                  </form>
                ))}

              {mode === "activate" && (
                <>
                  <div className="rounded-xl bg-muted/50 border border-border p-3.5 mb-5 text-sm">
                    <p className="text-muted-foreground">
                      Compte : <strong className="text-foreground">{user?.email}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Statut : {profile?.status ?? "—"} · Rôle : {profile?.role ?? "—"}
                    </p>
                    {profileError && (
                      <p className="t-danger mt-2 font-mono text-xs">Erreur DB : {profileError}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 p-4 text-sm mb-5">
                    <p className="font-semibold t-info mb-2">Comment obtenir votre code ?</p>
                    <p className="text-muted-foreground text-xs mb-2">
                      Virement de <strong className="text-foreground">100 000 Ar</strong> par Orange
                      Money au :
                    </p>
                    <p className="font-bold text-center py-2.5 rounded-lg bg-info-soft t-info tracking-wide">
                      +261 38 97 234 12
                    </p>
                    <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                      Envoyez la référence de transaction par SMS ou WhatsApp. Votre code vous sera
                      transmis en retour.
                    </p>
                  </div>

                  <form onSubmit={handleActivate} className="space-y-4">
                    <Field label="Code d'activation" icon={KeyRound}>
                      <input
                        type="text"
                        required
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                        placeholder="BLSM-XXXX-XXXX"
                        maxLength={14}
                        className={`${inputClass} font-mono tracking-widest text-center text-lg uppercase`}
                      />
                    </Field>

                    <SubmitButton
                      loading={loading}
                      label="Activer mon compte"
                      loadingLabel="Vérification…"
                    />
                  </form>

                  <p className="text-center text-xs text-muted-foreground mt-5">
                    Invitation vendeur ?{" "}
                    <Link
                      to="/accept-invite"
                      search={{ token: undefined }}
                      className="t-success font-semibold hover:underline"
                    >
                      Accepter via e-mail
                    </Link>
                  </p>

                  <div className="mt-6 pt-5 border-t border-border flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-foreground text-sm font-semibold rounded-xl transition-colors"
                    >
                      Déjà activé ? Rafraîchir
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await signOut();
                        switchMode("login");
                      }}
                      className="w-full py-2.5 t-danger hover:bg-danger-soft text-sm font-semibold rounded-xl transition-colors"
                    >
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>

            <p className="text-center text-[11px] text-muted-foreground mt-6">
              {APP_NAME} — {APP_TAGLINE}
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background px-5 py-8 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2">
          <img src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
          <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
        </div>
      </footer>
    </div>
  );
};

const inputClass = "app-field pl-10";

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <Icon className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground p-0.5 transition-colors"
      aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

function SubmitButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="app-btn-primary mt-1 w-full active:scale-[0.99]"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
