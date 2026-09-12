import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Tache } from "../lib/taches";

/**
 * Les tâches d'un livreur — les siennes, et rien d'autre.
 *
 * Un crochet à part plutôt que `useTaches`, pour la même raison qui a
 * fait écrire `useLivraisonsDuLivreur` : l'espace du livreur ne monte
 * aucune des données de la boutique, et brancher le crochet ordinaire
 * ferait partir des requêtes que la base refuserait une à une. Ici,
 * une seule lecture, sur une seule table.
 *
 * Le filtre `assignee_id` n'est pas une sécurité — la politique de
 * lecture de `taches` ne rendrait de toute façon que celles-là à un
 * livreur. C'est une économie : demander moins que ce qu'on a le droit
 * de lire évite de faire trier la base pour rien.
 *
 * Les tâches terminées ne sont pas chargées. Un livreur regarde ce qu'il
 * lui reste à faire ; l'historique de son travail se consulte ailleurs,
 * par quelqu'un dont c'est le rôle.
 */
export function useTachesDuLivreur(storeId: string | null, userId: string | null) {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId || !userId) {
      setTaches([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .from("taches")
      .select("*")
      .eq("store_id", storeId)
      .eq("assignee_id", userId)
      .neq("statut", "termine")
      .order("echeance", { ascending: true, nullsFirst: false });

    // Une erreur ici ne doit pas priver le livreur de ses courses :
    // l'écran perd sa section « tâches », il garde tout le reste.
    setTaches(error ? [] : (data ?? []));
    setChargement(false);
  }, [storeId, userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const avancerTache = useCallback(
    async (id: string, statut: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from("taches")
        .update({
          statut,
          termine_le: statut === "termine" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  return { taches, chargementTaches: chargement, rechargerTaches: charger, avancerTache };
}
