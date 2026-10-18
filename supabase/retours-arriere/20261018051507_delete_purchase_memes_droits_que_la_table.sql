-- Retour arrière de 20261018051507_delete_purchase_memes_droits_que_la_table.sql
-- Rétablit la vérification d'origine (is_store_member), sans toucher aux données.

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
  IF NOT is_store_member(v_purchase.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;

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
