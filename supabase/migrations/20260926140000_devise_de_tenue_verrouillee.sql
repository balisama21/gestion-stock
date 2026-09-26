-- La devise de tenue des comptes ne change plus dès que la boutique a des
-- montants enregistrés : changer de devise ne ferait que changer le
-- symbole de chiffres restés dans l'ancienne monnaie. Voir une autre
-- devise passe par la devise d'affichage (paramètre devise_affichage).
CREATE OR REPLACE FUNCTION public.boutique_a_des_montants(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_store_member(p_store_id) AND (
       EXISTS (SELECT 1 FROM sales WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM purchases WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM expenses WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM orders WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM quotes WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM capital_apports WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM notes_de_frais WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM products WHERE store_id = p_store_id)
    OR EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND capital_initial <> 0)
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.boutique_a_des_montants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boutique_a_des_montants(uuid) TO authenticated;

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

  -- Première installation (aucune principale) : toujours permise.
  IF v_ancienne IS NOT NULL AND public.boutique_a_des_montants(p_store_id) THEN
    RAISE EXCEPTION 'La boutique a déjà des montants enregistrés : sa devise de tenue ne change plus. Choisissez plutôt la devise d''affichage.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('tantana.changement_principale', 'on', true);

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
