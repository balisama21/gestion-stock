import { useCallback, useRef, useState } from "react";
import type { useTaches as useTachesApp, SaisieTache } from "../../../hooks/useTaches";
import { ajouterJours, dateDuJour } from "../lib/dates";
import type { DroitsOrganisation } from "./useOrganisationPermissions";

export type SourceTaches = ReturnType<typeof useTachesApp>;
export type Dire = (texte: string, erreur?: boolean) => void;

/**
 * LES ÉCRITURES SUR LES TÂCHES
 *
 * Aucune requête n'est écrite ici : chaque action passe par une fonction
 * DÉJÀ présente dans `hooks/useTaches.ts`, celle qu'utilise l'écran
 * actuel. Ce fichier ajoute seulement ce que la maquette demande autour :
 * le contrôle du droit avant d'écrire, un verrou contre le double clic,
 * et le message de confirmation APRÈS la réponse de la base.
 *
 * Ce que chaque action écrit, et rien d'autre :
 *  - terminer / rouvrir   `changerStatut` → `statut`, `termine_le`
 *  - reporter à demain    `modifier(id, { echeance })`
 *  - réassigner           `modifier(id, { assignee_id })`
 *  - créer                `creer` → insert, créateur = soi
 */
export function useActionsTaches(source: SourceTaches, droits: DroitsOrganisation, dire: Dire) {
  const [occupe, setOccupe] = useState<string | null>(null);
  const verrou = useRef(false);

  const executer = useCallback(
    async (cle: string, ecrire: () => Promise<{ error: string | null }>, ok: string) => {
      if (verrou.current) return false;
      verrou.current = true;
      setOccupe(cle);
      try {
        const { error } = await ecrire();
        if (error) {
          dire(`Échec : ${error}`, true);
          return false;
        }
        dire(ok);
        return true;
      } finally {
        verrou.current = false;
        setOccupe(null);
      }
    },
    [dire],
  );

  const terminer = useCallback(
    (id: string) =>
      droits.modifierTache
        ? executer(`statut-${id}`, () => source.changerStatut(id, "termine"), "Tâche terminée")
        : Promise.resolve(false),
    [droits.modifierTache, executer, source],
  );

  const rouvrir = useCallback(
    (id: string) =>
      droits.modifierTache
        ? executer(`statut-${id}`, () => source.changerStatut(id, "a_faire"), "Tâche rouverte")
        : Promise.resolve(false),
    [droits.modifierTache, executer, source],
  );

  const reporterADemain = useCallback(
    (id: string) =>
      droits.modifierTache
        ? executer(
            `report-${id}`,
            () => source.modifier(id, { echeance: ajouterJours(dateDuJour(), 1) }),
            "Reportée à demain",
          )
        : Promise.resolve(false),
    [droits.modifierTache, executer, source],
  );

  const reassigner = useCallback(
    (id: string, assigneeId: string, nom: string) =>
      droits.attribuerTache
        ? executer(
            `assign-${id}`,
            () => source.modifier(id, { assignee_id: assigneeId }),
            `Réassignée à ${nom}`,
          )
        : Promise.resolve(false),
    [droits.attribuerTache, executer, source],
  );

  const creer = useCallback(
    (saisie: SaisieTache) =>
      droits.creerTache
        ? executer("creer", () => source.creer(saisie), "Tâche créée")
        : Promise.resolve(false),
    [droits.creerTache, executer, source],
  );

  return { occupe, terminer, rouvrir, reporterADemain, reassigner, creer };
}
