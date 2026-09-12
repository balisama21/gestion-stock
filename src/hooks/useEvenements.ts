import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import type { Evenement } from "../lib/evenements";

type EvenementInsert = Database["public"]["Tables"]["evenements"]["Insert"];

export interface SaisieEvenement {
  titre: string;
  description?: string | null;
  lieu?: string | null;
  /** AAAA-MM-JJ. */
  jour: string;
  /** HH:MM, ignoré si la journée entière est cochée. */
  heure?: string;
  dureeMinutes?: number;
  journeeEntiere?: boolean;
  nature?: string;
  visibilite?: string;
  /** Identifiants des membres choisis, pour `visibilite = "choisis"`. */
  invites?: string[];
}

/**
 * Les événements d'agenda d'une boutique.
 *
 * Comme pour les tâches, aucun filtrage ici : ce que la requête rapporte
 * est déjà ce que la politique de sécurité a laissé passer. Un
 * collaborateur reçoit les siens, ceux partagés avec l'équipe, et ceux
 * partagés nommément avec lui — jamais les rendez-vous privés d'un
 * collègue, pas même s'il dirige la boutique.
 *
 * ── L'heure et le fuseau ──
 *
 * La saisie donne un jour et une heure locale. `new Date(a, m-1, j, h,
 * min)` construit cet instant DANS le fuseau du navigateur, et
 * `toISOString()` le convertit alors correctement en temps universel
 * pour la base. C'est le seul endroit où `toISOString` est juste : il
 * s'applique à un instant déjà situé, pas à une date qu'on voudrait
 * lire.
 */
export function useEvenements(storeId: string | null, moiId: string | null) {
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId) {
      setEvenements([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data, error } = await supabase
      .from("evenements")
      .select("*")
      .eq("store_id", storeId)
      .order("debut", { ascending: true });
    setErreur(error ? error.message : null);
    setEvenements(error ? [] : (data ?? []));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const creer = useCallback(
    async (s: SaisieEvenement): Promise<{ error: string | null }> => {
      if (!storeId || !moiId) return { error: "Aucune boutique active." };

      const [a, m, j] = s.jour.split("-").map(Number);
      const [h, min] = (s.heure || "09:00").split(":").map(Number);
      const debut = s.journeeEntiere
        ? new Date(a, m - 1, j, 0, 0, 0)
        : new Date(a, m - 1, j, h, min, 0);
      const fin = s.journeeEntiere
        ? new Date(a, m - 1, j, 23, 59, 0)
        : new Date(debut.getTime() + (s.dureeMinutes ?? 60) * 60000);

      const ligne: EvenementInsert = {
        store_id: storeId,
        createur_id: moiId,
        titre: s.titre.trim(),
        description: s.description?.trim() || null,
        lieu: s.lieu?.trim() || null,
        debut: debut.toISOString(),
        fin: fin.toISOString(),
        journee_entiere: s.journeeEntiere ?? false,
        nature: s.nature ?? "rendez_vous",
        visibilite: s.visibilite ?? "prive",
      };

      const { data, error } = await supabase.from("evenements").insert(ligne).select("id").single();
      if (error) return { error: error.message };

      // Les invités nommés, s'il y en a. L'échec de cette seconde
      // écriture ne doit pas faire croire que l'événement n'existe pas :
      // il est créé, il est simplement encore privé.
      if (s.visibilite === "choisis" && s.invites?.length && data?.id) {
        const { error: erreurInvites } = await supabase
          .from("evenement_participants")
          .insert(s.invites.map((membre_id) => ({ evenement_id: data.id, membre_id })));
        if (erreurInvites) {
          await charger();
          return { error: `Événement créé, mais le partage a échoué : ${erreurInvites.message}` };
        }
      }

      await charger();
      return { error: null };
    },
    [storeId, moiId, charger],
  );

  const supprimer = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.from("evenements").delete().eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  return { evenements, chargement, erreur, recharger: charger, creer, supprimer };
}
