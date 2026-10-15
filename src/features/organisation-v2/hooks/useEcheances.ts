import { useMemo } from "react";
import type { Purchase } from "../../../types";
import { formatCurrency } from "../../../utils/formulas";
import { urgenceDe } from "../../../lib/agenda";
import { echeancesMetier, type LigneAgenda } from "../../../lib/evenements";
import type { DroitsOrganisation } from "./useOrganisationPermissions";

export type DevisEcheance = Parameters<typeof echeancesMetier>[1][number];
export type LivraisonEcheance = Parameters<typeof echeancesMetier>[2][number];

/**
 * LES ÉCHÉANCES DE LA BOUTIQUE — lecture seule
 *
 * Le calcul est celui de l'agenda actuel et de la vue d'équipe
 * (`echeancesMetier`, `lib/evenements.ts`), appliqué aux mêmes données
 * déjà chargées par l'application : aucune requête de plus, et donc les
 * mêmes lignes que ce qu'affichent les pages Achats, Devis et Livraisons.
 *
 * Une seule chose s'y ajoute : une échéance n'est gardée que si le
 * module d'où elle vient est visible pour cette personne. Quelqu'un qui
 * n'a pas accès aux Achats ne voit pas « Régler tel fournisseur ».
 *
 * Les ventes à crédit n'ont pas de date d'échéance en base : elles
 * n'apparaissent pas (voir `lib/agenda.ts`).
 */
export function useEcheances(
  purchases: Purchase[],
  quotes: DevisEcheance[],
  deliveries: LivraisonEcheance[],
  droits: DroitsOrganisation,
): LigneAgenda[] {
  return useMemo(() => {
    if (!droits.voitAgenda) return [];
    return echeancesMetier(
      droits.voitModule("achats") ? purchases : [],
      droits.voitModule("devis") ? quotes : [],
      droits.voitModule("livraisons") ? deliveries : [],
      formatCurrency,
      (j) => urgenceDe(j) === "retard",
    );
  }, [purchases, quotes, deliveries, droits]);
}
