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

/**
 * Marque des documents, e-mails et exports : celle de la boutique ouverte
 * (stores.marque_id), pas celle du domaine. N'habille pas la page.
 * `marqueId` indéfini (colonne absente) : la marque du domaine.
 */
export function MarqueDeLaBoutique({
  storeId,
  marqueId,
  children,
}: {
  storeId: string | null;
  marqueId: string | null | undefined;
  children: ReactNode;
}) {
  const duDomaine = useContext(ContexteMarque);
  const [lue, setLue] = useState<{ storeId: string; marque: Marque } | null>(null);

  useEffect(() => {
    if (!storeId || !marqueId) return;
    let annule = false;
    void supabase.rpc("marque_de_la_boutique", { p_store_id: storeId }).then(({ data, error }) => {
      const ligne = (data as LigneMarquePublique[] | null)?.[0];
      if (!annule && !error && ligne) setLue({ storeId, marque: marqueDepuisLigne(ligne) });
    });
    return () => {
      annule = true;
    };
  }, [storeId, marqueId]);

  const valeur =
    !storeId || marqueId === undefined
      ? duDomaine
      : marqueId === null
        ? MARQUE_PAR_DEFAUT
        : lue?.storeId === storeId
          ? lue.marque
          : duDomaine;

  return <ContexteMarque.Provider value={valeur}>{children}</ContexteMarque.Provider>;
}
