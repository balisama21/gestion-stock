import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { hoteVisite } from "../lib/marquesBoutiques";
import { useAuth } from "../hooks/useAuth";
import { useMarque } from "../hooks/useMarque";
import { APP_SUPPORT_PHONE } from "../lib/appConfig";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const marque = useMarque();
  const { user, refreshProfile, signOut } = useAuth();

  const [status, setStatus] = useState<
    "loading" | "auth-required" | "processing" | "success" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailMismatch, setIsEmailMismatch] = useState(false);
  const [joinedStoreName, setJoinedStoreName] = useState<string | null>(null);

  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [oubli, setOubli] = useState<"non" | "saisie" | "envoye">("non");
  const [envoiOubli, setEnvoiOubli] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Lien d'invitation invalide ou manquant.");
      return;
    }

    if (!user) {
      if (!needsEmailConfirmation) setStatus("auth-required");
    } else {
      processInvitation(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  const processInvitation = async (userId: string) => {
    setStatus("processing");
    try {
      // RPC plutôt que l'edge function accept-invitation : elle vérifie
      // l'e-mail du compte connecté et que la boutique invitante est bien
      // de la marque du domaine visité.
      const { data, error } = await supabase.rpc("rejoindre_par_lien_sur_marque", {
        p_token: token,
        p_hote: hoteVisite(),
      });

      if (error) {
        throw new Error(error.message || "Erreur lors de l'acceptation.");
      }

      await refreshProfile();
      setStatus("success");
      setJoinedStoreName(data?.store_name ?? null);

      // Rechargement complet (pas une navigation SPA) : garantit que le
      // workspace récupère bien la nouvelle boutique rejointe dès l'arrivée
      // sur le dashboard, sans dépendre d'un état déjà en mémoire.
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Une erreur est survenue.";
      // Cas fréquent en test : la personne est déjà connectée avec SON
      // PROPRE compte (pas celui invité) quand elle clique le lien. On lui
      // propose de se déconnecter directement plutôt qu'un message d'échec
      // sec — c'est la cause la plus probable de "le lien ne marche pas".
      setIsEmailMismatch(message.includes("ne correspond pas"));
      setStatus("error");
      setErrorMsg(message);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("processing");
    setErrorMsg("");
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Traite l'invitation immédiatement plutôt que d'attendre la
        // propagation du contexte React (plus fiable, évite tout délai/
        // impression que "le lien ne fait rien").
        if (data.user) {
          await processInvitation(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            // Préserve le lien COMPLET (avec le token) pour que la
            // confirmation par e-mail ramène directement ici, et non sur
            // la page d'accueil où l'invitation serait perdue.
            emailRedirectTo: window.location.href,
          },
        });
        if (error) throw error;

        if (data.session) {
          // Confirmation email désactivée sur ce projet : session immédiate.
          await processInvitation(data.user!.id);
        } else {
          // Cas standard : confirmation par e-mail requise avant toute
          // session. On informe clairement au lieu de rester bloqué en
          // silence sur l'écran de connexion.
          setNeedsEmailConfirmation(true);
          setStatus("auth-required");
        }
      }
    } catch (e: unknown) {
      setStatus("auth-required");
      setErrorMsg(e instanceof Error ? e.message : "Erreur d'authentification.");
    }
  };

  // Même demande que sur la page de connexion ; l'invitation reste ouverte ici.
  const handleOubli = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setEnvoiOubli(true);
    const { error } = await supabase.functions.invoke("demander-recuperation", {
      body: { email: email.trim(), hote: hoteVisite() },
    });
    setEnvoiOubli(false);
    if (error) {
      setErrorMsg("Demande impossible pour l'instant. Réessayez dans un moment.");
      return;
    }
    setOubli("envoye");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="inline-flex items-center gap-3 mb-10">
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg tracking-wide">{marque.nom}</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight mb-4">Rejoignez une équipe</h1>
            <p className="text-emerald-50 text-base leading-relaxed max-w-sm">
              Acceptez votre invitation pour accéder à l&apos;espace de travail partagé et
              collaborer sur la gestion du stock.
            </p>
          </div>
          <p className="text-xs text-emerald-50">Invitation sécurisée · Accès contrôlé</p>
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
            <div className="w-14 h-14 bg-success-soft t-success rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1">Invitation équipe</h1>
            <p className="text-sm text-muted-foreground mb-8">{marque.nom}</p>

            {status === "loading" && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                Vérification du lien...
              </div>
            )}

            {status === "processing" && (
              <div className="flex items-center gap-3 t-success">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                Traitement de l&apos;invitation...
              </div>
            )}

            {status === "success" && (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 t-success mx-auto mb-4" />
                <p className="t-success font-bold mb-2">Invitation acceptée !</p>
                {joinedStoreName && (
                  <p className="text-sm text-foreground mb-1">
                    Vous avez rejoint <strong>{joinedStoreName}</strong>.
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Redirection vers votre espace...</p>
              </div>
            )}

            {status === "error" && (
              <div>
                <div className="flex items-start gap-3 bg-danger-soft border border-danger-border t-danger rounded-xl p-4 mb-6 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
                {isEmailMismatch ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setIsEmailMismatch(false);
                      setStatus("auth-required");
                      setErrorMsg("");
                    }}
                    className="app-btn-primary w-full"
                  >
                    Se déconnecter et utiliser le bon compte
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="block w-full text-center py-3 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors"
                  >
                    Retour à l&apos;accueil
                  </Link>
                )}
              </div>
            )}

            {status === "auth-required" && needsEmailConfirmation && (
              <div className="text-center py-4">
                <Mail className="w-12 h-12 t-success mx-auto mb-4" />
                <p className="text-foreground font-bold mb-2">Confirmez votre e-mail</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Un e-mail de confirmation a été envoyé à <strong>{email}</strong>. Ouvrez le
                  lien qu'il contient pour finaliser votre inscription — vous serez ramené
                  directement ici pour rejoindre la boutique.
                </p>
              </div>
            )}

            {status === "auth-required" && oubli === "saisie" && (
              <form onSubmit={handleOubli} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {marque.parDefaut
                    ? "Entrez votre e-mail : votre demande sera transmise à l'administrateur, qui vous remettra un lien de réinitialisation."
                    : "Entrez votre e-mail : vous recevrez un lien pour choisir un nouveau mot de passe."}
                </p>
                {errorMsg && (
                  <div className="flex items-center gap-2 bg-danger-soft border border-danger-border t-danger rounded-xl p-3 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="votre@email.com"
                    className="app-field pl-10"
                  />
                </div>
                <button type="submit" disabled={envoiOubli} className="app-btn-primary w-full">
                  {envoiOubli ? "Envoi de la demande…" : "Demander la réinitialisation"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOubli("non");
                    setErrorMsg("");
                  }}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Retour à l&apos;invitation
                </button>
              </form>
            )}

            {status === "auth-required" && oubli === "envoye" && (
              <div className="text-center py-2">
                <CheckCircle2 className="w-12 h-12 t-success mx-auto mb-4" />
                <p className="text-foreground font-semibold mb-2">
                  {marque.parDefaut ? "Demande enregistrée" : "Vérifiez votre boîte e-mail"}
                </p>
                {/* Même réponse que l'adresse existe ou non. */}
                {marque.parDefaut ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Votre demande pour <strong className="text-foreground">{email}</strong> a été
                    transmise à l&apos;administrateur.
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Si un compte existe pour <strong className="text-foreground">{email}</strong>,
                    un e-mail avec un lien de réinitialisation vient d&apos;y être envoyé. Pensez à
                    regarder dans les courriers indésirables.
                  </p>
                )}
                {marque.parDefaut ? (
                  <div className="mt-4 rounded-xl border border-border bg-muted p-3.5 text-left">
                    <p className="text-xs font-semibold text-foreground">
                      Contactez l&apos;administrateur pour recevoir votre lien
                    </p>
                    <a
                      href={`tel:${APP_SUPPORT_PHONE.replace(/\s/g, "")}`}
                      className="mt-1.5 inline-block text-base font-bold text-primary hover:underline"
                    >
                      {APP_SUPPORT_PHONE}
                    </a>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Une fois le nouveau mot de passe choisi, rouvrez le lien de l&apos;invitation
                      reçu par e-mail : il reste valable 7 jours.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Une fois le nouveau mot de passe choisi, rouvrez le lien de l&apos;invitation
                    reçu par e-mail : il reste valable 7 jours.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setOubli("non")}
                  className="w-full mt-6 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-semibold rounded-xl transition-colors"
                >
                  Retour à l&apos;invitation
                </button>
              </div>
            )}

            {status === "auth-required" && !needsEmailConfirmation && oubli === "non" && (
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  Connectez-vous ou créez un compte pour accepter cette invitation.
                </p>

                {errorMsg && (
                  <div className="flex items-center gap-2 bg-danger-soft border border-danger-border t-danger rounded-xl p-3 mb-4 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                        Nom complet
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          placeholder="Prénom et nom"
                          className="app-field pl-10"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        placeholder="votre@email.com"
                        className="app-field pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        placeholder="••••••••"
                        className="app-field pl-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground p-0.5"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {isLogin && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setOubli("saisie");
                            setErrorMsg("");
                          }}
                          className="text-xs font-semibold t-success hover:underline"
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="app-btn-primary w-full"
                  >
                    {isLogin ? "Se connecter & accepter" : "Créer le compte & accepter"}
                  </button>
                </form>

                <p className="text-center text-xs text-muted-foreground mt-6">
                  {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrorMsg("");
                    }}
                    className="t-success font-semibold ml-1 hover:underline"
                  >
                    {isLogin ? "S'inscrire" : "Se connecter"}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}