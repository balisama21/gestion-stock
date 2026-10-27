import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

/**
 * Relire une source DÈS qu'une autre personne l'a changée.
 *
 * `useRafraichissementDiscret` relit tout chaque minute ; ce crochet-ci
 * écoute Supabase Realtime et relit tout de suite la source concernée —
 * la tâche cochée par un collègue, la commande passée en préparation, la
 * livraison partie. Il ne remplace pas le battement : une table que la
 * publication `supabase_realtime` ne diffuse pas ne dit simplement rien,
 * et la minute suivante la rattrape.
 *
 * LA SÉCURITÉ RESTE CELLE DE LA BASE. Realtime ne transmet une ligne
 * qu'à quelqu'un dont la politique de lecture l'autorise, et le filtre
 * `store_id` limite l'écoute à la boutique active. On n'écoute que les
 * créations et les modifications : une suppression ne se filtre pas par
 * boutique côté Realtime, elle attend donc le battement.
 *
 * LES RAFALES NE FONT QU'UNE LECTURE. Une vente de dix lignes, c'est dix
 * événements : on attend qu'ils se calment avant de relire, une fois.
 */
export interface SourceTempsReel {
  table: string;
  relire: () => unknown;
}

const ATTENTE_MS = 900;

export function useTempsReel(
  storeId: string | null,
  actif: boolean,
  sources: SourceTempsReel[],
): void {
  const courantes = useRef(sources);
  courantes.current = sources;
  // La liste des tables, en clé stable : un nouveau tableau à chaque
  // rendu ne doit pas rouvrir le canal.
  const tables = sources.map((s) => s.table).join(",");

  useEffect(() => {
    if (!actif || !storeId || !tables) return;
    const enAttente = new Set<string>();
    let minuterie = 0;

    const relire = (table: string) => {
      enAttente.add(table);
      window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => {
        // Une même fonction de relecture sert plusieurs tables (les
        // données de la boutique) : elle n'est appelée qu'une fois.
        const faites = new Set<unknown>();
        for (const s of courantes.current) {
          if (!enAttente.has(s.table) || faites.has(s.relire)) continue;
          faites.add(s.relire);
          void s.relire();
        }
        enAttente.clear();
      }, ATTENTE_MS);
    };

    let canal = supabase.channel(`operations:${storeId}`);
    for (const table of tables.split(",")) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        canal = canal.on(
          "postgres_changes",
          { event, schema: "public", table, filter: `store_id=eq.${storeId}` },
          () => relire(table),
        );
      }
    }
    canal.subscribe();

    return () => {
      window.clearTimeout(minuterie);
      void supabase.removeChannel(canal);
    };
  }, [storeId, actif, tables]);
}
