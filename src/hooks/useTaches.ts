import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import type { Tache } from "../lib/taches";

type TacheInsert = Database["public"]["Tables"]["taches"]["Insert"];
type TacheUpdate = Database["public"]["Tables"]["taches"]["Update"];

export interface SaisieTache {
  titre: string;
  description?: string | null;
  echeance?: string | null;
  priorite?: string;
  assigneeId?: string | null;
}

/**
 * Les tâches d'une boutique.
 *
 * Ce que la requête rapporte n'est pas filtré ici : c'est la base qui
 * décide. La politique de lecture de `taches` ne rend que les tâches
 * qu'on a créées, celles qui nous sont attribuées, et toutes si la
 * portée accordée vaut « toute l'entreprise ». Refiltrer côté écran
 * donnerait deux règles à tenir d'accord, dont une seule protège
 * vraiment.
 *
 * `createur_id` est posé ici et non par la base, parce que la politique
 * d'écriture exige qu'il vaille l'identifiant de celui qui écrit : c'est
 * ce qui empêche de créer une tâche au nom de quelqu'un d'autre.
 */
export function useTaches(storeId: string | null, moiId: string | null) {
  const [taches, setTaches] = useState<Tache[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId) {
      setTaches([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .from("taches")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setErreur(error ? error.message : null);
    setTaches(error ? [] : (data ?? []));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const creer = useCallback(
    async (saisie: SaisieTache): Promise<{ error: string | null }> => {
      if (!storeId || !moiId) return { error: "Aucune boutique active." };
      const ligne: TacheInsert = {
        store_id: storeId,
        createur_id: moiId,
        // Sans destinataire choisi, la tâche est pour soi. C'est le cas
        // le plus fréquent, et une tâche sans personne n'avance pas.
        assignee_id: saisie.assigneeId ?? moiId,
        titre: saisie.titre.trim(),
        description: saisie.description?.trim() || null,
        echeance: saisie.echeance || null,
        priorite: saisie.priorite ?? "moyenne",
      };
      const { error } = await supabase.from("taches").insert(ligne);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [storeId, moiId, charger],
  );

  const modifier = useCallback(
    async (id: string, patch: TacheUpdate): Promise<{ error: string | null }> => {
      const { error } = await supabase.from("taches").update(patch).eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  /**
   * Changer d'état. `termine_le` suit le statut dans les deux sens : une
   * tâche rouverte ne doit pas garder la date à laquelle on l'avait crue
   * finie.
   */
  const changerStatut = useCallback(
    (id: string, statut: string) =>
      modifier(id, {
        statut,
        termine_le: statut === "termine" ? new Date().toISOString() : null,
      }),
    [modifier],
  );

  const supprimer = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from("taches").delete().eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  return {
    taches,
    chargement,
    erreur,
    recharger: charger,
    creer,
    modifier,
    changerStatut,
    supprimer,
  };
}
