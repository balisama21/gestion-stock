import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import type { Rappel } from "../lib/rappels";

type RappelInsert = Database["public"]["Tables"]["rappels"]["Insert"];

export interface SaisieRappel {
  titre: string;
  recurrence: string;
  /** Pour un rappel ponctuel : AAAA-MM-JJ. */
  jour?: string;
  /** HH:MM, dans les deux cas. */
  heure: string;
  jourSemaine?: number | null;
  jourMois?: number | null;
  /** À qui il s'adresse. Vide = à soi. */
  destinataireId?: string | null;
}

/**
 * Les rappels d'une boutique.
 *
 * Aucun filtrage ici : la politique de sécurité ne rend que les rappels
 * qu'on reçoit et ceux qu'on a posés. Savoir de quoi un collègue a
 * besoin qu'on lui rappelle ne regarde personne — c'est la seule des
 * trois tables d'organisation qu'aucune portée n'ouvre, pas même au
 * propriétaire.
 */
export function useRappels(storeId: string | null, moiId: string | null) {
  const [rappels, setRappels] = useState<Rappel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId) {
      setRappels([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .from("rappels")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setErreur(error ? error.message : null);
    setRappels(error ? [] : (data ?? []));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const creer = useCallback(
    async (s: SaisieRappel): Promise<{ error: string | null }> => {
      if (!storeId || !moiId) return { error: "Aucune boutique active." };

      const ponctuel = s.recurrence === "aucune";
      let declencheLe: string | null = null;
      if (ponctuel) {
        if (!s.jour) return { error: "Indiquez le jour du rappel." };
        const [a, m, j] = s.jour.split("-").map(Number);
        const [h, min] = (s.heure || "09:00").split(":").map(Number);
        // Construit dans le fuseau du navigateur puis converti : c'est le
        // seul emploi juste de toISOString, sur un instant déjà situé.
        declencheLe = new Date(a, m - 1, j, h, min, 0).toISOString();
      }

      const ligne: RappelInsert = {
        store_id: storeId,
        createur_id: moiId,
        destinataire_id: s.destinataireId || moiId,
        titre: s.titre.trim(),
        recurrence: s.recurrence,
        declenche_le: declencheLe,
        // La contrainte de la base exige l'un ou l'autre : une heure pour
        // ce qui se répète, un instant pour ce qui ne se produit qu'une
        // fois. Envoyer les deux la ferait échouer.
        heure: ponctuel ? null : s.heure,
        jour_semaine: s.recurrence === "hebdomadaire" ? (s.jourSemaine ?? 1) : null,
        jour_mois: s.recurrence === "mensuel" ? (s.jourMois ?? 1) : null,
      };

      const { error } = await supabase.from("rappels").insert(ligne);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [storeId, moiId, charger],
  );

  const basculer = useCallback(
    async (id: string, actif: boolean): Promise<{ error: string | null }> => {
      const { error } = await supabase.from("rappels").update({ actif }).eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  const supprimer = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from("rappels").delete().eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  return { rappels, chargement, erreur, recharger: charger, creer, basculer, supprimer };
}
