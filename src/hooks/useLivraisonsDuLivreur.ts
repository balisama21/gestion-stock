import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Livraison } from "../lib/livraisons";

/**
 * Les courses d'un livreur, et rien d'autre.
 *
 * Le hook général `useStoreData` interroge dix-sept tables : un livreur
 * n'a le droit d'en lire aucune, et les lui demander quand même ferait
 * dix-sept requêtes pour dix-sept réponses vides. Il a donc le sien, qui
 * ne demande que ce qu'il peut voir.
 *
 * Le filtre sur `livreur_id` est un confort d'écriture, pas une
 * protection : c'est la règle posée en base qui décide, et elle ne lui
 * montrerait de toute façon que les siennes.
 */
export function useLivraisonsDuLivreur(storeId: string | null, userId: string | null) {
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId || !userId) {
      setLivraisons([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("store_id", storeId)
      .eq("livreur_id", userId)
      .order("date_prevue", { ascending: true, nullsFirst: false });

    if (error) setErreur(error.message);
    else {
      setErreur(null);
      setLivraisons(data ?? []);
    }
    setChargement(false);
  }, [storeId, userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Faire avancer une course.
   *
   * Passe par la fonction de la base, jamais par une écriture directe :
   * une règle de ligne ne sait pas restreindre des colonnes, et une
   * écriture libre laisserait le livreur changer le montant à encaisser
   * ou s'attribuer la course d'un autre.
   */
  const avancer = useCallback(
    async (
      id: string,
      statut: "en_cours" | "livree" | "echouee",
      options?: { montantEncaisse?: number | null; motifEchec?: string | null },
    ) => {
      const { error } = await supabase.rpc("avancer_livraison", {
        p_delivery_id: id,
        p_statut: statut,
        p_montant_encaisse: options?.montantEncaisse ?? null,
        p_motif_echec: options?.motifEchec ?? null,
      });
      if (!error) await charger();
      return { error: error?.message ?? null };
    },
    [charger],
  );

  return { livraisons, chargement, erreur, recharger: charger, avancer };
}
