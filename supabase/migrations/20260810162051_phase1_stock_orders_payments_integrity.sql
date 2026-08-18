-- ============================================================
-- PHASE 1 — Intégrité Stock / Commandes / Paiements
-- ============================================================

-- A. Colonnes nouvelles + contraintes
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE purchases  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uniq    ON orders(idempotency_key)    WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_idempotency_key_uniq     ON sales(idempotency_key)     WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_idempotency_key_uniq ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_reserve integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_disponible integer GENERATED ALWAYS AS (stock_actuel - stock_reserve) STORED;

ALTER TABLE products ADD CONSTRAINT products_stock_actuel_non_negative CHECK (stock_actuel >= 0);
ALTER TABLE products ADD CONSTRAINT products_stock_reserve_non_negative CHECK (stock_reserve >= 0);
ALTER TABLE products ADD CONSTRAINT products_stock_reserve_le_actuel CHECK (stock_reserve <= stock_actuel);

ALTER TABLE sales       ADD CONSTRAINT sales_quantite_positive CHECK (quantite > 0);
ALTER TABLE purchases   ADD CONSTRAINT purchases_quantite_positive CHECK (quantite > 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantite_positive CHECK (quantite > 0);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS montant_rembourse numeric NOT NULL DEFAULT 0;
ALTER TABLE sales  ADD COLUMN IF NOT EXISTS montant_rembourse numeric NOT NULL DEFAULT 0;

-- B. Table stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id         uuid REFERENCES products(id) ON DELETE SET NULL,
  type_mouvement     text NOT NULL CHECK (type_mouvement IN (
                        'achat', 'achat_suppression',
                        'vente', 'vente_modification', 'vente_suppression',
                        'commande_reservation', 'commande_liberation',
                        'commande_livraison', 'commande_annulation_apres_livraison',
                        'ajustement'
                      )),
  stock_actuel_delta  integer NOT NULL DEFAULT 0,
  stock_reserve_delta integer NOT NULL DEFAULT 0,
  reference_type     text CHECK (reference_type IN ('purchase', 'sale', 'order')),
  reference_id       uuid,
  idempotency_key    text NOT NULL DEFAULT gen_random_uuid()::text,
  note               text,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_movements_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_store     ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product   ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (is_store_member(store_id));

-- C. Table refunds
CREATE TABLE IF NOT EXISTS refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES orders(id) ON DELETE CASCADE,
  sale_id         uuid REFERENCES sales(id) ON DELETE CASCADE,
  montant         numeric NOT NULL CHECK (montant > 0),
  reason          text,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  recorded_by     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT refunds_target_check CHECK (
    (order_id IS NOT NULL AND sale_id IS NULL) OR (order_id IS NULL AND sale_id IS NOT NULL)
  ),
  CONSTRAINT refunds_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_sale  ON refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_store ON refunds(store_id);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select" ON refunds FOR SELECT
  USING (is_store_member(store_id));

-- D. Trigger : recalcul de montant_rembourse
CREATE OR REPLACE FUNCTION update_refund_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_rembourse numeric;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total_rembourse FROM refunds WHERE order_id = NEW.order_id;
    UPDATE orders SET montant_rembourse = v_total_rembourse, updated_at = NOW() WHERE id = NEW.order_id;
  ELSIF NEW.sale_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total_rembourse FROM refunds WHERE sale_id = NEW.sale_id;
    UPDATE sales SET montant_rembourse = v_total_rembourse, updated_at = NOW() WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER refunds_update_totals
  AFTER INSERT ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_refund_totals();

-- E. Retrait du droit de suppression des paiements
DROP POLICY IF EXISTS "payments_delete" ON payments;

-- F. RPC : create_order_with_items
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_store_id uuid,
  p_client_id uuid,
  p_note text,
  p_date_livraison date,
  p_items jsonb,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_order_id uuid;
  v_existing_id uuid;
  v_item jsonb;
  v_total numeric := 0;
  v_needed record;
  v_prod record;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;
  IF NOT is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé pour cette boutique.';
  END IF;
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
    SELECT id, display_name, stock_disponible INTO v_prod
      FROM products WHERE id = v_needed.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable.';
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
$$;

GRANT EXECUTE ON FUNCTION create_order_with_items(uuid, uuid, text, date, jsonb, text) TO authenticated;

-- G. RPC : set_order_status
CREATE OR REPLACE FUNCTION set_order_status(
  p_order_id uuid,
  p_new_status order_status
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order record;
  v_item record;
  v_prod record;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable.';
  END IF;
  IF NOT can_modify_in_store(v_order.owner_id, v_order.store_id) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  IF v_order.statut_commande = p_new_status THEN
    RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
  END IF;

  IF v_order.statut_commande = 'annule' THEN
    RAISE EXCEPTION 'Commande annulée : aucun changement de statut n''est possible.';
  END IF;

  IF p_new_status = 'livre' THEN
    FOR v_item IN
      SELECT product_id, SUM(quantite) AS qte FROM order_items
      WHERE order_id = p_order_id AND product_id IS NOT NULL
      GROUP BY product_id ORDER BY product_id
    LOOP
      SELECT id, display_name, stock_actuel INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF v_item.qte > v_prod.stock_actuel THEN
        RAISE EXCEPTION 'Impossible de livrer : stock insuffisant pour "%". Disponible %, requis %.',
          v_prod.display_name, v_prod.stock_actuel, v_item.qte;
      END IF;
      UPDATE products SET
        stock_actuel = stock_actuel - v_item.qte,
        stock_reserve = GREATEST(stock_reserve - v_item.qte, 0)
        WHERE id = v_item.product_id;
      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by, note)
      VALUES (v_order.store_id, v_item.product_id, 'commande_livraison', -v_item.qte, -v_item.qte, 'order', p_order_id, auth.uid(), 'Livraison de la commande');
    END LOOP;

  ELSIF p_new_status = 'annule' THEN
    IF v_order.statut_commande = 'livre' THEN
      FOR v_item IN
        SELECT product_id, SUM(quantite) AS qte FROM order_items
        WHERE order_id = p_order_id AND product_id IS NOT NULL
        GROUP BY product_id ORDER BY product_id
      LOOP
        UPDATE products SET stock_actuel = stock_actuel + v_item.qte WHERE id = v_item.product_id;
        INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by, note)
        VALUES (v_order.store_id, v_item.product_id, 'commande_annulation_apres_livraison', v_item.qte, 0, 'order', p_order_id, auth.uid(), 'Annulation après livraison : stock restitué');
      END LOOP;
    ELSE
      FOR v_item IN
        SELECT product_id, SUM(quantite) AS qte FROM order_items
        WHERE order_id = p_order_id AND product_id IS NOT NULL
        GROUP BY product_id ORDER BY product_id
      LOOP
        UPDATE products SET stock_reserve = GREATEST(stock_reserve - v_item.qte, 0) WHERE id = v_item.product_id;
        INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by, note)
        VALUES (v_order.store_id, v_item.product_id, 'commande_liberation', 0, -v_item.qte, 'order', p_order_id, auth.uid(), 'Annulation : réservation libérée');
      END LOOP;
    END IF;
  END IF;

  UPDATE orders SET statut_commande = p_new_status, updated_at = NOW() WHERE id = p_order_id;

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION set_order_status(uuid, order_status) TO authenticated;

