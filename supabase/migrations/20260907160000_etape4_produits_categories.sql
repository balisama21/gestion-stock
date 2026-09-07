-- ═══════════════════════════════════════════════════════════════════
-- Étape 4 — les produits et leurs catégories
--
-- Le §9 demande quinze informations sur un produit ; la table en portait
-- sept. Manquaient la référence, le code-barres, la catégorie, la
-- description, l'unité, la TVA, le stock maximum, les images, et la
-- distinction entre ce qu'on revend, ce qu'on fabrique et ce qu'on rend
-- comme service.
--
-- MIGRATION ADDITIVE. Aucune colonne supprimée ni renommée. En
-- particulier, `products.fournisseur` — le texte libre — est CONSERVÉ :
-- il reçoit un `supplier_id` à côté, comme les achats à l'étape 3. La
-- version du logiciel ouverte chez le client continue de lire ce qu'elle
-- lisait, et ignore tout le reste.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. Les catégories
-- ─────────────────────────────────────────
-- Deux niveaux, pas davantage : le §9 demande « catégorie » et
-- « sous-catégorie ». Une arborescence libre inviterait des hiérarchies
-- de six niveaux qu'aucun commerçant ne tiendra à jour, et rendrait
-- chaque écran plus lent à composer.

CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  nom        TEXT NOT NULL,
  -- La catégorie parente, quand celle-ci est une sous-catégorie.
  -- `SET NULL` à la suppression : perdre le rangement d'une famille de
  -- produits ne doit jamais entraîner la perte des produits eux-mêmes.
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  ordre      INTEGER NOT NULL DEFAULT 0,
  actif      BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT categories_pas_son_propre_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

-- Deux catégories de même nom au même niveau se confondraient à
-- l'écran. `COALESCE` est indispensable : en SQL deux NULL ne sont pas
-- égaux, donc sans lui l'unicité ne s'appliquerait jamais aux
-- catégories racines — celles qui en ont le plus besoin.
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_nom
  ON categories (store_id, lower(nom), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (store_id, parent_id, ordre);

-- La profondeur ne se contrôle pas par une contrainte CHECK, qui ne peut
-- pas interroger une autre ligne. Un déclencheur s'en charge — et il
-- interdit du même coup tout cycle, puisqu'un parent doit être racine.
CREATE OR REPLACE FUNCTION categories_deux_niveaux()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Une sous-catégorie ne peut pas elle-même être rangée sous une sous-catégorie.';
    END IF;
    IF EXISTS (SELECT 1 FROM categories WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'Cette catégorie contient déjà des sous-catégories ; elle ne peut pas devenir une sous-catégorie.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_deux_niveaux ON categories;
CREATE TRIGGER trg_categories_deux_niveaux
  BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW EXECUTE FUNCTION categories_deux_niveaux();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- 2. Le produit s'étoffe
-- ─────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku          TEXT,
  ADD COLUMN IF NOT EXISTS code_barres  TEXT,
  ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id  UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS unite        TEXT,
  ADD COLUMN IF NOT EXISTS tva_rate     NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS stock_max    NUMERIC,
  -- « fabriqué » est la porte laissée ouverte aux métiers d'impression
  -- et de sublimation : ils ne revendent pas un article en rayon, ils
  -- exécutent un travail. La nomenclature et l'ordre de travail
  -- viendront le jour où un vrai client en aura besoin ; la place
  -- existe dès maintenant pour ne pas avoir à reprendre les produits.
  ADD COLUMN IF NOT EXISTS type_produit TEXT NOT NULL DEFAULT 'revendu',
  ADD COLUMN IF NOT EXISTS statut       TEXT NOT NULL DEFAULT 'actif';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_type_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_type_check
      CHECK (type_produit IN ('revendu', 'service', 'fabrique')) NOT VALID;
    ALTER TABLE products VALIDATE CONSTRAINT products_type_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_statut_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_statut_check
      CHECK (statut IN ('actif', 'inactif')) NOT VALID;
    ALTER TABLE products VALIDATE CONSTRAINT products_statut_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tva_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_tva_check
      CHECK (tva_rate IS NULL OR (tva_rate >= 0 AND tva_rate <= 100)) NOT VALID;
    ALTER TABLE products VALIDATE CONSTRAINT products_tva_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_max_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_max_check
      CHECK (stock_max IS NULL OR stock_max >= 0) NOT VALID;
    ALTER TABLE products VALIDATE CONSTRAINT products_stock_max_check;
  END IF;
END $$;

-- Une référence ou un code-barres en double désignerait deux produits
-- d'un même geste — c'est précisément ce qu'un scanner ne saurait pas
-- départager. Index PARTIELS : la contrainte ne porte que sur les
-- produits qui en ont un, les autres restent libres.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku
  ON products (store_id, upper(btrim(sku))) WHERE sku IS NOT NULL AND btrim(sku) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_barres
  ON products (store_id, btrim(code_barres)) WHERE code_barres IS NOT NULL AND btrim(code_barres) <> '';

CREATE INDEX IF NOT EXISTS idx_products_categorie ON products (store_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_fournisseur ON products (store_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_statut ON products (store_id, statut);

-- ─────────────────────────────────────────
-- 3. Les images
-- ─────────────────────────────────────────
-- Une table plutôt qu'une colonne : le §9 demande plusieurs images, et
-- l'ordre d'affichage compte. Seul le CHEMIN dans Supabase Storage est
-- stocké — jamais le fichier lui-même, contrairement au logo de la
-- boutique, qui vit en base64 dans sa colonne et alourdit chaque
-- chargement de l'application.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_id_store_key') THEN
    ALTER TABLE products ADD CONSTRAINT products_id_store_key UNIQUE (id, store_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- La clé étrangère porte sur le COUPLE (produit, boutique) : sans
  -- cela, on pourrait écrire une image dont la boutique déclarée diffère
  -- de celle du produit, et la RLS regarderait la mauvaise.
  product_id UUID NOT NULL,
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, store_id) REFERENCES products (id, store_id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  chemin     TEXT NOT NULL,
  legende    TEXT,
  ordre      INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_produit ON product_images (product_id, ordre);
CREATE INDEX IF NOT EXISTS idx_product_images_store ON product_images (store_id);
-- Le même fichier deux fois sur le même produit n'aurait pas de sens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_chemin ON product_images (product_id, chemin);

-- ─────────────────────────────────────────
-- 4. Reprise des fournisseurs déjà nommés
-- ─────────────────────────────────────────
-- Même geste qu'à l'étape 3 pour les achats : le texte reste, la clé
-- s'ajoute à côté quand un fournisseur du même nom existe.

UPDATE products p
SET supplier_id = f.id
FROM suppliers f
WHERE p.supplier_id IS NULL
  AND f.store_id = p.store_id
  AND btrim(COALESCE(p.fournisseur, '')) <> ''
  AND lower(btrim(p.fournisseur)) = lower(f.nom);

-- ─────────────────────────────────────────
-- 5. Sécurité au niveau des lignes
-- ─────────────────────────────────────────

ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "product_images_select" ON product_images;
CREATE POLICY "product_images_select" ON product_images FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "product_images_insert" ON product_images;
CREATE POLICY "product_images_insert" ON product_images FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "product_images_update" ON product_images;
CREATE POLICY "product_images_update" ON product_images FOR UPDATE
  USING (can_modify_in_store(created_by, store_id));

DROP POLICY IF EXISTS "product_images_delete" ON product_images;
CREATE POLICY "product_images_delete" ON product_images FOR DELETE
  USING (can_modify_in_store(created_by, store_id));

REVOKE ALL ON categories, product_images FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories, product_images TO authenticated;
