import { formatCurrency } from "../utils/formulas";

/**
 * Ce que coûte le logiciel, écrit une seule fois.
 *
 * ── Pourquoi ce fichier existe ──
 *
 * Avant lui, la durée d'essai et le prix étaient recopiés à la main dans
 * une vingtaine de composants — page d'inscription, création de
 * boutique, en-tête, écran de facturation, écran de boutique
 * verrouillée, landing, foire aux questions. Changer un prix voulait
 * dire les retrouver tous, et en oublier un signifiait afficher deux
 * tarifs différents dans la même application.
 *
 * ── Ce que ce fichier n'est PAS ──
 *
 * Il ne décide rien. La vérité vit dans la base de données :
 *
 *   ESSAI_JOURS          doit rester d'accord avec l'intervalle de
 *                        `protect_store_activation_fields()`, qui est le
 *                        seul à fixer réellement `trial_ends_at` ;
 *   ABONNEMENT_MOIS_JOURS doit rester d'accord avec le `duree_jours`
 *                        des codes d'accès mensuels.
 *
 * Ces constantes servent à ÉCRIRE des phrases justes à l'écran. Si l'une
 * d'elles ment, l'application affiche un chiffre faux — elle n'accorde
 * pas un jour de plus pour autant. La base reste maîtresse.
 *
 * Les montants, eux, ne sont nulle part en base : il n'existe pas de
 * table de plans. C'est ici qu'ils vivent, et dans le montant inscrit
 * sur le code d'accès au moment où l'administrateur le génère.
 */

/** Durée de l'essai gratuit offert à toute nouvelle boutique. */
export const ESSAI_JOURS = 30;

/** Paiement unique, la boutique est activée définitivement. */
export const PRIX_A_VIE = 500000;

/** Paiement mensuel, à renouveler. */
export const PRIX_MENSUEL = 30000;

/** Ce qu'un code d'accès mensuel accorde, en jours. */
export const ABONNEMENT_MOIS_JOURS = 30;

/**
 * Ce qu'un code d'activation accorde.
 *
 * « vie » produit un code sans durée : la boutique reste ouverte
 * définitivement. « mois » produit un code de trente jours, à renouveler.
 * C'est la colonne `duree_jours` du code d'accès qui porte la
 * distinction, et `store_is_locked()` qui en tire les conséquences.
 */
export type FormuleCode = "mois" | "vie";

/** « 500 000 Ar », avec l'espace insécable qui va bien. */
export const prixAVie = (): string => formatCurrency(PRIX_A_VIE);

/** « 30 000 Ar ». */
export const prixMensuel = (): string => formatCurrency(PRIX_MENSUEL);

/**
 * Ce que l'activation apporte, dans les deux formules payantes.
 *
 * La liste est la même pour l'offre mensuelle et l'offre à vie : ce
 * n'est pas un logiciel bridé qu'on déverrouille par paliers, seule la
 * façon de payer change. Le dire clairement évite la question « qu'est-ce
 * que je perds en prenant le mensuel ».
 */
export const INCLUS_DANS_TOUTES_LES_OFFRES = [
  "Stock, ventes, achats et trésorerie",
  "Clients, fournisseurs, prestataires",
  "Devis, reçus et factures à imprimer",
  "Plusieurs comptes pour votre équipe",
  "Sur téléphone, tablette et ordinateur",
  "Mises à jour comprises",
] as const;
