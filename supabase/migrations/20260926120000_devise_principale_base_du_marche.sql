-- Passer à une devise principale pas encore ajoutée rebasait les taux
-- comme si elle valait 1 (1 MGA = 1 EUR jusqu'au recalcul automatique,
-- et pour toujours en mode manuel). La base vient désormais du marché
-- quand la devise n'a pas de taux connu dans la boutique.
CREATE OR REPLACE FUNCTION public.definir_devise_principale(p_store_id uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(btrim(p_code));
  v_ancienne text;
  v_base numeric;
  v_symbole text;
  v_ref_nouvelle numeric;
  v_ref_ancienne numeric;
BEGIN
  IF NOT (public.is_store_owner(p_store_id) AND public.store_allows_write(p_store_id)) THEN
    RAISE EXCEPTION 'Non autorisé.' USING ERRCODE = '42501';
  END IF;
  SELECT symbole INTO v_symbole FROM devises
   WHERE code = v_code AND (store_id IS NULL OR store_id = p_store_id)
   ORDER BY store_id NULLS FIRST LIMIT 1;
  IF v_symbole IS NULL THEN
    RAISE EXCEPTION 'Devise inconnue : %.', v_code USING ERRCODE = '22023';
  END IF;

  SELECT code INTO v_ancienne FROM devises_boutique WHERE store_id = p_store_id AND principale;
  IF v_ancienne = v_code THEN RETURN; END IF;

  PERFORM set_config('tantana.changement_principale', 'on', true);

  -- v_base : valeur d'une unité de la nouvelle devise, dans l'ancienne.
  SELECT taux INTO v_base FROM devises_boutique WHERE store_id = p_store_id AND code = v_code;
  IF v_base IS NULL THEN
    SELECT unites_par_usd INTO v_ref_nouvelle FROM taux_reference WHERE code = v_code;
    SELECT unites_par_usd INTO v_ref_ancienne FROM taux_reference WHERE code = v_ancienne;
    v_base := CASE WHEN v_ref_nouvelle > 0 AND v_ref_ancienne > 0
                   THEN v_ref_ancienne / v_ref_nouvelle ELSE 1 END;
    INSERT INTO devises_boutique (store_id, code, taux) VALUES (p_store_id, v_code, v_base);
  END IF;

  UPDATE devises_boutique SET principale = false, taux_source = 'manuel'
   WHERE store_id = p_store_id AND principale AND code <> v_code;

  UPDATE devises_boutique
     SET taux = round(taux / v_base, 10)
   WHERE store_id = p_store_id AND code <> v_code;

  UPDATE devises_boutique SET principale = true
   WHERE store_id = p_store_id AND code = v_code;

  UPDATE stores SET currency_symbol = v_symbole WHERE id = p_store_id;

  PERFORM set_config('tantana.changement_principale', '', true);
  PERFORM public.appliquer_taux_automatiques(p_store_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.definir_devise_principale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_devise_principale(uuid, text) TO authenticated;
