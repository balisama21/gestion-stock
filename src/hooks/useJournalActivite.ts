import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type LigneJournal = Database["public"]["Tables"]["journal_activite"]["Row"];

/** Au-delà, on ne lit plus une cloche, on consulte un registre. */
const LIMITE = 80;

/**
 * Le journal des gestes : qui a modifié, qui a supprimé.
 *
 * Il ne charge QUE les modifications et les suppressions, jamais les
 * créations. Ce n'est pas un oubli : les créations se déduisent déjà des
 * données que l'application charge pour ses écrans, et elles remontent à
 * l'ouverture de la boutique, bien avant que ce journal existe. Les
 * reprendre ici les afficherait deux fois, et le doublon commencerait
 * précisément le jour de la mise en service — le genre de bizarrerie
 * qu'on met des heures à comprendre plus tard.
 *
 * Ce que seul ce journal peut dire : une ligne effacée a disparu des
 * données, une ligne corrigée n'a gardé que sa valeur d'arrivée.
 *
 * Ce que la base laisse lire est décidé par sa politique de sécurité :
 * le propriétaire voit tout ce qui s'est passé chez lui, un
 * collaborateur ne voit que ses propres gestes. Il n'y a donc rien à
 * filtrer ici — ce qui revient est déjà ce qui peut être vu.
 */
export function useJournalActivite(storeId: string | null) {
  const [lignes, setLignes] = useState<LigneJournal[]>([]);

  const charger = useCallback(async () => {
    if (!storeId) {
      setLignes([]);
      return;
    }
    const { data, error } = await supabase
      .from("journal_activite")
      .select("*")
      .eq("store_id", storeId)
      .neq("action", "creation")
      .order("cree_le", { ascending: false })
      .limit(LIMITE);

    // Un journal indisponible ne doit rien casser : la cloche garde ses
    // alertes et son activité déduite, elle perd seulement les
    // corrections et les suppressions.
    setLignes(error ? [] : (data ?? []));
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return { lignes, recharger: charger };
}
