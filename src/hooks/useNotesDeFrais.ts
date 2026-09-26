import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type NoteDeFrais = Database["public"]["Tables"]["notes_de_frais"]["Row"];
export type SaisieNoteDeFrais = Pick<
  NoteDeFrais,
  "date" | "beneficiaire" | "motif" | "montant" | "devise"
> &
  Partial<Pick<NoteDeFrais, "category_id" | "membre_id" | "personne_id" | "justificatif">>;

type Resultat = Promise<{ error: string | null }>;

/** La base ne rend que ses propres notes, ou toutes pour un responsable. */
export function useNotesDeFrais(storeId: string | null, userId: string | null) {
  const [notes, setNotes] = useState<NoteDeFrais[]>([]);
  const [peutGerer, setPeutGerer] = useState(false);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId) {
      setNotes([]);
      setChargement(false);
      return;
    }
    const [liste, droit] = await Promise.all([
      supabase
        .from("notes_de_frais")
        .select("*")
        .eq("store_id", storeId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.rpc("peut_gerer_notes_de_frais", { p_store_id: storeId }),
    ]);
    setNotes(liste.data ?? []);
    setPeutGerer(Boolean(droit.data));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const suite = useCallback(
    async (error: { message: string } | null) => {
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  const creer = useCallback(
    async (s: SaisieNoteDeFrais): Resultat => {
      if (!storeId || !userId) return { error: "Aucune boutique active." };
      const { error } = await supabase
        .from("notes_de_frais")
        .insert({ ...s, store_id: storeId, created_by: userId });
      return suite(error);
    },
    [storeId, userId, suite],
  );

  const modifier = useCallback(
    async (id: string, s: Partial<SaisieNoteDeFrais>): Resultat => {
      const { error } = await supabase.from("notes_de_frais").update(s).eq("id", id);
      return suite(error);
    },
    [suite],
  );

  const supprimer = useCallback(
    async (id: string): Resultat => {
      const { error } = await supabase.from("notes_de_frais").delete().eq("id", id);
      return suite(error);
    },
    [suite],
  );

  const decider = useCallback(
    async (id: string, decision: "validee" | "refusee" | "a_valider", motif?: string): Resultat => {
      const { error } = await supabase.rpc("decider_note_de_frais", {
        p_id: id,
        p_decision: decision,
        p_motif: motif ?? undefined,
      });
      return suite(error);
    },
    [suite],
  );

  const rembourser = useCallback(
    async (id: string, date: string): Resultat => {
      const { error } = await supabase.rpc("rembourser_note_de_frais", { p_id: id, p_date: date });
      return suite(error);
    },
    [suite],
  );

  return {
    notes,
    peutGerer,
    chargement,
    creer,
    modifier,
    supprimer,
    decider,
    rembourser,
    recharger: charger,
  };
}
