import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  DEVISE_PAR_DEFAUT,
  ficheDevise,
  type Devise,
  type DeviseBoutique,
  type HistoriqueTaux,
} from "../lib/devises";

type Resultat = Promise<{ error: string | null }>;

export function useDevises(storeId: string | null, userId: string | null) {
  const [catalogue, setCatalogue] = useState<Devise[]>([]);
  const [devises, setDevises] = useState<DeviseBoutique[]>([]);
  const [historique, setHistorique] = useState<HistoriqueTaux[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId) {
      setDevises([]);
      setChargement(false);
      return;
    }
    const [cat, dev, hist] = await Promise.all([
      supabase.from("devises").select("*").order("region").order("code"),
      supabase.from("devises_boutique").select("*").eq("store_id", storeId).order("code"),
      supabase
        .from("historique_taux")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setCatalogue((cat.data ?? []).filter((d) => !d.store_id || d.store_id === storeId));
    setDevises(dev.data ?? []);
    setHistorique(hist.data ?? []);
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const principale = useMemo(
    () => devises.find((d) => d.principale)?.code ?? DEVISE_PAR_DEFAUT,
    [devises],
  );

  const apres = useCallback(
    async (error: { message: string } | null) => {
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  const definirPrincipale = useCallback(
    async (code: string): Resultat => {
      if (!storeId) return { error: "Aucune boutique active." };
      const { error } = await supabase.rpc("definir_devise_principale", {
        p_store_id: storeId,
        p_code: code,
      });
      return apres(error);
    },
    [storeId, apres],
  );

  const ajouter = useCallback(
    async (code: string, taux: number, mode: "manuel" | "auto"): Resultat => {
      if (!storeId) return { error: "Aucune boutique active." };
      // Une boutique créée avant les devises n'a pas encore de principale.
      if (!devises.some((d) => d.principale)) {
        const { error } = await supabase.rpc("definir_devise_principale", {
          p_store_id: storeId,
          p_code: principale,
        });
        if (error) return { error: error.message };
      }
      const existante = devises.find((d) => d.code === code);
      const { error } = existante
        ? await supabase
            .from("devises_boutique")
            .update({
              actif: true,
              taux,
              mode_taux: mode,
              taux_source: mode === "auto" ? "auto" : "manuel",
            })
            .eq("id", existante.id)
        : await supabase.from("devises_boutique").insert({
            store_id: storeId,
            code,
            taux,
            mode_taux: mode,
            taux_source: mode === "auto" ? "auto" : "manuel",
          });
      if (error) return { error: error.message };
      if (mode === "auto") await actualiserInterne(storeId);
      return apres(null);
    },
    [storeId, devises, principale, apres],
  );

  const modifier = useCallback(
    async (
      id: string,
      patch: Partial<Pick<DeviseBoutique, "taux" | "mode_taux" | "actif">>,
    ): Resultat => {
      const complet: Partial<DeviseBoutique> = { ...patch };
      if (patch.taux !== undefined || patch.mode_taux === "manuel") {
        complet.taux_source = "manuel";
        complet.derniere_erreur = null;
      }
      const { error } = await supabase.from("devises_boutique").update(complet).eq("id", id);
      if (error) return { error: error.message };
      if (patch.mode_taux === "auto" && storeId) await actualiserInterne(storeId);
      return apres(null);
    },
    [storeId, apres],
  );

  const retirer = useCallback(
    async (id: string): Resultat => {
      const { error } = await supabase.from("devises_boutique").delete().eq("id", id);
      return apres(error);
    },
    [apres],
  );

  const creerDevise = useCallback(
    async (d: { code: string; nom: string; symbole: string; decimales: number }): Resultat => {
      if (!storeId || !userId) return { error: "Aucune boutique active." };
      const { error } = await supabase.from("devises").insert({
        ...d,
        code: d.code.trim().toUpperCase(),
        store_id: storeId,
        created_by: userId,
        region: "Ajoutée par la boutique",
      });
      return apres(error);
    },
    [storeId, userId, apres],
  );

  const supprimerDevise = useCallback(
    async (id: string): Resultat => {
      const { error } = await supabase.from("devises").delete().eq("id", id);
      return apres(error);
    },
    [apres],
  );

  /** Rafraîchit la référence depuis l'API, puis recalcule les taux « auto ». */
  const actualiser = useCallback(async (): Resultat => {
    if (!storeId) return { error: "Aucune boutique active." };
    const err = await actualiserInterne(storeId);
    await charger();
    return { error: err };
  }, [storeId, charger]);

  return {
    catalogue,
    devises,
    historique,
    principale,
    fichePrincipale: ficheDevise(catalogue, principale),
    chargement,
    definirPrincipale,
    ajouter,
    modifier,
    retirer,
    creerDevise,
    supprimerDevise,
    actualiser,
  };
}

async function actualiserInterne(storeId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("synchroniser-taux", {
    body: { source: "app" },
  });
  if (error) {
    // L'API peut être tombée : on recalcule au moins depuis le dernier taux connu.
    const { error: e2 } = await supabase.rpc("actualiser_mes_taux", { p_store_id: storeId });
    return e2?.message ?? "Service de taux injoignable : dernier taux connu conservé.";
  }
  return (data as { erreur?: string | null })?.erreur
    ? "Source des taux indisponible : dernier taux connu conservé."
    : null;
}

export type DevisesBoutique = ReturnType<typeof useDevises>;
