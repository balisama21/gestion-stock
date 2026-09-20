import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  REGLAGES_PAR_DEFAUT,
  ecrireReglages,
  lireReglages,
  type ReglagesAlertesStock,
} from "../lib/prealerteStock";

/**
 * Les réglages de préalerte d'une boutique.
 *
 * ── PAS DE LIGNE = FONCTION DÉSACTIVÉE ──
 *
 * Une boutique qui n'a jamais ouvert cet écran n'a aucune ligne dans
 * `reglages_alertes_stock`, et c'est le cas normal : c'est ce qui rend
 * « désactivé par défaut » gratuit, sans reprise de données. La lecture
 * retombe alors sur `REGLAGES_PAR_DEFAUT`, qui porte exactement les
 * mêmes valeurs que les DEFAULT de la table.
 *
 * ── Appelé UNE fois, à la racine ──
 *
 * Trois endroits ont besoin de ces réglages : l'écran qui les règle, le
 * catalogue produits pour son filtre « à recommander », et le tableau
 * de bord pour sa couleur d'attention. Les faire lire séparément
 * laisserait deux copies diverger dès qu'on enregistre — le patron
 * activerait la préalerte et le catalogue continuerait de l'ignorer
 * jusqu'au rechargement. `BalsamaApp` le tient donc, et le distribue.
 */
export function useReglagesAlertesStock(storeId: string | null) {
  const [reglages, setReglages] = useState<ReglagesAlertesStock>(REGLAGES_PAR_DEFAUT);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId) {
      setReglages(REGLAGES_PAR_DEFAUT);
      setChargement(false);
      return;
    }
    setChargement(true);

    const { data, error } = await supabase
      .from("reglages_alertes_stock")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    setErreur(error ? error.message : null);
    setReglages(lireReglages(data));
    setChargement(false);
  }, [storeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * Enregistre, en créant la ligne au besoin.
   *
   * `upsert` plutôt qu'un `insert` suivi d'un `update` : la boutique
   * n'a pas de ligne tant qu'elle n'a rien réglé, et savoir laquelle
   * des deux opérations est la bonne demanderait une lecture de plus.
   *
   * Un refus de RLS sur un UPDATE est SILENCIEUX — la ligne devient
   * invisible et PostgREST répond « aucune ligne » plutôt qu'une
   * raison. C'est ce qui arrive sur une boutique verrouillée. On rend
   * donc une phrase explicite au lieu de laisser croire à un succès.
   */
  const enregistrer = useCallback(
    async (suite: ReglagesAlertesStock): Promise<{ error: string | null }> => {
      if (!storeId) return { error: "Aucune boutique active." };

      const { data, error } = await supabase
        .from("reglages_alertes_stock")
        .upsert(ecrireReglages(storeId, suite), { onConflict: "store_id" })
        .select()
        .maybeSingle();

      if (error) return { error: error.message };
      if (!data) {
        return {
          error:
            "Ces réglages n'ont pas pu être enregistrés. Une boutique dont l'abonnement a expiré ne se modifie plus.",
        };
      }

      setReglages(lireReglages(data));
      return { error: null };
    },
    [storeId],
  );

  return { reglages, chargement, erreur, enregistrer, recharger: charger };
}
