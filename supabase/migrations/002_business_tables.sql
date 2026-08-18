-- ============================================================
-- BALSAMA — Migration 002 : Tables Métier + Multi-Tenant
-- À exécuter dans Supabase → SQL Editor → New query → Run
-- ============================================================

-- ─────────────────────────────────────────
-- ENUMs supplémentaires
-- ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('en_attente', 'en_cours', 'livre', 'annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('impaye', 'partiel', 'paye');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────
-- TABLE : store_members
-- Lie un utilisateur à une boutique (en tant que collaborateur)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'seller', -- 'seller' | 'collaborator' | 'cashier'
  invited_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_store_members_store ON store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user  ON store_members(user_id);

-- ─────────────────────────────────────────
-- TABLE : clients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  telephone    TEXT,
  email        TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_store ON clients(store_id);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- TABLE : products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  designation       TEXT NOT NULL,
  variant_suffix    TEXT NOT NULL DEFAULT '',
  display_name      TEXT NOT NULL,
  prix_achat        NUMERIC NOT NULL DEFAULT 0,
  prix_vente_defaut NUMERIC NOT NULL DEFAULT 0,
  fournisseur       TEXT NOT NULL DEFAULT '',
  stock_initial     INTEGER NOT NULL DEFAULT 0,
  stock_actuel      INTEGER NOT NULL DEFAULT 0,
  seuil_alerte      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- TABLE : orders (Commandes)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL,
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  montant_total    NUMERIC NOT NULL DEFAULT 0,
  montant_paye     NUMERIC NOT NULL DEFAULT 0,
  reste_a_payer    NUMERIC GENERATED ALWAYS AS (montant_total - montant_paye) STORED,
  statut_paiement  payment_status NOT NULL DEFAULT 'impaye',
  statut_commande  order_status NOT NULL DEFAULT 'en_attente',
  note             TEXT,
  date_livraison   DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_store  ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner  ON orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-numérotation des commandes
CREATE OR REPLACE FUNCTION set_order_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'CMD-' || LPAD(
    (SELECT COUNT(*) + 1 FROM orders WHERE store_id = NEW.store_id)::TEXT,
    5, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_numero
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_numero();

-- ─────────────────────────────────────────
-- TABLE : order_items (Lignes de commande)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  designation     TEXT NOT NULL,
  quantite        INTEGER NOT NULL DEFAULT 1,
  prix_vente_unit NUMERIC NOT NULL DEFAULT 0,
  prix_achat_unit NUMERIC NOT NULL DEFAULT 0,
  total_vente     NUMERIC NOT NULL DEFAULT 0,
  total_achat_ref NUMERIC NOT NULL DEFAULT 0,
  marge_totale    NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ─────────────────────────────────────────
-- TABLE : payments (Historique des paiements)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recorded_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  montant         NUMERIC NOT NULL,
  methode         TEXT NOT NULL DEFAULT 'especes', -- especes | mobile_money | virement
  reference       TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_store ON payments(store_id);

-- Trigger : recalculer montant_paye et statut_paiement après paiement
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paye NUMERIC;
  v_total      NUMERIC;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
    FROM payments WHERE order_id = NEW.order_id;

  SELECT montant_total INTO v_total
    FROM orders WHERE id = NEW.order_id;

  UPDATE orders SET
    montant_paye = v_total_paye,
    statut_paiement = CASE
      WHEN v_total_paye <= 0            THEN 'impaye'
      WHEN v_total_paye >= v_total      THEN 'paye'
      ELSE 'partiel'
    END,
    updated_at = NOW()
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payments_update_order
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_order_payment_status();

-- ─────────────────────────────────────────
-- TABLE : sales (Ventes directes — hors commandes)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  designation      TEXT NOT NULL,
  quantite         INTEGER NOT NULL DEFAULT 1,
  prix_vente_unit  NUMERIC NOT NULL DEFAULT 0,
  total_vente      NUMERIC NOT NULL DEFAULT 0,
  prix_achat_unit_ref NUMERIC NOT NULL DEFAULT 0,
  total_achat_ref  NUMERIC NOT NULL DEFAULT 0,
  marge_totale     NUMERIC NOT NULL DEFAULT 0,
  vendeur          TEXT NOT NULL DEFAULT '',
  client_credit    TEXT,
  montant_paye     NUMERIC NOT NULL DEFAULT 0,
  solde_du         NUMERIC NOT NULL DEFAULT 0,
  statut_credit    TEXT NOT NULL DEFAULT 'Payé', -- Payé | Partiel | Impayé
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_owner ON sales(owner_id);

CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- TABLE : purchases (Achats de stock)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  designation       TEXT NOT NULL,
  quantite          INTEGER NOT NULL DEFAULT 1,
  prix_achat_unit   NUMERIC NOT NULL DEFAULT 0,
  total_achat       NUMERIC NOT NULL DEFAULT 0,
  fournisseur       TEXT NOT NULL DEFAULT '',
  impact_tresorerie NUMERIC NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_store ON purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_owner ON purchases(owner_id);

-- ─────────────────────────────────────────
-- TABLE : expenses (Dépenses vendeurs)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                 UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date                     DATE NOT NULL DEFAULT CURRENT_DATE,
  vendeur                  TEXT NOT NULL DEFAULT '',
  type                     TEXT NOT NULL DEFAULT 'Autre dépense',
  montant                  NUMERIC NOT NULL DEFAULT 0,
  note                     TEXT,
  impact_tresorerie_globale NUMERIC NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON expenses(owner_id);

-- ─────────────────────────────────────────
-- TABLE : capital_apports (Apports de capital)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capital_apports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  montant    NUMERIC NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT '',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_apports_store ON capital_apports(store_id);

-- ─────────────────────────────────────────
-- FONCTIONS RLS (sans récursion infinie)
-- ─────────────────────────────────────────

-- Vérifie si l'utilisateur est propriétaire d'une boutique
CREATE OR REPLACE FUNCTION is_store_owner(p_store_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores
    WHERE id = p_store_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Vérifie si l'utilisateur est membre (propriétaire ou collaborateur accepté) d'une boutique
CREATE OR REPLACE FUNCTION is_store_member(p_store_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members WHERE store_id = p_store_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Vérifie si l'utilisateur peut modifier/supprimer une ligne (il en est le créateur OU il est propriétaire de la boutique)
CREATE OR REPLACE FUNCTION can_modify_in_store(p_owner_id UUID, p_store_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (p_owner_id = auth.uid()) OR is_store_owner(p_store_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────
-- RLS — store_members
-- ─────────────────────────────────────────
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_members_select" ON store_members FOR SELECT
  USING (is_store_owner(store_id) OR user_id = auth.uid());

CREATE POLICY "store_members_insert" ON store_members FOR INSERT
  WITH CHECK (is_store_owner(store_id));

CREATE POLICY "store_members_delete" ON store_members FOR DELETE
  USING (is_store_owner(store_id));

-- ─────────────────────────────────────────
-- RLS — clients
-- ─────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

-- ─────────────────────────────────────────
-- RLS — products
-- ─────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "products_insert" ON products FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = owner_id);

CREATE POLICY "products_update" ON products FOR UPDATE
  USING (can_modify_in_store(owner_id, store_id));

CREATE POLICY "products_delete" ON products FOR DELETE
  USING (can_modify_in_store(owner_id, store_id));

-- ─────────────────────────────────────────
-- RLS — orders
-- ─────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = owner_id);

CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (can_modify_in_store(owner_id, store_id));

CREATE POLICY "orders_delete" ON orders FOR DELETE
  USING (can_modify_in_store(owner_id, store_id));

-- ─────────────────────────────────────────
-- RLS — order_items
-- ─────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND is_store_member(o.store_id)
  ));

CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND is_store_member(o.store_id)
  ));

