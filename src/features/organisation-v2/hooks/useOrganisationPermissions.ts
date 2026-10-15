import { useMemo } from "react";
import {
  getModuleScope,
  hasModuleAction,
  isModuleVisible,
  type PermissionsMap,
} from "../../../lib/permissions";

/**
 * CE QUE CETTE PERSONNE PEUT FAIRE SUR LA PAGE
 *
 * Aucune règle nouvelle : chaque droit reprend celle que l'application
 * applique déjà aux quatre écrans actuels (voir `BalsamaApp.tsx`), et la
 * base reste seule juge de ce qui est lu (RLS). Le propriétaire n'a pas
 * de carte de permissions (`null`) : il a tout.
 *
 *  - voir toute l'équipe     portée `taches` = « all »
 *  - créer une tâche         action `taches.create`
 *  - terminer / reporter     `peutTerminerUneTache` = action `taches.edit`
 *  - réassigner              action `taches.assign`
 *  - créer un événement      le module `agenda` (l'ancien agenda n'a pas
 *                            d'action dédiée : qui le voit peut créer)
 *  - créer un rappel         action `rappels.create`
 *  - activer un rappel       la base : on ne voit que les siens
 *  - une échéance externe    le module SOURCE doit être visible (achats,
 *                            devis, livraisons) — jamais plus large
 */
export interface DroitsOrganisation {
  proprietaire: boolean;
  voitTouteLEquipe: boolean;
  voitVueEquipe: boolean;
  voitTaches: boolean;
  voitAgenda: boolean;
  voitRappels: boolean;
  creerTache: boolean;
  modifierTache: boolean;
  attribuerTache: boolean;
  creerEvenement: boolean;
  creerRappel: boolean;
  voitModule: (cle: string) => boolean;
}

export function useOrganisationPermissions(permissions: PermissionsMap | null): DroitsOrganisation {
  return useMemo(() => {
    const tout = permissions === null;
    const p = permissions ?? {};
    const voit = (cle: string) => tout || isModuleVisible(p, cle);
    const action = (cle: string, a: string) => tout || hasModuleAction(p, cle, a);
    return {
      proprietaire: tout,
      voitTouteLEquipe: tout || getModuleScope(p, "taches") === "all",
      voitVueEquipe: voit("vue_equipe"),
      voitTaches: voit("taches"),
      voitAgenda: voit("agenda"),
      voitRappels: voit("rappels"),
      creerTache: voit("taches") && action("taches", "create"),
      modifierTache: voit("taches") && action("taches", "edit"),
      attribuerTache: voit("taches") && action("taches", "assign"),
      creerEvenement: voit("agenda"),
      creerRappel: voit("rappels") && action("rappels", "create"),
      voitModule: voit,
    };
  }, [permissions]);
}