-- H. RPC : refund_order / refund_sale
CREATE OR REPLACE FUNCTION refund_order(
  p_order_id uuid,
  p_montant numeric,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

GRANT EXECUTE ON FUNCTION refund_order(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION refund_sale(
  p_sale_id uuid,
  p_montant numeric,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale record;
  v_deja_rembourse numeric;
  v_disponible numeric;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du remboursement doit être positif.';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT is_store_member(v_sale.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_deja_rembourse FROM refunds WHERE sale_id = p_sale_id;
  v_disponible := v_sale.montant_paye - v_deja_rembourse;

  IF p_montant > v_disponible THEN
    RAISE EXCEPTION 'Remboursement refusé : montant remboursable restant % Ar, demandé % Ar.', v_disponible, p_montant;
  END IF;

  INSERT INTO refunds (store_id, sale_id, montant, reason, recorded_by)
  VALUES (v_sale.store_id, p_sale_id, p_montant, p_reason, auth.uid());

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION refund_sale(uuid, numeric, text) TO authenticated;

-- I. RPC : create_sale
CREATE OR REPLACE FUNCTION create_sale(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_quantite int,
  p_prix_vente_unit numeric,
  p_vendeur text,
  p_client_credit text,
  p_client_id uuid,
  p_montant_paye_initial numeric,
  p_methode text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_existing);
    END IF;
  END IF;

  SELECT id, display_name, prix_achat, stock_actuel INTO v_prod FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
  IF v_prod.stock_actuel <= 0 THEN
    RAISE EXCEPTION 'Ce produit est en rupture de stock.';
  END IF;
  IF p_quantite > v_prod.stock_actuel THEN
    RAISE EXCEPTION 'Stock insuffisant pour "%" : disponible %, demandé %.', v_prod.display_name, v_prod.stock_actuel, p_quantite;
  END IF;

  v_total := p_quantite * p_prix_vente_unit;
  v_total_achat_ref := p_quantite * v_prod.prix_achat;
  v_sale_id := gen_random_uuid();

  UPDATE products SET stock_actuel = stock_actuel - p_quantite WHERE id = p_product_id;

  INSERT INTO sales (
    id, store_id, owner_id, date, product_id, designation, quantite, prix_vente_unit, total_vente,
    prix_achat_unit_ref, total_achat_ref, marge_totale, vendeur, client_credit, client_id,
    montant_paye, solde_du, statut_credit, idempotency_key
  ) VALUES (
    v_sale_id, p_store_id, v_owner, p_date, p_product_id, v_prod.display_name, p_quantite, p_prix_vente_unit, v_total,
    v_prod.prix_achat, v_total_achat_ref, v_total - v_total_achat_ref, p_vendeur, p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key
  );

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
  VALUES (p_store_id, p_product_id, 'vente', -p_quantite, 0, 'sale', v_sale_id, v_owner);

  IF p_montant_paye_initial IS NOT NULL AND p_montant_paye_initial > 0 THEN
    INSERT INTO payments (order_id, sale_id, store_id, recorded_by, montant, methode, reference, note)
    VALUES (NULL, v_sale_id, p_store_id, v_owner, p_montant_paye_initial, COALESCE(p_methode, 'especes'), NULL, NULL);
  END IF;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_sale(uuid, date, uuid, int, numeric, text, text, uuid, numeric, text, text) TO authenticated;

-- J. RPC : delete_sale / update_sale_quantity
CREATE OR REPLACE FUNCTION delete_sale(p_sale_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale record;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable (déjà supprimée ?).'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;

  IF v_sale.product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel + v_sale.quantite WHERE id = v_sale.product_id;
    INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
    VALUES (v_sale.store_id, v_sale.product_id, 'vente_suppression', v_sale.quantite, 0, 'sale', p_sale_id, auth.uid());
  END IF;

  DELETE FROM sales WHERE id = p_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_sale(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION update_sale_quantity(
  p_sale_id uuid,
  p_new_quantite int,
  p_new_total_vente numeric,
  p_client_credit text,
  p_client_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale record;
  v_prod record;
  v_delta int;
  v_total_achat_ref numeric;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_new_quantite IS NULL OR p_new_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;

  v_delta := p_new_quantite - v_sale.quantite;

  IF v_sale.product_id IS NOT NULL AND v_delta <> 0 THEN
    SELECT id, display_name, stock_actuel INTO v_prod FROM products WHERE id = v_sale.product_id FOR UPDATE;
    IF FOUND AND v_delta > 0 AND v_delta > v_prod.stock_actuel THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%" : disponible %, augmentation demandée %.', v_prod.display_name, v_prod.stock_actuel, v_delta;
    END IF;
    IF FOUND THEN
      UPDATE products SET stock_actuel = stock_actuel - v_delta WHERE id = v_sale.product_id;
      INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
      VALUES (v_sale.store_id, v_sale.product_id, 'vente_modification', -v_delta, 0, 'sale', p_sale_id, auth.uid());
    END IF;
  END IF;

  v_total_achat_ref := p_new_quantite * v_sale.prix_achat_unit_ref;

  UPDATE sales SET
    quantite = p_new_quantite,
    total_vente = COALESCE(p_new_total_vente, v_sale.total_vente),
    total_achat_ref = v_total_achat_ref,
    marge_totale = COALESCE(p_new_total_vente, v_sale.total_vente) - v_total_achat_ref,
    client_credit = p_client_credit,
    client_id = p_client_id
  WHERE id = p_sale_id;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION update_sale_quantity(uuid, int, numeric, text, uuid) TO authenticated;

-- K. RPC : add_purchase / delete_purchase
CREATE OR REPLACE FUNCTION add_purchase(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_new_designation text,
  p_new_variant_suffix text,
  p_new_display_name text,
  p_new_prix_vente_defaut numeric,
  p_new_seuil_alerte int,
  p_quantite int,
  p_prix_achat_unit numeric,
  p_fournisseur text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_existing uuid;
  v_product_id uuid;
  v_display_name text;
  v_purchase_id uuid;
  v_total numeric;
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

  IF p_product_id IS NOT NULL THEN
    UPDATE products SET stock_actuel = stock_actuel + p_quantite
      WHERE id = p_product_id
      RETURNING id, display_name INTO v_product_id, v_display_name;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
  ELSE
    v_product_id := gen_random_uuid();
    v_display_name := p_new_display_name;
    INSERT INTO products (id, store_id, owner_id, designation, variant_suffix, display_name, prix_achat, prix_vente_defaut, fournisseur, stock_initial, stock_actuel, seuil_alerte)
    VALUES (v_product_id, p_store_id, v_owner, p_new_designation, p_new_variant_suffix, p_new_display_name, p_prix_achat_unit, p_new_prix_vente_defaut, p_fournisseur, 0, p_quantite, p_new_seuil_alerte);
  END IF;

  v_total := p_quantite * p_prix_achat_unit;
  v_purchase_id := gen_random_uuid();

  INSERT INTO purchases (id, store_id, owner_id, date, product_id, designation, quantite, prix_achat_unit, total_achat, fournisseur, impact_tresorerie, idempotency_key)
  VALUES (v_purchase_id, p_store_id, v_owner, p_date, v_product_id, v_display_name, p_quantite, p_prix_achat_unit, v_total, p_fournisseur, -v_total, p_idempotency_key);

  INSERT INTO stock_movements (store_id, product_id, type_mouvement, stock_actuel_delta, stock_reserve_delta, reference_type, reference_id, created_by)
  VALUES (p_store_id, v_product_id, 'achat', p_quantite, 0, 'purchase', v_purchase_id, v_owner);

  RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_purchase_id);
END;
$$;

GRANT EXECUTE ON FUNCTION add_purchase(uuid, date, uuid, text, text, text, numeric, int, int, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION delete_purchase(p_purchase_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

GRANT EXECUTE ON FUNCTION delete_purchase(uuid) TO authenticated;