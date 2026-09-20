import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  REGLAGES_PAR_DEFAUT,
  ecrireReglages,
  lireReglages,
  type ProduitPourExemple,
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
 * ── Pourquoi les produits sont ici ──
 *
 * L'écran montre un exemple calculé sur un VRAI produit de la boutique
 * — « Avec un seuil de 3, vous serez prévenu à partir de 5 unités ». Un
 * exemple inventé se lit comme une documentation ; un produit que le
 * commerçant reconnaît se lit comme son magasin.
 *
 * On les demande ici plutôt que de les faire descendre depuis
 * `BalsamaApp` : trois colonnes sur les produits à seuil, une fois à
 * l'ouverture d'un onglet de réglages. Cela évite d'ajouter une
 * propriété à `ParametresView`, qui en porte déjà vingt.
 */
export function useReglagesAlertesStock(storeId: string | null) {
  const [reglages, setReglages] = useState<ReglagesAlertesStock>(REGLAGES_PAR_DEFAUT);
  const [produits, setProduits] = useState<ProduitPourExemple[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!storeId) {
      setReglages(REGLAGES_PAR_DEFAUT);
      setProduits([]);
      setChargement(false);
      return;
    }
    setChargement(true);

    const [ligne, catalogue] = await Promise.all([
      supabase.from("reglages_alertes_stock").select("*").eq("store_id", storeId).maybeSingle(),
      supabase
        .from("products")
        .select("display_name, seuil_alerte, stock_actuel")
        .eq("store_id", storeId)
        .eq("statut", "actif")
        .gt("seuil_alerte", 0),
    ]);

    setErreur(ligne.error ? ligne.error.message : null);
    setReglages(lireReglages(ligne.data));
    setProduits(
      (catalogue.data ?? []).map((p) => ({
        nom: p.display_name,
        seuil: p.seuil_alerte,
        stock: p.stock_actuel,
      })),
    );
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

  return { reglages, produits, chargement, erreur, enregistrer, recharger: charger };
}
