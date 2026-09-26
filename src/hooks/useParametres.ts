import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Json } from "../lib/database.types";
import type { ValeursParametres } from "../lib/parametres";

export function useParametres(storeId: string | null, userId: string | null) {
  const [valeurs, setValeurs] = useState<ValeursParametres>({});
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId) {
      setValeurs({});
      setChargement(false);
      return;
    }
    const { data } = await supabase
      .from("parametres_boutique")
      .select("cle, valeur")
      .eq("store_id", storeId);
    setValeurs(Object.fromEntries((data ?? []).map((l) => [l.cle, l.valeur])));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const enregistrer = useCallback(
    async (cle: string, valeur: Json): Promise<{ error: string | null }> => {
      if (!storeId) return { error: "Aucune boutique active." };
      const { error } = await supabase
        .from("parametres_boutique")
        .upsert(
          { store_id: storeId, cle, valeur, updated_by: userId },
          { onConflict: "store_id,cle" },
        );
      if (error) return { error: error.message };
      setValeurs((v) => ({ ...v, [cle]: valeur }));
      return { error: null };
    },
    [storeId, userId],
  );

  return { valeurs, chargement, enregistrer, recharger: charger };
}
