import type { Database } from "./database.types";

type Store = Database["public"]["Tables"]["stores"]["Row"];

/**
 * CE QU'UNE NOUVELLE BOUTIQUE REPRENDRA DU COMPTE.
 *
 * Rien n'est décidé ici : à la création, `protect_store_activation_fields()`
 * pose lui-même l'état de la boutique d'après le COMPTE de son
 * propriétaire (voir la migration `activation_par_compte`). Ce calcul
 * reproduit la même règle pour l'annoncer AVANT de créer :
 *
 *   - compte activé (à vie ou au mois, échéance non passée) : la
 *     boutique est ouverte tout de suite, avec la même échéance ;
 *   - sinon, elle reprend la fin de l'essai en cours du compte — la plus
 *     proche parmi ses boutiques hors marque —, ou ouvre un essai de
 *     trente jours si le compte n'en possède encore aucune.
 *
 * L'activation du compte n'est pas lue directement : la base l'a déjà
 * recopiée sur chacune des boutiques du propriétaire au paiement, et
 * leurs lignes suffisent.
 */
export type AbonnementNouvelleBoutique =
  | { type: "marque" }
  | { type: "a-vie" }
  | { type: "au-mois"; jusquAu: string }
  | { type: "essai"; jusquAu: string }
  | { type: "essai-termine" }
  | { type: "essai-neuf" };

export function abonnementNouvelleBoutique(
  boutiques: Pick<
    Store,
    "owner_id" | "marque_id" | "activation_status" | "trial_ends_at" | "abonnement_jusqu_au"
  >[],
  proprietaireId: string | undefined,
  marqueId: string | null | undefined,
  maintenant: number = Date.now(),
): AbonnementNouvelleBoutique {
  // Domaine d'une marque cliente : ni essai ni abonnement.
  if (marqueId) return { type: "marque" };

  const siennes = boutiques.filter((b) => b.owner_id === proprietaireId && !b.marque_id);

  const activees = siennes.filter(
    (b) =>
      b.activation_status === "active" &&
      (b.abonnement_jusqu_au == null || new Date(b.abonnement_jusqu_au).getTime() > maintenant),
  );
  if (activees.some((b) => b.abonnement_jusqu_au == null)) return { type: "a-vie" };
  if (activees.length > 0) {
    const echeance = activees
      .map((b) => b.abonnement_jusqu_au as string)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return { type: "au-mois", jusquAu: echeance };
  }

  const finsEssai = siennes
    .map((b) => b.trial_ends_at)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  if (finsEssai.length === 0) return { type: "essai-neuf" };
  if (new Date(finsEssai[0]).getTime() < maintenant) return { type: "essai-termine" };
  return { type: "essai", jusquAu: finsEssai[0] };
}
