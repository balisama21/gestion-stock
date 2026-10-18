-- delete_purchase : les mêmes droits que la table `purchases`.
--
-- La politique RLS `purchases_delete` n'autorise la suppression qu'à
-- l'auteur de l'achat ou au propriétaire, et jamais dans une boutique
-- verrouillée : `can_modify_in_store(owner_id, store_id)`. La fonction
-- `delete_purchase`, en SECURITY DEFINER, contourne cette politique et ne
-- vérifiait que `is_store_member` : n'importe quel membre pouvait donc
-- supprimer l'achat d'un autre, boutique verrouillée comprise — exactement
-- ce que `modifier_achat` et `delete_sale` refusent déjà.
--
-- Seule la ligne d'autorisation change. Aucune donnée n'est touchée.
-- Retour arrière : supabase/retours-arriere/20261017100000_delete_purchase_memes_droits_que_la_table.sql

CREATE OR REPLACE FUNCTION public.delete_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase record;
  v_prod record;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Achat introuvable (déjà supprimé ?).'; END IF;
  IF NOT can_modify_in_store(v_purchase.owner_id, v_purchase.store_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de supprimer cet achat.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_purchase.product_id IS NOT NULL THEN
    SELECT id, display_name, stock_actuel, stock_reserve INTO v_prod FROM products WHERE id = v_purchase.product_id FOR UPDATE;
    IF FOUND THEN
      IF v_prod.stock_actuel - v_purchase.quantite < 0 THEN
        RAISE EXCEPTION 'Impossible de supprimer cet achat : stock actuel (%) insuffisant pour retirer % unité(s) déjà utilisées.', v_prod.stock_actuel, v_purchase.quantite;
      END IF;
      IF v_prod.stock_actuel - v_purchase.quantite < v_prod.stock_reserve THEN
        RAISE EXCEPTION 'Impossible de supprimer cet achat : % unité(s) de "%" sont réservées pour des commandes en cours.', v_prod.stock_reserve, v_prod.display_name;
      END IF;
      UPDATE products SET stock_actuel = stock_actuel - v_purchase.quantite WHERE id = v_purchase.product_id;
      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
      VALUES (v_purchase.store_id, v_purchase.product_id, 'achat_suppression', -v_purchase.quantite, 0, 'purchase', p_purchase_id, auth.uid());
    END IF;
  END IF;

  DELETE FROM purchases WHERE id = p_purchase_id;
END;
$function$;
