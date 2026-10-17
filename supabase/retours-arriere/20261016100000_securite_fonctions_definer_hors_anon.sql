-- Retour arrière de 20261016100000_securite_fonctions_definer_hors_anon.sql
-- Rend EXECUTE à PUBLIC/anon sur la liste exacte des fonctions retirées
-- (relevée le 16/10/2026). Le search_path figé est laissé en place : il
-- ne change pas le comportement.

DO $$
DECLARE
  nom text;
  f record;
BEGIN
  FOREACH nom IN ARRAY ARRAY[
    'activate_store_with_code','add_payment','add_purchase','ajuster_stock',
    'avancer_livraison','compte_est_active','create_order_with_items',
    'create_product','create_quote','create_sale','create_sale_ticket',
    'create_supplier_invoice','creer_avoir','delete_order','delete_own_account',
    'delete_products','delete_purchase','delete_sale','fixer_commission_de_vente',
    'get_auth_role','modifier_achat','next_store_counter','refund_order',
    'refund_sale','remettre_argent_livraisons','set_order_status',
    'set_quote_status','update_product','update_quote','update_sale_quantity',
    'update_supplier_invoice','assign_delivery_numero','assign_expense_numero',
    'assign_payment_numero','assign_product_numero','assign_purchase_numero',
    'assign_quote_numero','assign_remise_numero','assign_sale_numero',
    'assign_supplier_invoice_numero','assign_tache_numero',
    'check_payment_does_not_exceed_balance','cloturer_le_salaire_precedent',
    'depense_rattachements_coherents','devis_accepte_est_fige',
    'ensure_owner_store','fournisseur_type_coherent',
    'garder_le_circuit_des_avances','garder_le_proprietaire','handle_new_user',
    'horodater_livraison','listes_par_defaut_a_la_creation',
    'recalculer_paiement_achat','recalculer_total_devis',
    'reglement_comptant_a_l_achat','set_avoir_numero','set_order_numero',
    'stores_documents_reserves','sync_profile_store_membership',
    'tenir_le_paiement_de_salaire','update_order_payment_status',
    'update_refund_totals'
  ]
  LOOP
    FOR f IN
      SELECT p.oid::regprocedure AS signature
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = nom
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon', f.signature);
    END LOOP;
  END LOOP;
END
$$;
