/**
 * Traduction des messages d'erreur d'authentification.
 *
 * Supabase renvoie ses erreurs en anglais et dans le vocabulaire du
 * serveur d'authentification : « Error sending recovery email »,
 * « Invalid login credentials ». Affichées telles quelles, elles disent
 * à l'utilisateur qu'il s'est passé quelque chose, jamais quoi faire.
 *
 * Chaque entrée est reconnue par un fragment stable du message anglais —
 * pas par une égalité stricte, car GoTrue ajoute parfois du contexte. Un
 * message inconnu est renvoyé tel quel : mieux vaut une phrase anglaise
 * qu'un « une erreur est survenue » qui efface l'information et empêche
 * tout diagnostic.
 */

interface Traduction {
  /** Fragment recherché dans le message d'origine, en minuscules. */
  motif: string;
  /** Texte affiché, ou fonction quand le message porte une valeur. */
  texte: string | ((original: string) => string);
}

const TRADUCTIONS: Traduction[] = [
  {
    motif: "invalid login credentials",
    texte:
      "Adresse e-mail ou mot de passe incorrect. Si vous vous êtes inscrit avec Google, utilisez le bouton « Continuer avec Google ».",
  },
  {
    motif: "email not confirmed",
    texte:
      "Votre adresse n'est pas encore confirmée. Ouvrez le lien que vous avez reçu par e-mail, puis réessayez.",
  },
  {
    motif: "error sending recovery email",
    texte:
      "L'envoi de l'e-mail de réinitialisation a échoué. Si vous vous êtes inscrit avec Google, ce compte n'a pas de mot de passe : revenez à la connexion et utilisez « Continuer avec Google ». Sinon, contactez le propriétaire de la boutique.",
  },
  {
    motif: "error sending confirmation email",
    texte:
      "Le compte est créé, mais l'e-mail de confirmation n'a pas pu être envoyé. Contactez le propriétaire de la boutique.",
  },
  {
    motif: "error sending invite email",
    texte:
      "L'invitation est enregistrée, mais l'e-mail n'a pas pu être envoyé. Transmettez le lien d'invitation directement.",
  },
  {
    motif: "user already registered",
    texte:
      "Un compte existe déjà avec cette adresse. Connectez-vous, ou utilisez « Mot de passe oublié ».",
  },
  {
    motif: "password should be at least",
    texte: "Le mot de passe est trop court : six caractères au minimum.",
  },
  {
    motif: "new password should be different",
    texte: "Le nouveau mot de passe doit être différent de l'ancien.",
  },
  {
    motif: "unable to validate email address",
    texte: "Cette adresse e-mail n'a pas un format valide.",
  },
  {
    motif: "signups not allowed",
    texte: "Les inscriptions sont fermées sur cette application.",
  },
  {
    motif: "email rate limit exceeded",
    texte: "Trop d'e-mails demandés en peu de temps. Patientez quelques minutes.",
  },
  {
    // « For security purposes, you can only request this after 45 seconds. »
    motif: "you can only request this after",
    texte: (original) => {
      const secondes = original.match(/(\d+)\s*second/i)?.[1];
      return secondes
        ? `Trop de tentatives rapprochées. Réessayez dans ${secondes} secondes.`
        : "Trop de tentatives rapprochées. Patientez un instant avant de réessayer.";
    },
  },
  {
    motif: "token has expired or is invalid",
    texte: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.",
  },
  {
    motif: "email link is invalid or has expired",
    texte: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.",
  },
  {
    motif: "failed to fetch",
    texte: "Connexion au serveur impossible. Vérifiez votre accès à Internet.",
  },
];

/** Rend lisible et actionnable une erreur d'authentification. */
export function traduireErreurAuth(original: string | null): string | null {
  if (!original) return original;
  const cible = original.toLowerCase();
  const trouvee = TRADUCTIONS.find((t) => cible.includes(t.motif));
  if (!trouvee) return original;
  return typeof trouvee.texte === "function" ? trouvee.texte(original) : trouvee.texte;
}