CREATE POLICY "order_items_update" ON order_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND can_modify_in_store(o.owner_id, o.store_id)
  ));

CREATE POLICY "order_items_delete" ON order_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND can_modify_in_store(o.owner_id, o.store_id)
  ));

-- ─────────────────────────────────────────
-- RLS — payments
-- ─────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "payments_insert" ON payments FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = recorded_by);

CREATE POLICY "payments_delete" ON payments FOR DELETE
  USING (is_store_owner(store_id));

-- ─────────────────────────────────────────
-- RLS — sales
-- ─────────────────────────────────────────
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_select" ON sales FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "sales_insert" ON sales FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = owner_id);

CREATE POLICY "sales_update" ON sales FOR UPDATE
  USING (can_modify_in_store(owner_id, store_id));

CREATE POLICY "sales_delete" ON sales FOR DELETE
  USING (can_modify_in_store(owner_id, store_id));

-- ─────────────────────────────────────────
-- RLS — purchases
-- ─────────────────────────────────────────
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select" ON purchases FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "purchases_insert" ON purchases FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = owner_id);

CREATE POLICY "purchases_update" ON purchases FOR UPDATE
  USING (can_modify_in_store(owner_id, store_id));

CREATE POLICY "purchases_delete" ON purchases FOR DELETE
  USING (can_modify_in_store(owner_id, store_id));

-- ─────────────────────────────────────────
-- RLS — expenses
-- ─────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = owner_id);

CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (can_modify_in_store(owner_id, store_id));

CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (can_modify_in_store(owner_id, store_id));

-- ─────────────────────────────────────────
-- RLS — capital_apports
-- ─────────────────────────────────────────
ALTER TABLE capital_apports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apports_select" ON capital_apports FOR SELECT
  USING (is_store_member(store_id));

CREATE POLICY "apports_insert" ON capital_apports FOR INSERT
  WITH CHECK (is_store_owner(store_id) AND auth.uid() = owner_id);

CREATE POLICY "apports_delete" ON capital_apports FOR DELETE
  USING (is_store_owner(store_id));

-- ─────────────────────────────────────────
-- TERMINÉ ✓ Migration 002
-- ─────────────────────────────────────────
