import { useCallback, useEffect, useRef, useState } from "react";
import {
  ModaleConfirmation,
  type DemandeConfirmation,
  type OptionsConfirmation,
} from "../components/shared/ModaleConfirmation";

export type { OptionsConfirmation };

/**
 * Remplace la boîte de confirmation du navigateur par une modale de
 * l'application.
 *
 * La boîte du navigateur était grise, bloquante, sans rapport avec le
 * reste de l'interface — et sur téléphone, elle affichait l'adresse du
 * site en guise de titre. Celle-ci s'utilise de la même façon, à un
 * `await` près :
 *
 *   const { confirmer, modaleConfirmation } = useConfirmation();
 *   …
 *   if (!(await confirmer("Supprimer ?", { danger: true }))) return;
 *   …
 *   return <>{…}{modaleConfirmation}</>;
 *
 * La promesse rend `false` sur « Annuler », la croix, Échap, un clic à
 * côté — tout ce qui n'est pas un oui franc. Les boutons se verrouillent
 * dès la réponse donnée : un double clic ne confirme pas deux fois.
 *
 * Un hook par composant plutôt qu'un fournisseur global : chaque vue
 * reste autonome, et ses tests n'ont rien à envelopper.
 */
export function useConfirmation() {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const resoudre = useRef<((oui: boolean) => void) | null>(null);

  const confirmer = useCallback(
    (question: string, options?: OptionsConfirmation) =>
      new Promise<boolean>((resolve) => {
        // Une question restée en suspens est abandonnée, pas confirmée.
        resoudre.current?.(false);
        resoudre.current = resolve;
        setDemande({ question, ...options });
        setOuverte(true);
      }),
    [],
  );

  const repondre = useCallback((oui: boolean) => {
    const r = resoudre.current;
    if (!r) return;
    resoudre.current = null;
    setOuverte(false);
    r(oui);
  }, []);

  // Démontée en pleine question, la vue reçoit un non : la suite de son
  // gestionnaire s'arrête là, comme sur « Annuler ».
  useEffect(() => () => resoudre.current?.(false), []);

  const modaleConfirmation = (
    <ModaleConfirmation open={ouverte} demande={demande} repondu={!ouverte} onRepondre={repondre} />
  );

  return { confirmer, modaleConfirmation };
}
