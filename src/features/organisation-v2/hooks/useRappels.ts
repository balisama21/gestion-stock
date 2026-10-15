import { useCallback, useRef, useState } from "react";
import type { useRappels as useRappelsApp, SaisieRappel } from "../../../hooks/useRappels";
import type { DroitsOrganisation } from "./useOrganisationPermissions";
import type { Dire } from "./useTaches";

export type SourceRappels = ReturnType<typeof useRappelsApp>;

/**
 * Les écritures sur les rappels, par les fonctions de l'écran actuel :
 *  - créer                 `useRappels().creer` (respecte la contrainte
 *                          « une heure OU un instant » de la base)
 *  - activer / désactiver  `useRappels().basculer(id, actif)` → `actif`
 *                          seul ; ni la récurrence ni l'heure ne bougent.
 */
export function useActionsRappels(source: SourceRappels, droits: DroitsOrganisation, dire: Dire) {
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

  const basculer = useCallback(
    (id: string, actif: boolean) =>
      droits.voitRappels
        ? executer(
            `bascule-${id}`,
            () => source.basculer(id, actif),
            actif ? "Rappel activé" : "Rappel désactivé",
          )
        : Promise.resolve(false),
    [droits.voitRappels, executer, source],
  );

  const creer = useCallback(
    (saisie: SaisieRappel) =>
      droits.creerRappel
        ? executer("creer", () => source.creer(saisie), "Rappel créé")
        : Promise.resolve(false),
    [droits.creerRappel, executer, source],
  );

  return { occupe, basculer, creer };
}
