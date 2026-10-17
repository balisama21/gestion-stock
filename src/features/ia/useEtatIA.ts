import { useCallback, useEffect, useState } from "react";
import { lireEtatIA, type EtatIA } from "./clientIA";

/** État de l'IA pour la boutique active ; `null` tant qu'il se charge. */
export function useEtatIA(storeId: string | null | undefined) {
  const [etat, setEtat] = useState<EtatIA | null>(null);
  const [chargement, setChargement] = useState(false);

  const rafraichir = useCallback(async () => {
    if (!storeId) {
      setEtat(null);
      return;
    }
    setChargement(true);
    try {
      setEtat(await lireEtatIA(storeId));
    } finally {
      setChargement(false);
    }
  }, [storeId]);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  return { etat, chargement, rafraichir };
}
