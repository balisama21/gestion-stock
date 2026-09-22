-- ════════════════════════════════════════════════════════════════════
-- DOCUMENTS V3 — LA COMMISSION D'UNE PRESTATION
--
-- « Une facture qui fait apparaître la commission de la boutique. Le
-- mode d'affichage est un réglage par boutique : commission sur une
-- ligne séparée, ou incluse dans le prix des lignes. »
--
-- ── LA COMMISSION EST COMPRISE, ELLE NE S'AJOUTE PAS ────────────────
--
-- C'est la décision qui tient tout le reste. `total_vente` ne bouge
-- pas d'un ariary : la commission est la PART de ce total que la
-- boutique garde, comme la TVA est une part du prix payé. Ni la
-- caisse, ni la marge, ni le stock ne s'en aperçoivent — et
-- `create_sale` n'est pas touché, ce qui était la condition.
--
-- Afficher la commission « séparément » revient donc à détailler un
-- total, jamais à le refaire : la ligne de prestation montre
-- `total − commission`, la ligne de commission montre le reste, et
-- les deux se rejoignent sur le même total qu'avant.
--
-- ── UNE SEULE LIGNE DU TICKET LA PORTE ──────────────────────────────
--
-- Le document additionne les lignes d'un même ticket, comme il le
-- fait déjà des montants. Deux lignes porteuses compteraient donc la
-- commission deux fois : la fonction remet les autres à zéro.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS commission numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sales.commission IS
  'La part que la boutique garde sur une prestation. Elle est COMPRISE dans total_vente : elle ne s''y ajoute pas, et ne change donc ni la caisse ni la marge. Zero = vente ordinaire.';

CREATE OR REPLACE FUNCTION public.fixer_commission_de_vente(
  p_sale_id uuid,
  p_montant numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_owner uuid;
  v_ticket uuid;
  v_total numeric;
BEGIN
  SELECT store_id, owner_id, ticket_id INTO v_store, v_owner, v_ticket
    FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF NOT can_modify_in_store(v_owner, v_store) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant < 0 THEN
    RAISE EXCEPTION 'Une commission ne peut pas être négative.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(total_vente), 0) INTO v_total
    FROM sales
   WHERE store_id = v_store
     AND (
       (v_ticket IS NOT NULL AND ticket_id = v_ticket)
       OR (v_ticket IS NULL AND id = p_sale_id)
     );

  IF p_montant > v_total THEN
    RAISE EXCEPTION
      'La commission (%) dépasse le total du ticket (%).', p_montant, v_total
      USING ERRCODE = '22023';
  END IF;

  UPDATE sales SET commission = 0
   WHERE store_id = v_store
     AND v_ticket IS NOT NULL
     AND ticket_id = v_ticket;

  UPDATE sales SET commission = p_montant WHERE id = p_sale_id;

  RETURN p_montant;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fixer_commission_de_vente(uuid, numeric) FROM anon;
