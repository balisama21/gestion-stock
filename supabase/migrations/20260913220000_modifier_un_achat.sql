-- Corriger un achat déjà enregistré.
--
-- ── Pourquoi c'est plus difficile que de le supprimer ──
--
-- Supprimer défait tout d'un bloc. Modifier doit défaire une PARTIE et
-- refaire le reste, en gardant trois choses d'accord entre elles : le
-- stock du produit, le total qui pèse sur la trésorerie, et le règlement
-- déjà versé au fournisseur.
--
-- ── Le piège qui aurait tout bloqué ──
--
-- Le garde anti-surpaiement existe déjà, mais il vit dans le
-- déclencheur des règlements : il ne se réveille que quand un règlement
-- bouge, jamais quand le total de l'achat change. Or les achats de la
-- base sont TOUS réglés au centime près, comptant. Baisser un prix — le
-- cas le plus courant d'une faute de frappe — aurait donc laissé un
-- règlement supérieur au total, et `solde_du` serait parti en négatif :
-- une dette à l'envers, qui se propage dans tous les cumuls.
--
-- La fonction reprend donc le règlement en même temps que le montant.
-- `p_montant_regle` dit ce qui est réellement payé APRÈS correction.
-- Nul, on ne touche pas aux règlements et on refuse si le nouveau total
-- passe en dessous de ce qui est déjà versé.
--
-- Elle ne sait reprendre qu'UN SEUL règlement — le versement comptant
-- posé à l'enregistrement, qui est le cas de tous les achats existants.
-- Au-delà, elle refuse plutôt que de choisir à la place de quelqu'un
-- lequel des trois versements corriger.
--
-- ── Ce qu'elle ne fait pas, volontairement ──
--
-- Changer la DÉSIGNATION, donc le produit concerné. Ce serait déplacer
-- du stock d'un produit vers un autre et rejouer la règle de
-- correspondance qui a créé la fiche : c'est une suppression suivie d'un
-- nouvel achat, pas une correction. L'écran le dit et fige le champ.
--
-- Elle ne touche pas non plus au prix d'achat du PRODUIT. Corriger une
-- ligne d'achat n'est pas décider d'un nouveau tarif catalogue, et le
-- faire en douce surprendrait.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Le journal du stock accepte la modification d'un achat
-- ═══════════════════════════════════════════════════════════════════
--
-- `vente_modification` existait ; son équivalent pour les achats n'avait
-- jamais été ajouté, faute d'écran pour le produire. Élargissement pur :
-- aucune ligne existante ne devient invalide.

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_type_mouvement_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_type_mouvement_check
  CHECK (type_mouvement = ANY (ARRAY[
    'achat', 'achat_modification', 'achat_suppression',
    'vente', 'vente_modification', 'vente_suppression',
    'commande_reservation', 'commande_liberation', 'commande_livraison',
    'commande_annulation_apres_livraison',
    'ajustement'
  ]));

