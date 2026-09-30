import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import {
  MARQUE_PAR_DEFAUT,
  appliquerMarqueAuDocument,
  cacheMarqueFrais,
  ecrireCacheMarque,
  estHoteParDefaut,
  marqueCourante,
  marqueDepuisLigne,
  marqueDuRendu,
  type LigneMarquePublique,
  type Marque,
} from "../lib/marque";

const ContexteMarque = createContext<Marque>(MARQUE_PAR_DEFAUT);

export const useMarque = (): Marque => useContext(ContexteMarque);

/**
 * Premier rendu : la marque du rendu serveur (pas d'écart d'hydratation).
 * Ensuite : cache, puis réseau si le cache a plus de cinq minutes.
 */
export function MarqueProvider({ children }: { children: ReactNode }) {
  const [marque, setMarque] = useState<Marque>(marqueDuRendu);

  useEffect(() => {
    const enCache = marqueCourante();
    setMarque(enCache);
    appliquerMarqueAuDocument(enCache.parDefaut ? null : enCache);

    const hote = window.location.hostname;
    if (estHoteParDefaut(hote) || cacheMarqueFrais()) return;

    let annule = false;
    void supabase.rpc("get_public_branding", { p_hostname: hote }).then(({ data, error }) => {
      if (annule) return;
      if (error) {
        // Réseau ou migration absente : on garde ce qu'on a, sans
        // redemander à chaque chargement.
        ecrireCacheMarque(enCache.parDefaut ? null : enCache);
        return;
      }
      const ligne = (data as LigneMarquePublique[] | null)?.[0];
      const fraiche = ligne ? marqueDepuisLigne(ligne) : null;
      ecrireCacheMarque(fraiche);
      setMarque(fraiche ?? MARQUE_PAR_DEFAUT);
      appliquerMarqueAuDocument(fraiche);
    });
    return () => {
      annule = true;
    };
  }, []);

  return <ContexteMarque.Provider value={marque}>{children}</ContexteMarque.Provider>;
}
