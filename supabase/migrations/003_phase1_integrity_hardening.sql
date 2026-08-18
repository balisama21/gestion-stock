-- ============================================================
-- BALSAMA — Phase 1 Hardening
-- Objectif : fermer les écritures directes sur les tables sensibles,
-- fiabiliser stock/commandes/paiements et rendre les opérations atomiques.
-- Cette migration est conçue pour être appliquée après 001/002 et peut
-- aussi s'appuyer sur les objets Phase 1 déjà présents dans Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes / structures Phase 1
-- ------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_reserve integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_disponible integer
  GENERATED ALWAYS AS (stock_actuel - stock_reserve) STORED;
ALTER TABLE products ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS montant_rembourse numeric NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS montant_rembourse numeric NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS products_idempotency_key_uniq
  ON products(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uniq
  ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_idempotency_key_uniq
  ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS purchases_idempotency_key_uniq
  ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uniq
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass AND conname = 'products_stock_actuel_non_negative'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_actuel_non_negative CHECK (stock_actuel >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass AND conname = 'products_stock_reserve_non_negative'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_reserve_non_negative CHECK (stock_reserve >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass AND conname = 'products_stock_reserve_le_actuel'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_reserve_le_actuel CHECK (stock_reserve <= stock_actuel);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass AND conname = 'payments_target_check'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_target_check CHECK (
      (order_id IS NOT NULL AND sale_id IS NULL) OR
      (order_id IS NULL AND sale_id IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass AND conname = 'payments_montant_positive'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_montant_positive CHECK (montant > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'payments'::regclass
      AND conname = 'payments_sale_id_fkey'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refunds_order_id_fkey' AND conrelid = 'refunds'::regclass) THEN
    ALTER TABLE refunds DROP CONSTRAINT refunds_order_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refunds_sale_id_fkey' AND conrelid = 'refunds'::regclass) THEN
    ALTER TABLE refunds DROP CONSTRAINT refunds_sale_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_order_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_sale_id_fkey' AND conrelid = 'payments'::regclass) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_sale_id_fkey;
  END IF;

  ALTER TABLE payments
    ADD CONSTRAINT payments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
  ALTER TABLE payments
    ADD CONSTRAINT payments_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

  IF to_regclass('public.refunds') IS NOT NULL THEN
    ALTER TABLE refunds
      ADD CONSTRAINT refunds_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
    ALTER TABLE refunds
      ADD CONSTRAINT refunds_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Journal stock + remboursements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  type_mouvement text NOT NULL CHECK (type_mouvement IN (
    'achat', 'achat_suppression',
    'vente', 'vente_modification', 'vente_suppression',
    'commande_reservation', 'commande_liberation',
    'commande_livraison', 'commande_annulation_apres_livraison',
    'ajustement'
  )),
  stock_actuel_delta integer NOT NULL DEFAULT 0,
  stock_reserve_delta integer NOT NULL DEFAULT 0,
  reference_type text CHECK (reference_type IN ('purchase', 'sale', 'order')),
  reference_id uuid,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_store ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES sales(id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  reason text,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refunds_target_check CHECK (
    (order_id IS NOT NULL AND sale_id IS NULL) OR
    (order_id IS NULL AND sale_id IS NOT NULL)
  ),
  CONSTRAINT refunds_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_store ON refunds(store_id);
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. RLS : lecture autorisée, écriture des tables critiques via RPC uniquement
-- ------------------------------------------------------------
DROP POLICY IF EXISTS products_insert ON products;
DROP POLICY IF EXISTS products_update ON products;
DROP POLICY IF EXISTS products_delete ON products;
DROP POLICY IF EXISTS sales_insert ON sales;
DROP POLICY IF EXISTS sales_update ON sales;
DROP POLICY IF EXISTS sales_delete ON sales;
DROP POLICY IF EXISTS orders_insert ON orders;
DROP POLICY IF EXISTS orders_update ON orders;
DROP POLICY IF EXISTS orders_delete ON orders;
DROP POLICY IF EXISTS order_items_insert ON order_items;
DROP POLICY IF EXISTS order_items_update ON order_items;
DROP POLICY IF EXISTS order_items_delete ON order_items;
DROP POLICY IF EXISTS purchases_insert ON purchases;
DROP POLICY IF EXISTS purchases_update ON purchases;
DROP POLICY IF EXISTS purchases_delete ON purchases;
DROP POLICY IF EXISTS payments_insert ON payments;
DROP POLICY IF EXISTS payments_update ON payments;
DROP POLICY IF EXISTS payments_delete ON payments;
DROP POLICY IF EXISTS stock_movements_insert ON stock_movements;
DROP POLICY IF EXISTS stock_movements_update ON stock_movements;
DROP POLICY IF EXISTS stock_movements_delete ON stock_movements;
DROP POLICY IF EXISTS refunds_insert ON refunds;
DROP POLICY IF EXISTS refunds_update ON refunds;
DROP POLICY IF EXISTS refunds_delete ON refunds;

DROP POLICY IF EXISTS stock_movements_select ON stock_movements;
CREATE POLICY stock_movements_select ON stock_movements FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS refunds_select ON refunds;
CREATE POLICY refunds_select ON refunds FOR SELECT
  USING (is_store_member(store_id));

-- Le paiement est historique : aucune écriture directe depuis le client.
-- Les fonctions SECURITY DEFINER ci-dessous sont la seule porte d'écriture.
REVOKE INSERT, UPDATE, DELETE ON products, sales, orders, order_items, purchases, payments, stock_movements, refunds FROM anon, authenticated;

-- ------------------------------------------------------------
-- 4. Trigger de synchronisation des paiements
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_payment_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_sale_id uuid;
  v_total numeric;
BEGIN
  -- En UPDATE, l'ancienne cible et la nouvelle cible doivent toutes deux
  -- être recalculées si le rattachement change.
  IF TG_OP <> 'INSERT' THEN
    v_order_id := OLD.order_id;
    v_sale_id := OLD.sale_id;

    IF v_order_id IS NOT NULL THEN
      SELECT COALESCE(SUM(montant), 0) INTO v_total
      FROM payments WHERE order_id = v_order_id;
      UPDATE orders
      SET montant_paye = v_total,
          statut_paiement = CASE
            WHEN v_total <= 0 THEN 'impaye'::payment_status
            WHEN v_total >= montant_total THEN 'paye'::payment_status
            ELSE 'partiel'::payment_status
          END,
          updated_at = now()
      WHERE id = v_order_id;
    END IF;

    IF v_sale_id IS NOT NULL THEN
      SELECT COALESCE(SUM(montant), 0) INTO v_total
      FROM payments WHERE sale_id = v_sale_id;
      UPDATE sales
      SET montant_paye = v_total,
          solde_du = GREATEST(total_vente - v_total, 0),
          statut_credit = CASE
            WHEN v_total <= 0 THEN 'Impayé'
            WHEN v_total >= total_vente THEN 'Payé'
            ELSE 'Partiel'
          END,
          updated_at = now()
      WHERE id = v_sale_id;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_order_id := NEW.order_id;
    v_sale_id := NEW.sale_id;

    IF v_order_id IS NOT NULL THEN
      SELECT COALESCE(SUM(montant), 0) INTO v_total
      FROM payments WHERE order_id = v_order_id;
      UPDATE orders
      SET montant_paye = v_total,
          statut_paiement = CASE
            WHEN v_total <= 0 THEN 'impaye'::payment_status
            WHEN v_total >= montant_total THEN 'paye'::payment_status
            ELSE 'partiel'::payment_status
          END,
          updated_at = now()
      WHERE id = v_order_id;
    END IF;

    IF v_sale_id IS NOT NULL THEN
      SELECT COALESCE(SUM(montant), 0) INTO v_total
      FROM payments WHERE sale_id = v_sale_id;
      UPDATE sales
      SET montant_paye = v_total,
          solde_du = GREATEST(total_vente - v_total, 0),
          statut_credit = CASE
            WHEN v_total <= 0 THEN 'Impayé'
            WHEN v_total >= total_vente THEN 'Payé'
            ELSE 'Partiel'
          END,
          updated_at = now()
      WHERE id = v_sale_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payments_update_order ON payments;
DROP TRIGGER IF EXISTS payments_sync_totals ON payments;
CREATE TRIGGER payments_sync_totals
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_totals();

-- ------------------------------------------------------------
-- 5. Produit : création atomique
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_product(
  p_store_id uuid,
  p_designation text,
  p_prix_achat numeric,
  p_prix_vente_defaut numeric,
  p_fournisseur text,
  p_stock_initial integer,
  p_seuil_alerte integer,
  p_variant_suffix text,
  p_display_name text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;
GRANT EXECUTE ON FUNCTION public.create_product(uuid,text,numeric,numeric,text,integer,integer,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_product(uuid,text,numeric,numeric,text,integer,integer,text,text,text) FROM anon;

-- ------------------------------------------------------------
-- 6. Commandes : création + réservation atomique
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_store_id uuid,
  p_client_id uuid,
  p_note text,
  p_date_livraison date,
  p_items jsonb,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_existing uuid;
  v_item jsonb;
  v_needed record;
  v_prod record;
  v_total numeric := 0;
  v_qte integer;
  v_sale_price numeric;
  v_buy_price numeric;
BEGIN
  IF v_user IS NULL OR NOT is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé pour cette boutique.';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Ajoutez au moins un produit à la commande.';
  END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM orders
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_existing);
    END IF;
  END IF;

  -- Verrouillage déterministe des produits : évite les deadlocks entre deux
  -- commandes concurrentes portant plusieurs produits.
  FOR v_needed IN
    SELECT (item->>'product_id')::uuid AS product_id,
           SUM((item->>'quantite')::integer) AS qte
    FROM jsonb_array_elements(p_items) item
    WHERE NULLIF(item->>'product_id', '') IS NOT NULL
    GROUP BY (item->>'product_id')::uuid
    ORDER BY 1
  LOOP
    SELECT id, display_name, prix_achat, stock_disponible
      INTO v_prod
    FROM products
    WHERE id = v_needed.product_id
      AND store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable dans cette boutique.';
    END IF;
    IF v_needed.qte IS NULL OR v_needed.qte <= 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour "%".', v_prod.display_name;
    END IF;
    IF v_needed.qte > v_prod.stock_disponible THEN
      RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, demandé %.',
        v_prod.display_name, v_prod.stock_disponible, v_needed.qte;
    END IF;
  END LOOP;

  -- Les prix d'achat sont relus depuis products : le navigateur ne peut pas
  -- falsifier la marge de la commande.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qte := (v_item->>'quantite')::integer;
    v_sale_price := (v_item->>'prix_vente_unit')::numeric;
    IF v_qte IS NULL OR v_qte <= 0 OR v_sale_price IS NULL OR v_sale_price < 0 THEN
      RAISE EXCEPTION 'Ligne de commande invalide.';
    END IF;
    IF NULLIF(v_item->>'product_id', '') IS NOT NULL THEN
      SELECT prix_achat INTO v_buy_price
      FROM products
      WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
    ELSE
      v_buy_price := COALESCE((v_item->>'prix_achat_unit')::numeric, 0);
    END IF;
    v_total := v_total + v_qte * v_sale_price;
  END LOOP;

  INSERT INTO orders (
    store_id, owner_id, client_id, montant_total, montant_paye,
    note, date_livraison, idempotency_key
  ) VALUES (
    p_store_id, v_user, p_client_id, v_total, 0,
    p_note, p_date_livraison, p_idempotency_key
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qte := (v_item->>'quantite')::integer;
    v_sale_price := (v_item->>'prix_vente_unit')::numeric;
    IF NULLIF(v_item->>'product_id', '') IS NOT NULL THEN
      SELECT prix_achat INTO v_buy_price
      FROM products
      WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id;
    ELSE
      v_buy_price := COALESCE((v_item->>'prix_achat_unit')::numeric, 0);
    END IF;

    INSERT INTO order_items (
      order_id, product_id, designation, quantite, prix_vente_unit,
      prix_achat_unit, total_vente, total_achat_ref, marge_totale
    ) VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      COALESCE(v_item->>'designation', ''),
      v_qte,
      v_sale_price,
      v_buy_price,
      v_qte * v_sale_price,
      v_qte * v_buy_price,
      v_qte * (v_sale_price - v_buy_price)
    );

    IF NULLIF(v_item->>'product_id', '') IS NOT NULL THEN
      UPDATE products
      SET stock_reserve = stock_reserve + v_qte
      WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id;

      INSERT INTO stock_movements (
        store_id, product_id, type_mouvement, stock_actuel_delta,
        stock_reserve_delta, reference_type, reference_id, created_by,
        note
      ) VALUES (
        p_store_id, (v_item->>'product_id')::uuid, 'commande_reservation',
        0, v_qte, 'order', v_order_id, v_user,
        'Réservation à la création de la commande'
      );
    END IF;
  END LOOP;

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = v_order_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid,uuid,text,date,jsonb,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(uuid,uuid,text,date,jsonb,text) FROM anon;

-- ------------------------------------------------------------
-- 7. Commandes : machine à états sûre
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_status(
  p_order_id uuid,
  p_new_status order_status
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_item record;
  v_prod record;
  v_refundable numeric := 0;
  v_allowed boolean := false;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable.'; END IF;
  IF NOT can_modify_in_store(v_order.owner_id, v_order.store_id) THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  IF v_order.statut_commande = p_new_status THEN
    RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
  END IF;

  v_allowed :=
    (v_order.statut_commande = 'en_attente' AND p_new_status IN ('en_cours','livre','annule')) OR
    (v_order.statut_commande = 'en_cours' AND p_new_status IN ('livre','annule')) OR
    (v_order.statut_commande = 'livre' AND p_new_status = 'annule');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition de commande interdite : % -> %.',
      v_order.statut_commande, p_new_status;
  END IF;

  IF p_new_status = 'livre' THEN
    FOR v_item IN
      SELECT product_id, SUM(quantite) AS qte
      FROM order_items
      WHERE order_id = p_order_id AND product_id IS NOT NULL
      GROUP BY product_id ORDER BY product_id
    LOOP
      SELECT id, display_name, stock_actuel, stock_reserve
        INTO v_prod
      FROM products
      WHERE id = v_item.product_id AND store_id = v_order.store_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produit introuvable pour la livraison.';
      END IF;
      IF v_item.qte > v_prod.stock_actuel THEN
        RAISE EXCEPTION 'Impossible de livrer : stock insuffisant pour "%". Disponible %, requis %.',
          v_prod.display_name, v_prod.stock_actuel, v_item.qte;
      END IF;
      IF v_item.qte > v_prod.stock_reserve THEN
        RAISE EXCEPTION 'Réservation incohérente pour "%".', v_prod.display_name;
      END IF;

      UPDATE products
      SET stock_actuel = stock_actuel - v_item.qte,
          stock_reserve = stock_reserve - v_item.qte
      WHERE id = v_item.product_id AND store_id = v_order.store_id;

      INSERT INTO stock_movements (
        store_id, product_id, type_mouvement, stock_actuel_delta,
        stock_reserve_delta, reference_type, reference_id, created_by,
        note
      ) VALUES (
        v_order.store_id, v_item.product_id, 'commande_livraison',
        -v_item.qte, -v_item.qte, 'order', p_order_id, auth.uid(),
        'Livraison de la commande'
      );
    END LOOP;

  ELSIF p_new_status = 'annule' THEN
    -- Annulation + remboursement + mouvement de stock forment une seule
    -- transaction. Si l'une des étapes échoue, tout est annulé.
    v_refundable := v_order.montant_paye - COALESCE(v_order.montant_rembourse, 0);
    IF v_refundable > 0 THEN
      INSERT INTO refunds (
        store_id, order_id, montant, reason, idempotency_key, recorded_by
      ) VALUES (
        v_order.store_id, p_order_id, v_refundable, 'Annulation commande',
        'order-cancel:' || p_order_id::text, auth.uid()
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    IF v_order.statut_commande = 'livre' THEN
      FOR v_item IN
        SELECT product_id, SUM(quantite) AS qte
        FROM order_items
        WHERE order_id = p_order_id AND product_id IS NOT NULL
        GROUP BY product_id ORDER BY product_id
      LOOP
        UPDATE products
        SET stock_actuel = stock_actuel + v_item.qte
        WHERE id = v_item.product_id AND store_id = v_order.store_id;

        INSERT INTO stock_movements (
          store_id, product_id, type_mouvement, stock_actuel_delta,
          stock_reserve_delta, reference_type, reference_id, created_by,
          note
        ) VALUES (
          v_order.store_id, v_item.product_id,
          'commande_annulation_apres_livraison', v_item.qte, 0,
          'order', p_order_id, auth.uid(),
          'Annulation après livraison : stock restitué'
        );
      END LOOP;
    ELSE
      FOR v_item IN
        SELECT product_id, SUM(quantite) AS qte
        FROM order_items
        WHERE order_id = p_order_id AND product_id IS NOT NULL
        GROUP BY product_id ORDER BY product_id
      LOOP
        SELECT stock_reserve INTO v_prod
        FROM products
        WHERE id = v_item.product_id AND store_id = v_order.store_id
        FOR UPDATE;
        IF NOT FOUND OR v_prod.stock_reserve < v_item.qte THEN
          RAISE EXCEPTION 'Réservation incohérente lors de l''annulation.';
        END IF;

        UPDATE products
        SET stock_reserve = stock_reserve - v_item.qte
        WHERE id = v_item.product_id AND store_id = v_order.store_id;

        INSERT INTO stock_movements (
          store_id, product_id, type_mouvement, stock_actuel_delta,
          stock_reserve_delta, reference_type, reference_id, created_by,
          note
        ) VALUES (
          v_order.store_id, v_item.product_id, 'commande_liberation',
          0, -v_item.qte, 'order', p_order_id, auth.uid(),
          'Annulation : réservation libérée'
        );
      END LOOP;
    END IF;
  END IF;

  UPDATE orders
  SET statut_commande = p_new_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid,order_status) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_status(uuid,order_status) FROM anon;

-- ------------------------------------------------------------
-- 8. Paiements : seule porte d'écriture + anti-surpaiement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_payment(
  p_store_id uuid,
  p_order_id uuid,
  p_sale_id uuid,
  p_montant numeric,
  p_methode text,
  p_reference text,
  p_note text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'Un paiement doit cibler exactement une commande ou une vente.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM payments
    WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(p) FROM payments p WHERE p.id = v_existing);
    END IF;
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT store_id, montant_total, montant_paye, statut_commande
      INTO v_target_store, v_total, v_paye, v_order_status
    FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND OR v_target_store <> p_store_id THEN
      RAISE EXCEPTION 'Commande introuvable dans cette boutique.';
    END IF;
    IF v_order_status = 'annule' THEN
      RAISE EXCEPTION 'Impossible d''enregistrer un paiement sur une commande annulée.';
    END IF;
  ELSE
    SELECT store_id, total_vente, montant_paye, montant_rembourse
      INTO v_target_store, v_total, v_paye, v_refunded
    FROM sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND OR v_target_store <> p_store_id THEN
      RAISE EXCEPTION 'Vente introuvable dans cette boutique.';
    END IF;
    IF COALESCE(v_refunded, 0) > 0 THEN
      RAISE EXCEPTION 'Impossible d''enregistrer un paiement après un remboursement.';
    END IF;
  END IF;

  IF p_montant > GREATEST(v_total - v_paye, 0) THEN
    RAISE EXCEPTION 'Paiement refusé : reste à payer %, montant demandé %.',
      GREATEST(v_total - v_paye, 0), p_montant;
  END IF;

  INSERT INTO payments (
    order_id, sale_id, store_id, recorded_by, montant, methode,
    reference, note, idempotency_key
  ) VALUES (
    p_order_id, p_sale_id, p_store_id, v_user, p_montant,
    COALESCE(NULLIF(p_methode, ''), 'especes'), p_reference, p_note,
    p_idempotency_key
  ) RETURNING id INTO v_payment_id;

  RETURN (SELECT to_jsonb(p) FROM payments p WHERE p.id = v_payment_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_payment(uuid,uuid,uuid,numeric,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.add_payment(uuid,uuid,uuid,numeric,text,text,text,text) FROM anon;

-- ------------------------------------------------------------
-- 9. Remboursements : historiques conservés, jamais de DELETE paiement
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_refund_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_sale_id uuid;
  v_total numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_order_id := OLD.order_id;
    v_sale_id := OLD.sale_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_order_id := COALESCE(v_order_id, NEW.order_id);
    v_sale_id := COALESCE(v_sale_id, NEW.sale_id);
  END IF;

  IF v_order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total FROM refunds WHERE order_id = v_order_id;
    UPDATE orders SET montant_rembourse = v_total, updated_at = now() WHERE id = v_order_id;
  END IF;
  IF v_sale_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total FROM refunds WHERE sale_id = v_sale_id;
    UPDATE sales SET montant_rembourse = v_total, updated_at = now() WHERE id = v_sale_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refunds_update_totals ON refunds;
CREATE TRIGGER refunds_update_totals
  AFTER INSERT OR UPDATE OR DELETE ON refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_refund_totals();

CREATE OR REPLACE FUNCTION public.refund_order(
  p_order_id uuid,
  p_montant numeric,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_existing uuid;
  v_paid numeric;
  v_refunded numeric;
  v_remaining numeric;
  v_refund_id uuid;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du remboursement doit être positif.';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT is_store_member(v_order.store_id) THEN
    RAISE EXCEPTION 'Commande introuvable ou non autorisée.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM refunds
    WHERE order_id = p_order_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
    END IF;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_paid FROM payments WHERE order_id = p_order_id;
  SELECT COALESCE(SUM(montant), 0) INTO v_refunded FROM refunds WHERE order_id = p_order_id;
  v_remaining := v_paid - v_refunded;

  IF p_montant > v_remaining THEN
    RAISE EXCEPTION 'Remboursement refusé : montant remboursable restant % Ar, demandé % Ar.',
      v_remaining, p_montant;
  END IF;

  INSERT INTO refunds (store_id, order_id, montant, reason, idempotency_key, recorded_by)
  VALUES (v_order.store_id, p_order_id, p_montant, p_reason, COALESCE(p_idempotency_key, gen_random_uuid()::text), auth.uid())
  RETURNING id INTO v_refund_id;

  RETURN (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid,numeric,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_order(uuid,numeric,text,text) FROM anon;

CREATE OR REPLACE FUNCTION public.refund_sale(
  p_sale_id uuid,
  p_montant numeric,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_existing uuid;
  v_paid numeric;
  v_refunded numeric;
  v_remaining numeric;
  v_refund_id uuid;
BEGIN
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du remboursement doit être positif.';
  END IF;
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND OR NOT is_store_member(v_sale.store_id) THEN
    RAISE EXCEPTION 'Vente introuvable ou non autorisée.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM refunds
    WHERE sale_id = p_sale_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
    END IF;
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_paid FROM payments WHERE sale_id = p_sale_id;
  SELECT COALESCE(SUM(montant), 0) INTO v_refunded FROM refunds WHERE sale_id = p_sale_id;
  v_remaining := v_paid - v_refunded;

  IF p_montant > v_remaining THEN
    RAISE EXCEPTION 'Remboursement refusé : montant remboursable restant % Ar, demandé % Ar.',
      v_remaining, p_montant;
  END IF;

  INSERT INTO refunds (store_id, sale_id, montant, reason, idempotency_key, recorded_by)
  VALUES (v_sale.store_id, p_sale_id, p_montant, p_reason, COALESCE(p_idempotency_key, gen_random_uuid()::text), auth.uid())
  RETURNING id INTO v_refund_id;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.refund_sale(uuid,numeric,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_sale(uuid,numeric,text,text) FROM anon;

-- ------------------------------------------------------------
-- 10. Ventes : création/modification/suppression atomiques
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_quantite integer,
  p_prix_vente_unit numeric,
  p_vendeur text,
  p_client_credit text,
  p_client_id uuid,
  p_montant_paye_initial numeric,
  p_methode text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_prod record;
  v_sale_id uuid;
  v_total numeric;
  v_achat numeric;
BEGIN
  IF v_user IS NULL OR NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_vente_unit IS NULL OR p_prix_vente_unit < 0 THEN RAISE EXCEPTION 'Prix de vente invalide.'; END IF;
  IF COALESCE(p_montant_paye_initial, 0) < 0 THEN RAISE EXCEPTION 'Montant payé invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_existing); END IF;
  END IF;

  SELECT id, display_name, prix_achat, stock_actuel, stock_disponible
    INTO v_prod
  FROM products
  WHERE id = p_product_id AND store_id = p_store_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
  IF p_quantite > v_prod.stock_disponible THEN
    RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, demandé %.', v_prod.display_name, v_prod.stock_disponible, p_quantite;
  END IF;

  v_total := p_quantite * p_prix_vente_unit;
  v_achat := p_quantite * v_prod.prix_achat;
  IF COALESCE(p_montant_paye_initial, 0) > v_total THEN
    RAISE EXCEPTION 'Paiement refusé : le montant payé dépasse le total de la vente.';
  END IF;

  UPDATE products SET stock_actuel = stock_actuel - p_quantite WHERE id = p_product_id AND store_id = p_store_id;

  INSERT INTO sales (
    store_id, owner_id, date, product_id, designation, quantite,
    prix_vente_unit, total_vente, prix_achat_unit_ref, total_achat_ref,
    marge_totale, vendeur, client_credit, client_id, montant_paye,
    solde_du, statut_credit, idempotency_key
  ) VALUES (
    p_store_id, v_user, p_date, p_product_id, v_prod.display_name, p_quantite,
    p_prix_vente_unit, v_total, v_prod.prix_achat, v_achat,
    v_total - v_achat, COALESCE(p_vendeur, ''), p_client_credit, p_client_id,
    0, v_total, 'Impayé', p_idempotency_key
  ) RETURNING id INTO v_sale_id;

  INSERT INTO stock_movements (
    store_id, product_id, type_mouvement, stock_actuel_delta,
    stock_reserve_delta, reference_type, reference_id, created_by
  ) VALUES (
    p_store_id, p_product_id, 'vente', -p_quantite, 0,
    'sale', v_sale_id, v_user
  );

  IF COALESCE(p_montant_paye_initial, 0) > 0 THEN
    PERFORM public.add_payment(
      p_store_id, NULL, v_sale_id, p_montant_paye_initial,
      p_methode, NULL, NULL,
      CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE p_idempotency_key || ':payment' END
    );
  END IF;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = v_sale_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_sale(uuid,date,uuid,integer,numeric,text,text,uuid,numeric,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid,date,uuid,integer,numeric,text,text,uuid,numeric,text,text) FROM anon;

CREATE OR REPLACE FUNCTION public.update_sale_quantity(
  p_sale_id uuid,
  p_new_quantite integer,
  p_new_total_vente numeric,
  p_client_credit text,
  p_client_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
  v_prod record;
  v_delta integer;
  v_total_achat numeric;
  v_new_total numeric;
  v_paid numeric;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND OR NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Vente introuvable ou non autorisée.'; END IF;
  IF p_new_quantite IS NULL OR p_new_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;

  v_delta := p_new_quantite - v_sale.quantite;
  v_new_total := COALESCE(p_new_total_vente, p_new_quantite * v_sale.prix_vente_unit);
  IF v_new_total < 0 THEN RAISE EXCEPTION 'Total de vente invalide.'; END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM clients WHERE id = p_client_id AND store_id = v_sale.store_id
  ) THEN
    RAISE EXCEPTION 'Client introuvable dans cette boutique.';
  END IF;

  IF v_delta <> 0 AND v_sale.product_id IS NOT NULL THEN
    SELECT id, display_name, stock_actuel, stock_disponible INTO v_prod
    FROM products WHERE id = v_sale.product_id AND store_id = v_sale.store_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable.'; END IF;
    IF v_delta > 0 AND v_delta > v_prod.stock_disponible THEN
      RAISE EXCEPTION 'Stock disponible insuffisant pour "%" : disponible %, augmentation demandée %.', v_prod.display_name, v_prod.stock_disponible, v_delta;
    END IF;
    UPDATE products SET stock_actuel = stock_actuel - v_delta WHERE id = v_sale.product_id AND store_id = v_sale.store_id;
    INSERT INTO stock_movements (
      store_id, product_id, type_mouvement, stock_actuel_delta,
      stock_reserve_delta, reference_type, reference_id, created_by
    ) VALUES (
      v_sale.store_id, v_sale.product_id, 'vente_modification', -v_delta,
      0, 'sale', p_sale_id, auth.uid()
    );
  END IF;

  SELECT COALESCE(SUM(montant), 0) INTO v_paid FROM payments WHERE sale_id = p_sale_id;
  IF v_paid > v_new_total THEN
    RAISE EXCEPTION 'Modification refusée : les paiements existants dépasseraient le nouveau total.';
  END IF;

  v_total_achat := p_new_quantite * v_sale.prix_achat_unit_ref;

  UPDATE sales SET
    quantite = p_new_quantite,
    total_vente = v_new_total,
    total_achat_ref = v_total_achat,
    marge_totale = v_new_total - v_total_achat,
    client_credit = p_client_credit,
    client_id = p_client_id,
    montant_paye = v_paid,
    solde_du = GREATEST(v_new_total - v_paid, 0),
    statut_credit = CASE
      WHEN v_paid <= 0 THEN 'Impayé'
      WHEN v_paid >= v_new_total THEN 'Payé'
      ELSE 'Partiel'
    END,
    updated_at = now()
  WHERE id = p_sale_id;

  RETURN (SELECT to_jsonb(s) FROM sales s WHERE s.id = p_sale_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_sale_quantity(uuid,integer,numeric,text,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_sale_quantity(uuid,integer,numeric,text,uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.delete_sale(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale record;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND OR NOT can_modify_in_store(v_sale.owner_id, v_sale.store_id) THEN RAISE EXCEPTION 'Vente introuvable ou non autorisée.'; END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE sale_id = p_sale_id)
     OR EXISTS (SELECT 1 FROM refunds WHERE sale_id = p_sale_id) THEN
    RAISE EXCEPTION 'Suppression impossible : cette vente possède un historique financier. Utilisez un remboursement.';
  END IF;

  IF v_sale.product_id IS NOT NULL THEN
    UPDATE products
    SET stock_actuel = stock_actuel + v_sale.quantite
    WHERE id = v_sale.product_id AND store_id = v_sale.store_id;
    INSERT INTO stock_movements (
      store_id, product_id, type_mouvement, stock_actuel_delta,
      stock_reserve_delta, reference_type, reference_id, created_by
    ) VALUES (
      v_sale.store_id, v_sale.product_id, 'vente_suppression', v_sale.quantite,
      0, 'sale', p_sale_id, auth.uid()
    );
  END IF;

  DELETE FROM sales WHERE id = p_sale_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_sale(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_sale(uuid) FROM anon;

-- ------------------------------------------------------------
-- 11. Achats : stock + achat atomiques
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_purchase(
  p_store_id uuid,
  p_date date,
  p_product_id uuid,
  p_new_designation text,
  p_new_variant_suffix text,
  p_new_display_name text,
  p_new_prix_vente_defaut numeric,
  p_new_seuil_alerte integer,
  p_quantite integer,
  p_prix_achat_unit numeric,
  p_fournisseur text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing uuid;
  v_product_id uuid;
  v_display_name text;
  v_purchase_id uuid;
  v_total numeric;
BEGIN
  IF v_user IS NULL OR NOT is_store_member(p_store_id) THEN RAISE EXCEPTION 'Non autorisé.'; END IF;
  IF p_quantite IS NULL OR p_quantite <= 0 THEN RAISE EXCEPTION 'Quantité invalide.'; END IF;
  IF p_prix_achat_unit IS NULL OR p_prix_achat_unit < 0 THEN RAISE EXCEPTION 'Prix d''achat invalide.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM purchases WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_existing); END IF;
  END IF;

  IF p_product_id IS NOT NULL THEN
    UPDATE products
    SET stock_actuel = stock_actuel + p_quantite,
        prix_achat = p_prix_achat_unit
    WHERE id = p_product_id AND store_id = p_store_id
    RETURNING id, display_name INTO v_product_id, v_display_name;
    IF v_product_id IS NULL THEN RAISE EXCEPTION 'Produit introuvable dans cette boutique.'; END IF;
  ELSE
    INSERT INTO products (
      store_id, owner_id, designation, variant_suffix, display_name,
      prix_achat, prix_vente_defaut, fournisseur,
      stock_initial, stock_actuel, seuil_alerte, idempotency_key
    ) VALUES (
      p_store_id, v_user, COALESCE(p_new_designation, ''), COALESCE(p_new_variant_suffix, ''),
      COALESCE(p_new_display_name, p_new_designation, ''), p_prix_achat_unit,
      COALESCE(p_new_prix_vente_defaut, 0), COALESCE(p_fournisseur, ''),
      0, p_quantite, COALESCE(p_new_seuil_alerte, 0), NULL
    ) RETURNING id, display_name INTO v_product_id, v_display_name;
  END IF;

  v_total := p_quantite * p_prix_achat_unit;
  INSERT INTO purchases (
    store_id, owner_id, date, product_id, designation, quantite,
    prix_achat_unit, total_achat, fournisseur, impact_tresorerie, idempotency_key
  ) VALUES (
    p_store_id, v_user, p_date, v_product_id, v_display_name, p_quantite,
    p_prix_achat_unit, v_total, COALESCE(p_fournisseur, ''), -v_total, p_idempotency_key
  ) RETURNING id INTO v_purchase_id;

  INSERT INTO stock_movements (
    store_id, product_id, type_mouvement, stock_actuel_delta,
    stock_reserve_delta, reference_type, reference_id, created_by
  ) VALUES (
    p_store_id, v_product_id, 'achat', p_quantite, 0,
    'purchase', v_purchase_id, v_user
  );

  RETURN (SELECT to_jsonb(pu) FROM purchases pu WHERE pu.id = v_purchase_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_purchase(uuid,date,uuid,text,text,text,numeric,integer,integer,numeric,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.add_purchase(uuid,date,uuid,text,text,text,numeric,integer,integer,numeric,text,text) FROM anon;

CREATE OR REPLACE FUNCTION public.delete_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase record;
  v_prod record;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND OR NOT can_modify_in_store(v_purchase.owner_id, v_purchase.store_id) THEN
    RAISE EXCEPTION 'Achat introuvable ou non autorisé.';
  END IF;

  IF v_purchase.product_id IS NOT NULL THEN
    SELECT id, display_name, stock_actuel, stock_reserve
      INTO v_prod
    FROM products
    WHERE id = v_purchase.product_id AND store_id = v_purchase.store_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_prod.stock_actuel < v_purchase.quantite THEN
        RAISE EXCEPTION 'Impossible de supprimer cet achat : stock actuel (%) insuffisant pour retirer % unité(s).', v_prod.stock_actuel, v_purchase.quantite;
      END IF;
      IF v_prod.stock_actuel - v_purchase.quantite < v_prod.stock_reserve THEN
        RAISE EXCEPTION 'Impossible de supprimer cet achat : le stock restant serait inférieur au stock réservé.';
      END IF;
      UPDATE products SET stock_actuel = stock_actuel - v_purchase.quantite WHERE id = v_purchase.product_id;
      INSERT INTO stock_movements (
        store_id, product_id, type_mouvement, stock_actuel_delta,
        stock_reserve_delta, reference_type, reference_id, created_by
      ) VALUES (
        v_purchase.store_id, v_purchase.product_id, 'achat_suppression',
        -v_purchase.quantite, 0, 'purchase', p_purchase_id, auth.uid()
      );
    END IF;
  END IF;

  DELETE FROM purchases WHERE id = p_purchase_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_purchase(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_purchase(uuid) FROM anon;

-- ------------------------------------------------------------
-- 12. Nettoyage des anciennes permissions RPC
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_sale(uuid,date,uuid,integer,numeric,text,text,uuid,numeric,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_sale_quantity(uuid,integer,numeric,text,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_sale(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_purchase(uuid,date,uuid,text,text,text,numeric,integer,integer,numeric,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_purchase(uuid) FROM anon;

-- Note : la numérotation CMD-* par COUNT(*)+1 reste volontairement hors de
-- cette migration. Elle sera traitée dans la phase Identifiants avec une
-- séquence concurrency-safe, sans casser les numéros historiques.

-- Les anciennes signatures Phase 1 sont neutralisées pour éviter qu'un appel
-- du client ne contourne la nouvelle clé d'idempotence.
DO $$
BEGIN
  IF to_regprocedure('public.refund_order(uuid,numeric,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.refund_order(uuid,numeric,text) FROM anon, authenticated;
  END IF;
  IF to_regprocedure('public.refund_sale(uuid,numeric,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.refund_sale(uuid,numeric,text) FROM anon, authenticated;
  END IF;
END $$;
