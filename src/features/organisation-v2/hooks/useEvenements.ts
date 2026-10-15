import { useCallback, useRef, useState } from "react";
import type {
  useEvenements as useEvenementsApp,
  SaisieEvenement,
} from "../../../hooks/useEvenements";
import type { DroitsOrganisation } from "./useOrganisationPermissions";
import type { Dire } from "./useTaches";

export type SourceEvenements = ReturnType<typeof useEvenementsApp>;

/**
 * Créer un événement : par `useEvenements().creer`, la fonction de
 * l'agenda actuel, qui place l'heure saisie dans le fuseau local avant
 * de l'envoyer. Rien d'autre n'est écrit d'ici.
 */
export function useActionsEvenements(
  source: SourceEvenements,
  droits: DroitsOrganisation,
  dire: Dire,
) {
  const [occupe, setOccupe] = useState(false);
  const verrou = useRef(false);

  const creer = useCallback(
    async (saisie: SaisieEvenement) => {
      if (!droits.creerEvenement || verrou.current) return false;
      verrou.current = true;
      setOccupe(true);
      try {
        const { error } = await source.creer(saisie);
        if (error) {
          dire(`Échec : ${error}`, true);
          return false;
        }
        dire("Événement créé");
        return true;
      } finally {
        verrou.current = false;
        setOccupe(false);
      }
    },
    [droits.creerEvenement, source, dire],
  );

  return { occupe, creer };
}
