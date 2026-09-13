import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PaiementSalaire, Salaire } from "../lib/salaires";

/**
 * Ma paie — pour qui ne monte pas l'application entière.
 *
 * Un crochet à part plutôt que `useStoreData`, pour la même raison qui a
 * fait écrire `useTachesDuLivreur` : l'espace du livreur ne charge
 * aucune donnée de la boutique, et brancher le crochet ordinaire ferait
 * partir vingt requêtes que la base refuserait une à une. Ici, deux
 * lectures, sur deux tables.
 *
 * Le filtre `user_id` n'est pas une sécurité : les règles de lecture ne
 * rendraient de toute façon que ses propres lignes. C'est une économie,
 * et cela vaut aussi comme documentation — demander précisément ce qu'on
 * a le droit de lire dit ce que l'écran attend.
 *
 * Un livreur n'est PAS membre au sens de `is_store_member` — cette
 * fonction l'exclut explicitement. Les règles du module salaires ne
 * passent donc jamais par elle : elles vérifient la boutique verrouillée
 * et le salaire déclaré. Sans quoi ce crochet ne rendrait jamais rien.
 */
export function useMaPaie(storeId: string | null, userId: string | null) {
  const [salaires, setSalaires] = useState<Salaire[]>([]);
  const [paiements, setPaiements] = useState<PaiementSalaire[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId || !userId) {
      setSalaires([]);
      setPaiements([]);
      setChargement(false);
      return;
    }
    setChargement(true);

    const [salairesRes, paiementsRes] = await Promise.all([
      supabase
        .from("salaires")
        .select("*")
        .eq("store_id", storeId)
        .eq("user_id", userId)
        .order("debut_le", { ascending: false }),
      supabase
        .from("paiements_salaire")
        .select("*")
        .eq("store_id", storeId)
        .eq("user_id", userId)
        .order("periode", { ascending: false }),
    ]);

    // Une erreur ici ne doit pas priver le livreur de ses courses :
    // l'écran perd sa section « ma paie », il garde tout le reste.
    setSalaires(salairesRes.error ? [] : (salairesRes.data ?? []));
    setPaiements(paiementsRes.error ? [] : (paiementsRes.data ?? []));
    setChargement(false);
  }, [storeId, userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Ouvrir une demande d'avance.
   *
   * Toujours `en_attente` : ce n'est pas ce code qui l'impose, c'est la
   * base. Un employé qui enverrait `versee` se verrait refuser la ligne.
   */
  const demanderUneAvance = useCallback(
    async (data: {
      employe: string;
      montant: number;
      motif: string | null;
      periode: string;
    }): Promise<{ error: string | null }> => {
      if (!storeId || !userId) return { error: "Non autorisé" };

      const { error } = await supabase.from("paiements_salaire").insert({
        store_id: storeId,
        employe: data.employe,
        user_id: userId,
        demande_par: userId,
        type: "avance",
        statut: "en_attente",
        montant: data.montant,
        periode: data.periode,
        motif: data.motif,
      });

      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [storeId, userId, charger],
  );

  /** Retirer sa demande, tant qu'elle attend. Le reste lui est refusé. */
  const retirerLaDemande = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from("paiements_salaire")
        .update({ statut: "annulee" })
        .eq("id", id);
      if (error) return { error: error.message };
      await charger();
      return { error: null };
    },
    [charger],
  );

  return {
    salaires,
    paiements,
    chargementPaie: chargement,
    demanderUneAvance,
    retirerLaDemande,
  };
}
