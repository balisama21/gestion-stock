-- Les clés étrangères sans index de couverture.
--
-- ── Pourquoi les indexer toutes, et pas seulement quelques-unes ──
--
-- La première idée était de trier : indexer ce que l'application
-- interroge vraiment, laisser tranquilles les colonnes d'audit du genre
-- « created_by » que personne ne filtre jamais. Un index n'est pas
-- gratuit — il ralentit chaque écriture — et l'audit se plaint déjà
-- d'index inutilisés ; en ajouter trente-cinq au hasard reviendrait à
-- échanger un avertissement contre un autre.
--
-- Le catalogue a contredit cette idée. Les 35 clés concernées sont
-- TOUTES sur un chemin de suppression :
--
--   12 en ON DELETE CASCADE
--   22 en ON DELETE SET NULL
--    1 en NO ACTION
--
-- Dans les trois cas, supprimer une ligne parente oblige PostgreSQL à
-- retrouver les lignes filles qui la référencent. Sans index sur la
-- colonne de référence, c'est un balayage complet de la table enfant, à
-- chaque suppression. Une colonne « created_by » en CASCADE n'est pas
-- une colonne d'audit inerte : c'est un chemin que la base emprunte dès
-- qu'un compte disparaît.
--
-- ── Le coût, mesuré et non supposé ──
--
-- Les tables vont aujourd'hui de 0 à 116 lignes. L'ensemble des index
-- « idx_* » de la base pèse 1752 ko une fois ceux-ci ajoutés. Les créer
-- maintenant est instantané ; les créer dans deux ans demanderait de
-- verrouiller une grande table en pleine journée de travail.
--
-- ── Méthode ──
--
-- Les ordres ont été produits par la base elle-même à partir du
-- catalogue, et non recopiés à la main. Vérifié en transaction annulée
-- avant application : plus aucune clé sans couverture, et aucun index
-- redondant introduit — « IF NOT EXISTS » ne contrôle que le nom, pas
-- les colonnes, donc la vérification a porté sur les colonnes.

CREATE INDEX IF NOT EXISTS idx_access_codes_generated_by ON public.access_codes (generated_by);
CREATE INDEX IF NOT EXISTS idx_access_codes_store_id ON public.access_codes (store_id);
CREATE INDEX IF NOT EXISTS idx_capital_apports_owner_id ON public.capital_apports (owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_created_by ON public.categories (created_by);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients (created_by);
CREATE INDEX IF NOT EXISTS idx_collaborator_invitations_invited_by ON public.collaborator_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_collaborator_invitations_store_id ON public.collaborator_invitations (store_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_created_by ON public.custom_field_definitions (created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_argent_remis_a ON public.deliveries (argent_remis_a);
CREATE INDEX IF NOT EXISTS idx_deliveries_client_id ON public.deliveries (client_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON public.deliveries (created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id_store_id ON public.deliveries (order_id, store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_password_recovery_requests_handled_by ON public.password_recovery_requests (handled_by);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS idx_product_images_created_by ON public.product_images (created_by);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id_store_id ON public.product_images (product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products (supplier_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON public.profiles (store_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_created_by ON public.provider_services (created_by);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider_id_store_id ON public.provider_services (provider_id, store_id);
CREATE INDEX IF NOT EXISTS idx_providers_created_by ON public.providers (created_by);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items (product_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id_store_id ON public.quote_items (quote_id, store_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes (created_by);
CREATE INDEX IF NOT EXISTS idx_refunds_recorded_by ON public.refunds (recorded_by);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by ON public.stock_movements (created_by);
CREATE INDEX IF NOT EXISTS idx_store_members_invited_by ON public.store_members (invited_by);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores (owner_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase_id_store_id ON public.supplier_payments (purchase_id, store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_recorded_by ON public.supplier_payments (recorded_by);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_by ON public.suppliers (created_by);

-- Garde-fou : la migration échoue plutôt que de laisser croire qu'elle
-- a fait son travail.
DO $garde$
DECLARE v_restantes int;
BEGIN
  WITH fk AS (
    SELECT c.conname, c.conrelid,
           (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
              FROM unnest(c.conkey) WITH ORDINALITY x(att, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.att) AS colonnes
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
  )
  SELECT count(*) INTO v_restantes FROM fk
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = fk.conrelid
      AND (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
             FROM unnest(i.indkey::int[]) WITH ORDINALITY x(att, ord)
             JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = x.att
            WHERE x.ord <= array_length(string_to_array(fk.colonnes, ', '), 1)) = fk.colonnes
  );

  IF v_restantes > 0 THEN
    RAISE EXCEPTION 'Il reste % clef(s) etrangere(s) sans index de couverture', v_restantes;
  END IF;
END $garde$;
