import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * MON abonnement au résumé de préalerte, et le mien seulement.
 *
 * ── Pourquoi ce n'est pas un réglage de boutique ──
 *
 * L'e-mail partait autrefois à une seule adresse, celle du
 * propriétaire, parce qu'une case dans SES paramètres commandait tout.
 * Deux défauts : un gérant ou un responsable des achats — souvent ceux
 * qui commandent — ne pouvaient pas le recevoir, et le patron décidait
 * de ce qui arrive dans la boîte des autres.
 *
 * Recevoir un e-mail est une décision de celui qui le reçoit. Chacun
 * s'inscrit donc pour lui-même, et la politique de lecture ne rend que
 * sa propre ligne — pas même au propriétaire, qui n'a rien à décider
 * là-dessus.
 *
 * ── PAS DE LIGNE = PAS D'E-MAIL ──
 *
 * C'est le défaut, et il vaut pour tout le monde, propriétaire compris.
 * Se désabonner supprime la ligne : l'absence EST l'état, comme pour
 * les deux autres tables de cette fonctionnalité.
 */
export function useAbonnementAlertesStock(storeId: string | null, userId: string | null) {
  const [abonne, setAbonne] = useState(false);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!storeId || !userId) {
      setAbonne(false);
      setChargement(false);
      return;
    }
    setChargement(true);
    const { data } = await supabase
      .from("abonnements_alertes_stock")
      .select("canaux")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle();

    setAbonne(Boolean(data?.canaux?.includes("email")));
    setChargement(false);
  }, [storeId, userId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /**
   * S'inscrire ou se retirer.
   *
   * L'état affiché bascule TOUT DE SUITE, puis se corrige si la base
   * refuse : un interrupteur qui attend un aller-retour réseau donne
   * l'impression de ne pas avoir été pressé, et on le presse deux fois.
   *
   * Un refus d'écriture arrive sur une boutique verrouillée. Le retrait,
   * lui, reste toujours permis — on ne retient personne dans une liste
   * de diffusion.
   */
  const basculer = useCallback(
    async (veut: boolean): Promise<{ error: string | null }> => {
      if (!storeId || !userId) return { error: "Aucune boutique active." };
      const avant = abonne;
      setAbonne(veut);

      const { error } = veut
        ? await supabase
            .from("abonnements_alertes_stock")
            .upsert(
              { store_id: storeId, user_id: userId, canaux: ["email"] },
              { onConflict: "store_id,user_id" },
            )
        : await supabase
            .from("abonnements_alertes_stock")
            .delete()
            .eq("store_id", storeId)
            .eq("user_id", userId);

      if (error) {
        setAbonne(avant);
        return {
          error:
            "Ce réglage n'a pas pu être enregistré. Une boutique dont l'abonnement a expiré ne se modifie plus.",
        };
      }
      return { error: null };
    },
    [storeId, userId, abonne],
  );

  return { abonne, chargement, basculer };
}
