-- Retour arrière de 20261018042029_verrou_boutique_dans_les_rpc.sql
-- Rétablit les neuf fonctions telles que relevées en production le
-- 18/10/2026 (pg_get_functiondef), sans le contrôle de verrou. Aucune
-- donnée n'est touchée.
-- Seule différence avec le relevé : les fins de ligne. Les corps de
-- add_payment, create_product et refund_sale y étaient en CRLF ; ils sont
-- ici en LF, ce qui ne change rien à leur exécution.

CREATE OR REPLACE FUNCTION public.create_product(p_store_id uuid, p_designation text, p_prix_achat numeric, p_prix_vente_defaut numeric, p_fournisseur text, p_stock_initial integer, p_seuil_alerte integer, p_variant_suffix text, p_display_name text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_product_id uuid;
BEGIN
  IF v_owner IS NULL OR NOT is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;
  IF p_designation IS NULL OR btrim(p_designation) = '' THEN
    RAISE EXCEPTION 'Désignation obligatoire.';
  END IF;
  IF COALESCE(p_prix_achat, 0) < 0 OR COALESCE(p_prix_vente_defaut, 0) < 0 THEN
    RAISE EXCEPTION 'Les prix ne peuvent pas être négatifs.';
  END IF;
  IF COALESCE(p_stock_initial, 0) < 0 THEN
    RAISE EXCEPTION 'Le stock initial ne peut pas être négatif.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM products
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(p) FROM products p WHERE p.id = v_existing);
    END IF;
  END IF;

  INSERT INTO products (
    store_id, owner_id, designation, variant_suffix, display_name,
    prix_achat, prix_vente_defaut, fournisseur,
    stock_initial, stock_actuel, seuil_alerte, idempotency_key
  ) VALUES (
    p_store_id, v_owner, btrim(p_designation), COALESCE(p_variant_suffix, ''),
    COALESCE(NULLIF(btrim(p_display_name), ''), btrim(p_designation)),
    COALESCE(p_prix_achat, 0), COALESCE(p_prix_vente_defaut, 0), COALESCE(p_fournisseur, ''),
    COALESCE(p_stock_initial, 0), COALESCE(p_stock_initial, 0), COALESCE(p_seuil_alerte, 0),
    p_idempotency_key
  ) RETURNING id INTO v_product_id;

  IF COALESCE(p_stock_initial, 0) > 0 THEN
    INSERT INTO stock_movements (
      store_id, product_id, type_mouvement, stock_actuel_delta,
      stock_reserve_delta, reference_type, reference_id, created_by, note
    ) VALUES (
      p_store_id, v_product_id, 'ajustement', p_stock_initial, 0,
      NULL, NULL, v_owner, 'Stock initial du produit'
    );
  END IF;

  RETURN (SELECT to_jsonb(p) FROM products p WHERE p.id = v_product_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_purchase(p_store_id uuid, p_date date, p_product_id uuid, p_new_designation text, p_new_variant_suffix text, p_new_display_name text, p_new_prix_vente_defaut numeric, p_new_seuil_alerte integer, p_quantite integer, p_prix_achat_unit numeric, p_fournisseur text, p_idempotency_key text, p_montant_paye numeric DEFAULT NULL::numeric, p_date_echeance date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_product_id uuid;
  v_display_name text;
  v_purchase_id uuid;
  v_total numeric;
  v_paye numeric;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM purchases WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_existing);
    END IF;
  END IF;

  v_total := p_quantite * p_prix_achat_unit;
  v_paye := COALESCE(p_montant_paye, v_total);
  IF v_paye < 0 OR v_paye > v_total THEN
    RAISE EXCEPTION 'Le montant réglé doit être compris entre 0 et le total de l''achat.';
  END IF;

  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel + p_quantite
      WHERE id = p_product_id AND store_id = p_store_id
      RETURNING id, display_name INTO v_product_id, v_display_name;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
  ELSE
    v_product_id := gen_random_uuid();
    v_display_name := p_new_display_name;
    INSERT INTO products (id, store_id, owner_id, designation, variant_suffix, display_name,
                          prix_achat, prix_vente_defaut, fournisseur, stock_initial, stock_actuel, seuil_alerte)
    VALUES (v_product_id, p_store_id, v_owner, p_new_designation, p_new_variant_suffix,
            p_new_display_name, p_prix_achat_unit, p_new_prix_vente_defaut, p_fournisseur,
            0, p_quantite, p_new_seuil_alerte);
  END IF;

  v_purchase_id := gen_random_uuid();

  INSERT INTO purchases (id, store_id, owner_id, date, product_id, designation, quantite,
                         prix_achat_unit, total_achat, fournisseur, impact_tresorerie,
                         idempotency_key, date_echeance)
  VALUES (v_purchase_id, p_store_id, v_owner, p_date, v_product_id, v_display_name, p_quantite,
          p_prix_achat_unit, v_total, p_fournisseur, -v_paye, p_idempotency_key, p_date_echeance);

  IF v_paye > 0 AND v_paye < v_total THEN
    INSERT INTO supplier_payments (purchase_id, store_id, recorded_by, montant, date, methode, note)
    VALUES (v_purchase_id, p_store_id, v_owner, v_paye, p_date, 'especes',
            'Acompte versé à l''achat.');
  END IF;

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta,
                               stock_reserve_delta, reference_type, reference_id, created_by)
  VALUES (p_store_id, v_product_id, 'achat', p_quantite, 0, 'purchase', v_purchase_id, v_owner);

  RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_purchase_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_sale(p_store_id uuid, p_date date, p_product_id uuid, p_quantite integer, p_prix_vente_unit numeric, p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_initial numeric, p_methode text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_sale_id uuid;
  v_total numeric;
  v_total_achat_ref numeric;
  v_designation text;
  v_prix_achat numeric := 0;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
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

  IF p_product_id IS NULL THEN
    v_designation := 'Prestation';
  ELSE
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
    v_designation := v_prod.display_name;
    v_prix_achat := v_prod.prix_achat;
  END IF;

  v_total := p_quantite * p_prix_vente_unit;
  v_total_achat_ref := p_quantite * v_prix_achat;

  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total de la vente (%).',
      p_montant_paye_initial, v_total;
  END IF;

  v_sale_id := gen_random_uuid();

  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel - p_quantite
     WHERE id = p_product_id AND store_id = p_store_id;
  END IF;

  INSERT INTO sales (
    id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id,
    montant_paye, solde_du, statut_credit, idempotency_key
  ) VALUES (
    v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_designation, p_quantite, p_prix_vente_unit, v_total,
    v_prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, COALESCE(p_vendeur, ''), p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key
  );

  IF p_product_id IS NOT NULL THEN
    INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
    VALUES (p_store_id, p_product_id, 'vente', -p_quantite, 0, 'sale', v_sale_id, v_owner);
  END IF;

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

CREATE OR REPLACE FUNCTION public.create_sale_ticket(p_store_id uuid, p_date date, p_vendeur text, p_client_credit text, p_client_id uuid, p_montant_paye_total numeric, p_methode text, p_lignes jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne     jsonb;
  v_index     int := 0;
  v_total     numeric := 0;
  v_reste     numeric;
  v_part      numeric;
  v_ligne_tot numeric;
  v_ticket    uuid;
  v_vente     jsonb;
  v_vente_id  uuid;
  v_produit   uuid;
  v_libelle   text;
  v_cle       text;
  v_ids       uuid[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide.';
  END IF;

  SELECT s.ticket_id INTO v_ticket
    FROM sales s WHERE s.idempotency_key = p_idempotency_key || ':1';
  IF v_ticket IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ticket_id', v_ticket,
      'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
                   FROM sales s WHERE s.ticket_id = v_ticket)
    );
  END IF;

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_total := v_total + (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;
  END LOOP;

  IF COALESCE(p_montant_paye_total, 0) < 0 THEN
    RAISE EXCEPTION 'Montant payé invalide.';
  END IF;
  IF COALESCE(p_montant_paye_total, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé (%) dépasse le total du panier (%).',
      p_montant_paye_total, v_total;
  END IF;

  v_ticket := gen_random_uuid();
  v_reste  := COALESCE(p_montant_paye_total, 0);

  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
    v_index := v_index + 1;
    v_ligne_tot := (v_ligne->>'quantite')::int * (v_ligne->>'prix_vente_unit')::numeric;

    v_part  := LEAST(v_reste, v_ligne_tot);
    v_reste := v_reste - v_part;

    v_cle := p_idempotency_key || ':' || v_index;
    v_produit := NULLIF(v_ligne->>'product_id', '')::uuid;

    v_vente := public.create_sale(
      p_store_id, p_date,
      v_produit,
      (v_ligne->>'quantite')::int,
      (v_ligne->>'prix_vente_unit')::numeric,
      p_vendeur, p_client_credit, p_client_id,
      v_part, p_methode, v_cle
    );

    v_vente_id := (v_vente->>'id')::uuid;
    UPDATE sales SET ticket_id = v_ticket WHERE id = v_vente_id;

    v_libelle := btrim(COALESCE(v_ligne->>'designation', ''));
    IF v_produit IS NULL AND v_libelle <> '' THEN
      UPDATE sales SET designation = v_libelle WHERE id = v_vente_id;
    END IF;

    v_ids := array_append(v_ids, v_vente_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ticket_id', v_ticket,
    'ventes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
                 FROM sales s WHERE s.id = ANY(v_ids))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_payment(p_store_id uuid, p_order_id uuid, p_sale_id uuid, p_montant numeric, p_methode text, p_reference text, p_note text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_total numeric;
  v_paye numeric;
  v_target_store uuid;
  v_order_status order_status;
  v_refunded numeric := 0;
  v_payment_id uuid;
BEGIN
  IF v_user IS NULL OR NOT is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être positif.';
  END IF;

  IF (p_order_id IS NULL) = (p_sale_id IS NULL) THEN
    RAISE EXCEPTION
      'Un paiement doit cibler exactement une commande ou une vente.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id
    INTO v_existing
    FROM payments
    WHERE store_id = p_store_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing IS NOT NULL THEN
      RETURN (
        SELECT to_jsonb(p)
        FROM payments p
        WHERE p.id = v_existing
      );
    END IF;
  END IF;

  IF p_order_id IS NOT NULL THEN

    SELECT
      store_id,
      montant_total,
      montant_paye,
      statut_commande
    INTO
      v_target_store,
      v_total,
      v_paye,
      v_order_status
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND OR v_target_store <> p_store_id THEN
      RAISE EXCEPTION 'Commande introuvable dans cette boutique.';
    END IF;

    IF v_order_status = 'annule' THEN
      RAISE EXCEPTION
        'Impossible d''enregistrer un paiement sur une commande annulée.';
    END IF;

  ELSE

    SELECT
      store_id,
      total_vente,
      montant_paye,
      montant_rembourse
    INTO
      v_target_store,
      v_total,
      v_paye,
      v_refunded
    FROM sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND OR v_target_store <> p_store_id THEN
      RAISE EXCEPTION 'Vente introuvable dans cette boutique.';
    END IF;

    IF COALESCE(v_refunded, 0) > 0 THEN
      RAISE EXCEPTION
        'Impossible d''enregistrer un paiement après un remboursement.';
    END IF;

  END IF;

  IF p_montant > GREATEST(v_total - v_paye, 0) THEN
    RAISE EXCEPTION
      'Paiement refusé : reste à payer %, montant demandé %.',
      GREATEST(v_total - v_paye, 0),
      p_montant;
  END IF;

  INSERT INTO payments (
    order_id,
    sale_id,
    store_id,
    recorded_by,
    montant,
    methode,
    reference,
    note,
    idempotency_key
  )
  VALUES (
    p_order_id,
    p_sale_id,
    p_store_id,
    v_user,
    p_montant,
    COALESCE(NULLIF(p_methode, ''), 'especes'),
    p_reference,
    p_note,
    p_idempotency_key
  )
  RETURNING id INTO v_payment_id;

  RETURN (
    SELECT to_jsonb(p)
    FROM payments p
    WHERE p.id = v_payment_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_sale(p_sale_id uuid, p_montant numeric, p_reason text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale record;
  v_existing uuid;
  v_paid numeric;
  v_refunded numeric;
  v_remaining numeric;
  v_refund_id uuid;
BEGIN
  -- Validation du montant
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du remboursement doit être positif.';
  END IF;

  -- Verrouille la vente pendant l'opération
  SELECT *
  INTO v_sale
  FROM sales
  WHERE id = p_sale_id
  FOR UPDATE;

  -- Vérification de l'existence et du store
  IF NOT FOUND OR NOT is_store_member(v_sale.store_id) THEN
    RAISE EXCEPTION 'Vente introuvable ou non autorisée.';
  END IF;

  -- Idempotence
  IF p_idempotency_key IS NOT NULL THEN

    SELECT id
    INTO v_existing
    FROM refunds
    WHERE sale_id = p_sale_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing IS NOT NULL THEN
      RETURN (
        SELECT to_jsonb(s)
        FROM sales s
        WHERE s.id = p_sale_id
      );
    END IF;

  END IF;

  -- Total réellement payé
  SELECT COALESCE(SUM(montant), 0)
  INTO v_paid
  FROM payments
  WHERE sale_id = p_sale_id;

  -- Total déjà remboursé
  SELECT COALESCE(SUM(montant), 0)
  INTO v_refunded
  FROM refunds
  WHERE sale_id = p_sale_id;

  -- Reste remboursable
  v_remaining := v_paid - v_refunded;

  IF p_montant > v_remaining THEN
    RAISE EXCEPTION
      'Remboursement refusé : montant remboursable restant % Ar, demandé % Ar.',
      v_remaining,
      p_montant;
  END IF;

  -- Création du remboursement
  INSERT INTO refunds (
    store_id,
    sale_id,
    montant,
    reason,
    idempotency_key,
    recorded_by
  )
  VALUES (
    v_sale.store_id,
    p_sale_id,
    p_montant,
    p_reason,
    COALESCE(
      p_idempotency_key,
      gen_random_uuid()::text
    ),
    auth.uid()
  )
  RETURNING id INTO v_refund_id;

  -- Retourne la vente actualisée
  RETURN (
    SELECT to_jsonb(s)
    FROM sales s
    WHERE s.id = p_sale_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_store_id uuid, p_client_id uuid, p_note text, p_date_livraison date, p_items jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid := auth.uid();
  v_order_id uuid;
  v_existing_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_needed record;
  v_prod record;
BEGIN
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé pour cette boutique.'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins un produit à la commande.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM orders WHERE idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
      RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_existing_id);
    END IF;
  END IF;

  FOR v_needed IN
    SELECT (item->>'product_id')::uuid AS product_id, SUM((item->>'quantite')::int) AS qte
    FROM jsonb_array_elements(p_items) AS item
    WHERE NULLIF(item->>'product_id', '') IS NOT NULL
    GROUP BY (item->>'product_id')::uuid
    ORDER BY 1
  LOOP
    -- P1 FIX : le produit doit appartenir à p_store_id, sinon un utilisateur de la
    -- boutique A pourrait réserver/vendre le stock d'une boutique B.
    SELECT id, display_name, stock_disponible INTO v_prod
      FROM products WHERE id = v_needed.product_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable dans cette boutique.';
    END IF;
    IF v_needed.qte > v_prod.stock_disponible THEN
      RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, demandé %.',
        v_prod.display_name, v_prod.stock_disponible, v_needed.qte;
    END IF;
  END LOOP;

  v_order_id := gen_random_uuid();
  SELECT COALESCE(SUM((item->>'quantite')::int * (item->>'prix_vente_unit')::numeric), 0)
    INTO v_total FROM jsonb_array_elements(p_items) AS item;

  INSERT INTO orders (id, store_id, owner_id, client_id, montant_total, montant_paye, note, date_livraison, idempotency_key)
  VALUES (v_order_id, p_store_id, v_owner_id, p_client_id, v_total, 0, p_note, p_date_livraison, p_idempotency_key);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (order_id, product_id, designation, quantite, prix_vente_unit, prix_achat_unit, total_vente, total_achat_ref, marge_totale)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      v_item->>'designation',
      (v_item->>'quantite')::int,
      (v_item->>'prix_vente_unit')::numeric,
      (v_item->>'prix_achat_unit')::numeric,
      (v_item->>'quantite')::int * (v_item->>'prix_vente_unit')::numeric,
      (v_item->>'quantite')::int * (v_item->>'prix_achat_unit')::numeric,
      (v_item->>'quantite')::int * ((v_item->>'prix_vente_unit')::numeric - (v_item->>'prix_achat_unit')::numeric)
    );

    IF NULLIF(v_item->>'product_id', '') IS NOT NULL THEN
      UPDATE products SET stock_reserve = stock_reserve + (v_item->>'quantite')::int
        WHERE id = (v_item->>'product_id')::uuid;

      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by, note)
      VALUES (p_store_id, (v_item->>'product_id')::uuid, 'commande_reservation', 0, (v_item->>'quantite')::int, 'order', v_order_id, v_owner_id, 'Réservation à la création de la commande');
    END IF;
  END LOOP;

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_order(p_order_id uuid, p_montant numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_deja_rembourse numeric;
  v_disponible numeric;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du remboursement doit être positif.';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF NOT is_store_member(v_order.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_deja_rembourse FROM refunds WHERE order_id = p_order_id;
  v_disponible := v_order.montant_paye - v_deja_rembourse;

  IF p_montant > v_disponible THEN
    RAISE EXCEPTION 'Remboursement refusé : montant remboursable restant % Ar, demandé % Ar.', v_disponible, p_montant;
  END IF;

  INSERT INTO refunds (store_id, order_id, montant, reason, recorded_by)
  VALUES (v_order.store_id, p_order_id, p_montant, p_reason, auth.uid());

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.avancer_livraison(p_delivery_id uuid, p_statut text, p_montant_encaisse numeric DEFAULT NULL::numeric, p_motif_echec text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v deliveries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;

  SELECT * INTO v FROM deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Livraison introuvable.'; END IF;

  -- `IS DISTINCT FROM`, et non `<>` : sur une livraison non assignée,
  -- `livreur_id` est NULL, et une comparaison ordinaire rendrait NULL —
  -- ni vrai ni faux —, si bien que le refus ne s'exécutait pas.
  IF v.livreur_id IS DISTINCT FROM auth.uid() AND NOT is_store_member(v.store_id) THEN
    RAISE EXCEPTION 'Cette livraison ne vous est pas confiée.';
  END IF;

  IF p_statut NOT IN ('en_cours', 'livree', 'echouee') THEN
    RAISE EXCEPTION 'Statut inconnu : %.', p_statut;
  END IF;
  IF v.statut IN ('livree', 'annulee') THEN
    RAISE EXCEPTION 'Cette livraison est terminée : son statut ne change plus.';
  END IF;
  IF p_statut = 'echouee' AND COALESCE(btrim(p_motif_echec), '') = '' THEN
    RAISE EXCEPTION 'Dites pourquoi la livraison n''a pas pu être faite.';
  END IF;
  IF COALESCE(p_montant_encaisse, 0) < 0 THEN
    RAISE EXCEPTION 'Le montant encaissé ne peut pas être négatif.';
  END IF;
  IF COALESCE(p_montant_encaisse, 0) > v.montant_a_encaisser THEN
    RAISE EXCEPTION 'Le montant encaissé (%) dépasse ce qui était à encaisser (%).',
      p_montant_encaisse, v.montant_a_encaisser;
  END IF;

  UPDATE deliveries
  SET statut = p_statut,
      montant_encaisse = CASE WHEN p_statut = 'livree'
                              THEN COALESCE(p_montant_encaisse, montant_a_encaisser)
                              ELSE montant_encaisse END,
      motif_echec = CASE WHEN p_statut = 'echouee' THEN p_motif_echec ELSE motif_echec END
  WHERE id = p_delivery_id;

  RETURN (SELECT to_jsonb(d) FROM deliveries d WHERE d.id = p_delivery_id);
END;
$function$;
