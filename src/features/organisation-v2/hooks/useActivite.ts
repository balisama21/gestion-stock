import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { LigneJournal } from "../../../hooks/useJournalActivite";

/** Ce qu'on lit d'activité : un fil, pas un registre. */
const LIMITE = 30;

/**
 * L'ACTIVITÉ DE L'ORGANISATION — lecture seule
 *
 * Le journal d'activité reçoit déjà, par déclencheur, chaque création,
 * modification et suppression de TÂCHE, avec l'avant et l'après de
 * chaque colonne (`20260913100000_organisation_tables.sql`). Les
 * événements et les rappels, eux, n'y sont pas journalisés : le fil ne
 * parle donc que des tâches, et ne prétend pas le contraire.
 *
 * Contrairement à `useJournalActivite` (la cloche), on garde ici les
 * créations : « a créé la tâche » fait partie de ce fil.
 *
 * La base décide de ce qui revient : le propriétaire voit tout ce qui
 * s'est passé chez lui, un collaborateur ses propres gestes.
 */
export function useActivite(storeId: string | null, actif: boolean) {
  const [lignes, setLignes] = useState<LigneJournal[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  const charger = useCallback(async () => {
    if (!storeId || !actif) {
      setLignes([]);
      return;
    }
    const { data, error } = await supabase
      .from("journal_activite")
      .select("*")
      .eq("store_id", storeId)
      .eq("entite", "taches")
      .order("cree_le", { ascending: false })
      .limit(LIMITE);
    setErreur(error ? error.message : null);
    setLignes(error ? [] : (data ?? []));
    setCharge(true);
  }, [storeId, actif]);

  useEffect(() => {
    charger();
  }, [charger]);

  return { lignes, erreur, charge, recharger: charger };
}
