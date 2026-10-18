-- Retour arrière de 20261018120000_avoir_efface_la_dette.sql
--
-- Rétablit les quatre fonctions telles qu'elles étaient en production le
-- 18 octobre (relues par pg_get_functiondef avant la migration), recalcule
-- le solde des ventes touchées par un avoir comme avant (total − payé),
-- puis retire la colonne et la fonction de recalcul.
--
-- Les avoirs eux-mêmes (tables `avoirs`, `avoir_items`) ne sont pas
-- touchés : seule leur répercussion sur les ventes disparaît.

-- ── Les soldes, selon l'ancienne règle ───────────────────────────────

UPDATE public.sales s SET
  solde_du = GREATEST(s.total_vente - s.montant_paye, 0),
  statut_credit = CASE
    WHEN s.montant_paye <= 0             THEN 'Impayé'
    WHEN s.montant_paye >= s.total_vente THEN 'Payé'
    ELSE 'Partiel'
  END,
  updated_at = NOW()
WHERE s.montant_avoire > 0;

-- ── Les fonctions d'origine ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_order_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_total_paye       NUMERIC;
  v_total            NUMERIC;
  v_target_order_id  UUID;
  v_target_sale_id   UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_order_id := OLD.order_id;
    v_target_sale_id  := OLD.sale_id;
  ELSE
    v_target_order_id := NEW.order_id;
    v_target_sale_id  := NEW.sale_id;
  END IF;

  IF v_target_order_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
      FROM payments WHERE order_id = v_target_order_id;

    SELECT montant_total INTO v_total
      FROM orders WHERE id = v_target_order_id;

    UPDATE orders SET
      montant_paye = v_total_paye,
      statut_paiement = (CASE
        WHEN v_total_paye <= 0       THEN 'impaye'
        WHEN v_total_paye >= v_total THEN 'paye'
        ELSE 'partiel'
      END)::payment_status,
      updated_at = NOW()
    WHERE id = v_target_order_id;

  ELSIF v_target_sale_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO v_total_paye
      FROM payments WHERE sale_id = v_target_sale_id;

    SELECT total_vente INTO v_total
      FROM sales WHERE id = v_target_sale_id;

    UPDATE sales SET
      montant_paye = v_total_paye,
      solde_du = GREATEST(v_total - v_total_paye, 0),
      statut_credit = CASE
        WHEN v_total_paye <= 0       THEN 'Impayé'
        WHEN v_total_paye >= v_total THEN 'Payé'
        ELSE 'Partiel'
      END,
      updated_at = NOW()
    WHERE id = v_target_sale_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_payment_does_not_exceed_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_total       NUMERIC;
  v_deja_paye   NUMERIC;
BEGIN
  IF NEW.montant <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être positif.';
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT montant_total, montant_paye INTO v_total, v_deja_paye
      FROM orders WHERE id = NEW.order_id FOR UPDATE;
  ELSE
    SELECT total_vente, montant_paye INTO v_total, v_deja_paye
      FROM sales WHERE id = NEW.sale_id FOR UPDATE;
  END IF;

  IF v_deja_paye + NEW.montant > v_total THEN
    RAISE EXCEPTION 'Le montant dépasse le reste à payer. Il reste % Ar.', (v_total - v_deja_paye);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sale_quantity(p_sale_id uuid, p_new_quantite integer, p_new_total_vente numeric, p_client_credit text, p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.creer_avoir(p_store_id uuid, p_ticket_id uuid, p_facture_numero text, p_client_id uuid, p_client_nom text, p_motif text, p_montant numeric, p_lignes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_ligne jsonb;
  v_ordre integer := 0;
  v_total_ticket numeric;
  v_deja numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;
  IF NOT store_allows_write(p_store_id) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RAISE EXCEPTION 'Le montant d''un avoir doit être positif.' USING ERRCODE = '22023';
  END IF;

  IF p_ticket_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total_vente), 0) INTO v_total_ticket
      FROM sales
     WHERE store_id = p_store_id
       AND (ticket_id = p_ticket_id OR id = p_ticket_id);

    SELECT COALESCE(SUM(montant), 0) INTO v_deja
      FROM avoirs WHERE store_id = p_store_id AND ticket_id = p_ticket_id;

    IF v_total_ticket > 0 AND p_montant + v_deja > v_total_ticket THEN
      RAISE EXCEPTION
        'Avoir refusé : la facture porte % et % a déjà été avoirée.',
        v_total_ticket, v_deja
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO avoirs (
    store_id, ticket_id, facture_numero, client_id, client_nom, motif, montant, created_by
  ) VALUES (
    p_store_id, p_ticket_id, NULLIF(btrim(COALESCE(p_facture_numero, '')), ''),
    p_client_id, COALESCE(p_client_nom, ''), COALESCE(p_motif, ''), p_montant, auth.uid()
  ) RETURNING id INTO v_id;

  IF p_lignes IS NOT NULL AND jsonb_typeof(p_lignes) = 'array' THEN
    FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes) LOOP
      v_ordre := v_ordre + 1;
      INSERT INTO avoir_items (
        avoir_id, store_id, product_id, designation, quantite, prix_unitaire, total, ordre
      ) VALUES (
        v_id, p_store_id,
        NULLIF(v_ligne->>'product_id', '')::uuid,
        COALESCE(v_ligne->>'designation', ''),
        COALESCE((v_ligne->>'quantite')::numeric, 1),
        COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
        COALESCE((v_ligne->>'quantite')::numeric, 1) * COALESCE((v_ligne->>'prix_unitaire')::numeric, 0),
        v_ordre
      );
    END LOOP;
  END IF;

  RETURN (SELECT to_jsonb(a) FROM avoirs a WHERE a.id = v_id);
END;
$function$;

-- ── Ce que la migration avait ajouté ─────────────────────────────────

DROP FUNCTION IF EXISTS public.recalculer_solde_vente(uuid);
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_montant_avoire_borne;
ALTER TABLE public.sales DROP COLUMN IF EXISTS montant_avoire;
