-- ============================================================
-- FIX CRITIQUE #1 : create_sale / update_sale_quantity ignoraient
-- le stock réservé par les commandes (stock_reserve).
-- Ils vérifiaient stock_actuel au lieu de stock_disponible
-- (stock_actuel - stock_reserve), ce qui permettait de vendre en
-- direct un produit déjà engagé dans une commande en attente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_sale(
  p_store_id uuid, p_date date, p_product_id uuid, p_quantite integer, p_prix_vente_unit numeric,
  p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_initial numeric,
  p_methode text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_sale_id uuid;
  v_total numeric;
  v_total_achat_ref numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_product_id IS NULL THEN RAISE EXCEPTION 'Produit requis.'; END IF;
  IF p_prix_vente_unit IS NULL OR p_prix_vente_unit < 0 THEN RAISE EXCEPTION 'Prix de vente invalide.'; END IF;
  IF COALESCE(p_montant_paye_initial, 0) < 0 THEN RAISE EXCEPTION 'Montant payé invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_existing);
    END IF;
  END IF;

  -- FIX : on vérifie stock_disponible (stock_actuel - stock_reserve), pas
  -- stock_actuel seul, sinon on peut vendre un produit déjà réservé par
  -- une commande en_attente/en_cours.
  SELECT id, display_name, prix_achat, stock_actuel, stock_disponible INTO v_prod
    FROM products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
  IF v_prod.stock_disponible <= 0 THEN
    RAISE EXCEPTION 'Ce produit est en rupture de stock disponible (réservé par une ou plusieurs commandes).';
  END IF;
  IF p_quantite > v_prod.stock_disponible THEN
    RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, demandé % (stock total %, réservé %).',
      v_prod.display_name, v_prod.stock_disponible, p_quantite, v_prod.stock_actuel,
      v_prod.stock_actuel - v_prod.stock_disponible;
  END IF;

  v_total := p_quantite * p_prix_vente_unit;
  v_total_achat_ref := p_quantite * v_prod.prix_achat;

  -- FIX : garde-fou anti-surpaiement réintroduit (avait disparu dans la
  -- dernière version de cette fonction).
  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total de la vente (%).',
      p_montant_paye_initial, v_total;
  END IF;

  v_sale_id := gen_random_uuid();

  UPDATE products SET stock_actuel = stock_actuel - p_quantite WHERE id = p_product_id AND store_id = p_store_id;

  INSERT INTO sales (
    id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id,
    montant_paye, solde_du, statut_credit, idempotency_key
  ) VALUES (
    v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_prod.display_name, p_quantite, p_prix_vente_unit, v_total,
    v_prod.prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, COALESCE(p_vendeur, ''), p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key
  );

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
  VALUES (p_store_id, p_product_id, 'vente', -p_quantite, 0, 'sale', v_sale_id, v_owner);

  -- FIX : le paiement initial passe désormais par add_payment (idempotent,
  -- revérifie le reste à payer), au lieu d'un INSERT direct qui contournait
  -- ce contrôle.
  IF COALESCE(p_montant_paye_initial, 0) > 0 THEN
    PERFORM public.add_payment(
      p_store_id, NULL, v_sale_id, p_montant_paye_initial,
      p_methode, NULL, NULL,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE p_idempotency_key || ':payment' END
    );
  END IF;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_sale_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sale_quantity(
  p_sale_id uuid, p_new_quantite integer, p_new_total_vente numeric,
  p_client_credit text, p_client_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_sale record;
  v_prod record;
  v_delta int;
  v_total_achat_ref numeric;
  v_new_total numeric;
  v_paid numeric;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_new_quantite IS NULL OR p_new_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = v_sale.store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  v_delta := p_new_quantite - v_sale.quantite;

  -- FIX : stock_disponible au lieu de stock_actuel pour l'augmentation de
  -- quantité, pour respecter les réservations de commandes.
  IF v_sale.product_id IS NOT NULL AND v_delta <> 0 THEN
    SELECT id, display_name, stock_actuel, stock_disponible INTO v_prod
      FROM products WHERE id = v_sale.product_id FOR UPDATE;
    IF FOUND AND v_delta > 0 AND v_delta > v_prod.stock_disponible THEN
      RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, augmentation demandée %.',
        v_prod.display_name, v_prod.stock_disponible, v_delta;
    END IF;
    IF FOUND THEN
      UPDATE products SET stock_actuel = stock_actuel - v_delta WHERE id = v_sale.product_id;
      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
      VALUES (v_sale.store_id, v_sale.product_id, 'vente_modification', -v_delta, 0, 'sale', p_sale_id, auth.uid());
    END IF;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_paid FROM payments WHERE sale_id = p_sale_id;
  v_total_achat_ref := p_new_quantite * v_sale.prix_achat_unit_ref;
  v_new_total := COALESCE(p_new_total_vente, v_sale.total_vente);

  -- FIX : garde-fou réintroduit — on ne doit pas pouvoir baisser le total
  -- en dessous de ce qui a déjà été payé.
  IF v_paid > v_new_total THEN
    RAISE EXCEPTION 'Modification refusée : les paiements déjà enregistrés (%) dépasseraient le nouveau total (%).',
      v_paid, v_new_total;
  END IF;

  UPDATE sales SET
    quantite = p_new_quantite,
    total_vente = v_new_total,
    total_achat_ref = v_total_achat_ref,
    marge_totale = v_new_total - v_total_achat_ref,
    client_credit = p_client_credit,
    client_id = p_client_id,
    solde_du = GREATEST(v_new_total - v_paid, 0),
    statut_credit = CASE
      WHEN v_paid <= 0 THEN 'Impayé'
      WHEN v_paid >= v_new_total THEN 'Payé'
      ELSE 'Partiel'
    END,
    updated_at = NOW()
  WHERE id = p_sale_id;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$function$;