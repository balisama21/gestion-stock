import type { Database } from "./database.types";

type Store = Database["public"]["Tables"]["stores"]["Row"];

/**
 * UNE BOUTIQUE EST-ELLE VERROUILLÉE ?
 *
 * Ce calcul reproduit exactement `store_is_locked()` en base. Il est ici
 * pour une seule raison : l'interface doit savoir, AVANT d'afficher un
 * écran, ce que le serveur refusera d'écrire. La barrière de sécurité,
 * elle, reste côté Supabase — voir `store_allows_write` et
 * `can_modify_in_store` dans les RLS. Cette fonction ne protège rien,
 * elle évite de proposer un geste qui échouerait.
 *
 * S'IL FALLAIT NE RETENIR QU'UNE CHOSE : si la règle change en base,
 * elle change ici, dans le même geste. Le calcul vivait auparavant en
 * clair au milieu de `BalsamaApp.tsx`, à un seul endroit ; il en faut
 * maintenant deux — la page elle-même, et la liste des boutiques
 * qu'on propose depuis l'écran de blocage. Deux copies d'une règle
 * finissent toujours par diverger, d'où ce fichier.
 *
 * L'ACTIVATION APPARTIENT AU COMPTE, et cela ne se voit pas ici : c'est
 * le propriétaire qui porte le droit, et la base l'a déjà recopié sur
 * chacune de ses boutiques au moment du paiement (voir la migration
 * `activation_par_compte`). Lire la ligne de la boutique suffit donc,
 * et reste vrai pour un collaborateur, qui n'a aucune visibilité sur le
 * compte de son hôte.
 */
export function boutiqueEstVerrouillee(
  boutique: Pick<Store, "activation_status" | "trial_ends_at" | "abonnement_jusqu_au">,
): boolean {
  if (boutique.activation_status === "locked") return true;

  // Au mois : ouverte tant que l'échéance n'est pas passée. Une
  // activation à vie porte une échéance nulle et ne se ferme jamais
  // pour cette raison.
  if (boutique.activation_status === "active") {
    return (
      boutique.abonnement_jusqu_au != null &&
      new Date(boutique.abonnement_jusqu_au).getTime() < Date.now()
    );
  }

  if (boutique.activation_status === "trial") {
    return new Date(boutique.trial_ends_at).getTime() < Date.now();
  }

  return false;
}

/** La vue de remplacement, quand les données de la boutique sont fermées. */
export const VUE_VERROUILLEE = "verrouille" as const;

/**
 * QUELLE VUE AFFICHER, une fois qu'on sait si la boutique est fermée.
 *
 * Les Paramètres font exception et restent joignables : le profil, le
 * changement d'e-mail et le support n'ont rien à voir avec les données
 * de la boutique expirée, et c'est justement là qu'on va quand on veut
 * régulariser sa situation. Tout le reste cède la place à l'écran
 * d'activation.
 *
 * Cette règle est une fonction, et non une condition écrite au milieu
 * du rendu, parce qu'elle décide de ce qu'on peut encore faire quand on
 * est bloqué : elle mérite un nom et un test.
 */
export function vueAffichee<T extends string>(
  ongletChoisi: T,
  boutiqueVerrouillee: boolean,
): T | typeof VUE_VERROUILLEE {
  if (!boutiqueVerrouillee) return ongletChoisi;
  return ongletChoisi === "settings" ? ongletChoisi : VUE_VERROUILLEE;
}
