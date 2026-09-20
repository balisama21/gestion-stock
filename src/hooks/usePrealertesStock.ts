import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Les préalertes que la base a laissées sortir.
 *
 * ── Pourquoi on ne les recalcule pas ici ──
 *
 * L'application saurait très bien dire, à partir des produits qu'elle a
 * déjà en mémoire, lesquels sont dans la bande. Mais ce n'est pas la
 * question à laquelle la cloche répond. Elle ne dit pas « où en est le
 * stock » — le tableau de bord le dit, en direct — elle dit « voilà ce
 * dont on vous a prévenu ».
 *
 * Or c'est la base qui en décide, et elle seule :
 *
 * — l'ANTI-RÉPÉTITION vit là-bas. Un produit qui oscille autour de son
 *   niveau ne doit prévenir qu'une fois ; un calcul refait à chaque
 *   chargement ne saurait pas s'il a déjà prévenu ;
 * — le RÉSUMÉ QUOTIDIEN retient les franchissements jusqu'à l'heure
 *   choisie. Un calcul local sonnerait tout de suite, et le réglage ne
 *   voudrait plus rien dire ;
 * — le SILENCE À L'ACTIVATION repose sur des lignes marquées « reprise »
 *   que seule la base connaît.
 *
 * La vue `prealertes_a_annoncer` fait déjà le tri : franchissement réel,
 * produit encore dans la bande orange. Il ne reste ici qu'à ne garder
 * que ce qui est SORTI (`notifiee_le` posée).
 *
 * Liste vide quand la boutique n'a pas activé la préalerte : la table
 * n'a alors aucune ligne pour elle, et la cloche ne change pas d'un
 * pixel.
 */

export interface PrealerteAnnoncee {
  productId: string;
  produit: string;
  stock: number;
  seuil: number;
  unite: string | null;
}

export function usePrealertesStock(storeId: string | null) {
  const [prealertes, setPrealertes] = useState<PrealerteAnnoncee[]>([]);

  const charger = useCallback(async () => {
    if (!storeId) {
      setPrealertes([]);
      return;
    }

    const { data, error } = await supabase
      .from("prealertes_a_annoncer")
      .select("product_id, produit, stock_actuel, seuil_alerte, unite")
      .eq("store_id", storeId)
      .not("notifiee_le", "is", null)
      // Le plus bas d'abord : c'est celui qu'il faut commander en premier.
      .order("stock_actuel", { ascending: true });

    // Une erreur de lecture n'a pas à faire disparaître l'écran : la
    // cloche perd une alerte, le reste continue.
    setPrealertes(
      error || !data
        ? []
        : data.map((l) => ({
            productId: l.product_id as string,
            produit: l.produit as string,
            stock: l.stock_actuel as number,
            seuil: l.seuil_alerte as number,
            unite: l.unite as string | null,
          })),
    );
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return { prealertes, recharger: charger };
}
