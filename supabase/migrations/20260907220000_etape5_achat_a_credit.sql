-- ═══════════════════════════════════════════════════════════════════
-- Étape 5c — l'achat à crédit
--
-- La base sait déjà tenir une dette fournisseur depuis l'étape 5a, mais
-- seule la reprise pouvait en créer : `add_purchase` inscrivait
-- toujours la totalité en sortie de caisse. Cette migration lui donne
-- deux paramètres de plus — ce qui a été réglé, et l'échéance.
--
-- POURQUOI UN DROP PUIS UN CREATE, ET NON UN CREATE OR REPLACE
--
-- Un `CREATE OR REPLACE` ne remplace que la fonction de MÊME signature.
-- Ajouter deux paramètres en créerait donc une seconde à côté de
-- l'ancienne, et un appel à douze arguments deviendrait ambigu : les
-- deux conviendraient. Le remplacement doit être explicite. Il se joue
-- dans une transaction, donc sans instant où la fonction manquerait.
--
-- CE QUI NE CHANGE PAS
--
-- Les deux paramètres ont une valeur par défaut, et cette valeur
-- reproduit exactement le comportement d'avant : `p_montant_paye` à
-- NULL veut dire « réglé en totalité ». L'application déployée chez le
-- client appelle la fonction avec douze arguments nommés ; ils
-- continuent de correspondre, et le résultat est identique au chiffre
-- près — vérifié avant d'appliquer : payé, solde nul, impact égal à
-- l'opposé du total, un règlement, stock augmenté d'autant.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.add_purchase(
  uuid, date, uuid, text, text, text, numeric, integer, integer, numeric, text, text);

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
  p_idempotency_key text,
  -- NULL = réglé en totalité, c'est-à-dire le comportement d'avant.
  p_montant_paye numeric DEFAULT NULL,
  p_date_echeance date DEFAULT NULL
)
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

  -- Le montant est validé AVANT de toucher au stock : un refus ne doit
  -- pas laisser derrière lui un produit déjà réapprovisionné.
  v_total := p_quantite * p_prix_achat_unit;
  v_paye := COALESCE(p_montant_paye, v_total);
  IF v_paye < 0 OR v_paye > v_total THEN
    RAISE EXCEPTION 'Le montant réglé doit être compris entre 0 et le total de l''achat.';
  END IF;

  IF p_product_id IS NOT NULL THEN
    -- P1 FIX : le produit doit appartenir à p_store_id.
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

  -- Ce qui sort de la caisse est ce qui a été réglé, non le total. C'est
  -- toute la différence entre un achat comptant et un achat à crédit.
  INSERT INTO purchases (id, store_id, owner_id, date, product_id, designation, quantite,
                         prix_achat_unit, total_achat, fournisseur, impact_tresorerie,
                         idempotency_key, date_echeance)
  VALUES (v_purchase_id, p_store_id, v_owner, p_date, v_product_id, v_display_name, p_quantite,
          p_prix_achat_unit, v_total, p_fournisseur, -v_paye, p_idempotency_key, p_date_echeance);

  -- Un règlement INTÉGRAL est déjà écrit par le déclencheur posé à
  -- l'étape 5a, qui lit l'impact sur la caisse. On ne s'occupe donc ici
  -- que de l'acompte, sans quoi le règlement complet serait compté deux
  -- fois.
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