-- ═══════════════════════════════════════════════════════════════════
-- 2. La correction elle-même
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.modifier_achat(
  p_purchase_id uuid,
  p_date date,
  p_quantite integer,
  p_prix_achat_unit numeric,
  p_fournisseur text,
  p_montant_regle numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_achat   purchases%ROWTYPE;
  v_prod    record;
  v_total   numeric;
  v_delta   integer;
  v_nouveau integer;
  v_nb_reg  integer;
  v_reg     supplier_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_achat FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat introuvable (deja supprime ?).';
  END IF;

  IF store_is_locked(v_achat.store_id) THEN
    RAISE EXCEPTION 'Boutique verrouillee : aucune ecriture possible.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT can_modify_in_store(v_achat.owner_id, v_achat.store_id) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de modifier cet achat.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_quantite IS NULL OR p_quantite <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre superieure a zero.';
  END IF;
  IF p_prix_achat_unit IS NULL OR p_prix_achat_unit < 0 THEN
    RAISE EXCEPTION 'Le prix d''achat ne peut pas etre negatif.';
  END IF;

  v_total := p_quantite * p_prix_achat_unit;

  -- ── Le stock suit la quantite ──
  v_delta := p_quantite - v_achat.quantite;
  IF v_achat.product_id IS NOT NULL AND v_delta <> 0 THEN
    SELECT id, display_name, stock_actuel, stock_reserve INTO v_prod
      FROM products WHERE id = v_achat.product_id FOR UPDATE;
    IF FOUND THEN
      v_nouveau := v_prod.stock_actuel + v_delta;
      IF v_nouveau < 0 THEN
        RAISE EXCEPTION
          'Impossible : il ne reste que % unite(s) de "%" en stock, la correction en retirerait %.',
          v_prod.stock_actuel, v_prod.display_name, abs(v_delta);
      END IF;
      IF v_nouveau < v_prod.stock_reserve THEN
        RAISE EXCEPTION
          'Impossible : % unite(s) de "%" sont reservees pour des commandes en cours.',
          v_prod.stock_reserve, v_prod.display_name;
      END IF;

      UPDATE products SET stock_actuel = v_nouveau WHERE id = v_achat.product_id;

      INSERT INTO stock_movements (
        store_id, product_id, type_mouvement, stock_actuel_delta,
        stock_reserve_delta, reference_type, reference_id, created_by, note
      ) VALUES (
        v_achat.store_id, v_achat.product_id, 'achat_modification', v_delta,
        0, 'purchase', p_purchase_id, auth.uid(),
        'Correction de l achat ' || coalesce(v_achat.numero, '')
      );
    END IF;
  END IF;

  -- ── Le reglement suit le montant ──
  SELECT count(*) INTO v_nb_reg FROM supplier_payments WHERE purchase_id = p_purchase_id;

  IF p_montant_regle IS NULL THEN
    -- On ne touche pas aux reglements : il faut alors que le nouveau
    -- total reste au-dessus de ce qui a deja ete verse.
    IF v_achat.montant_paye > v_total THEN
      RAISE EXCEPTION
        'Le reglement deja enregistre (%) depasserait le nouveau total (%). Corrigez aussi le montant regle.',
        v_achat.montant_paye, v_total;
    END IF;
  ELSE
    IF p_montant_regle < 0 THEN
      RAISE EXCEPTION 'Le montant regle ne peut pas etre negatif.';
    END IF;
    IF p_montant_regle > v_total THEN
      RAISE EXCEPTION 'On ne regle pas plus que le montant de l''achat (% pour un total de %).',
        p_montant_regle, v_total;
    END IF;
    IF v_nb_reg > 1 THEN
      RAISE EXCEPTION
        'Cet achat porte % reglements : corrigez-les un par un avant d''en changer le montant.',
        v_nb_reg;
    END IF;

    -- On garde la date et le moyen de paiement d'origine : seul le
    -- montant est en cause. Supprimer puis reinserer laisse le
    -- declencheur voir des etats coherents a chaque instant.
    SELECT * INTO v_reg FROM supplier_payments WHERE purchase_id = p_purchase_id LIMIT 1;
    DELETE FROM supplier_payments WHERE purchase_id = p_purchase_id;
  END IF;

  UPDATE purchases SET
    date             = coalesce(p_date, v_achat.date),
    quantite         = p_quantite,
    prix_achat_unit  = p_prix_achat_unit,
    total_achat      = v_total,
    impact_tresorerie = -v_total,
    fournisseur      = coalesce(nullif(btrim(p_fournisseur), ''), v_achat.fournisseur)
  WHERE id = p_purchase_id;

  IF p_montant_regle IS NOT NULL AND p_montant_regle > 0 THEN
    INSERT INTO supplier_payments (
      purchase_id, store_id, recorded_by, montant, date, methode, reference, note
    ) VALUES (
      p_purchase_id, v_achat.store_id, auth.uid(), p_montant_regle,
      coalesce(v_reg.date, coalesce(p_date, v_achat.date)),
      coalesce(v_reg.methode, 'especes'),
      v_reg.reference,
      v_reg.note
    );
  END IF;

  RETURN (SELECT to_jsonb(p) FROM purchases p WHERE p.id = p_purchase_id);
END;
$function$;

COMMENT ON FUNCTION public.modifier_achat(uuid, date, integer, numeric, text, numeric) IS
  'Corrige un achat : deplace le stock du delta de quantite, recalcule le total et reprend le reglement comptant. Ne change jamais le produit concerne.';

GRANT EXECUTE ON FUNCTION public.modifier_achat(uuid, date, integer, numeric, text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.modifier_achat(uuid, date, integer, numeric, text, numeric) FROM anon;
