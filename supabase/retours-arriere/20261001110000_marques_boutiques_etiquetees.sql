-- Retour arrière de M2 : état d'avant le 01/10/2026.
--
-- Données d'abord : « CRM Kinvest » reprend son essai d'origine. Toute
-- autre boutique étiquetée (créée après M2) repasse en essai de 30 jours
-- à compter de sa création — sans étiquette, elle redevient Tantana.
BEGIN;

SELECT set_config('app.bypass_activation_guard', 'on', true);

UPDATE public.stores
   SET activation_status = 'trial',
       trial_ends_at = '2026-10-15 00:06:10.912202+00',
       activated_at = NULL,
       abonnement_jusqu_au = NULL
 WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80';

UPDATE public.stores
   SET activation_status = 'trial',
       trial_ends_at = created_at + interval '30 days',
       activated_at = NULL,
       abonnement_jusqu_au = NULL
 WHERE marque_id IS NOT NULL
   AND id <> 'caa17416-3aef-4d1c-9f24-6fd66909cf80';

-- Fonctions nouvelles
DROP FUNCTION IF EXISTS public.marque_de_la_boutique(uuid);
DROP FUNCTION IF EXISTS public.rejoindre_par_lien_sur_marque(text, text);
DROP FUNCTION IF EXISTS public.rejoindre_par_code_sur_marque(text, text);
DROP FUNCTION IF EXISTS public.rejoindre_invitation_sur_marque(uuid, text);
DROP FUNCTION IF EXISTS public.ouvrir_boutique_de_marque(text, text);
DROP FUNCTION IF EXISTS public.acces_a_la_marque(text);
DROP FUNCTION IF EXISTS public.est_proprietaire_de_marque(uuid);
DROP FUNCTION IF EXISTS public.marque_de_l_hote(text);

-- Fonctions remplacées : définitions d'avant M2
CREATE OR REPLACE FUNCTION public.store_is_locked(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN s.activation_status = 'locked' THEN true
    -- Au mois : active tant que l echeance n est pas passee.
    WHEN s.activation_status = 'active'
         AND s.abonnement_jusqu_au IS NOT NULL
         AND s.abonnement_jusqu_au < now() THEN true
    WHEN s.activation_status = 'active' THEN false
    WHEN s.activation_status = 'trial' AND s.trial_ends_at < now() THEN true
    ELSE false
  END
  FROM public.stores s
  WHERE s.id = p_store_id;
$function$;

CREATE OR REPLACE FUNCTION public.protect_store_activation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compte public.activations_de_compte;
  v_fin_essai timestamptz;
BEGIN
  IF current_setting('app.bypass_activation_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_compte
    FROM public.activations_de_compte
    WHERE user_id = NEW.owner_id;

    IF v_compte.user_id IS NOT NULL
       AND (v_compte.abonnement_jusqu_au IS NULL OR v_compte.abonnement_jusqu_au > now())
    THEN
      NEW.activation_status := 'active';
      NEW.activated_at := now();
      NEW.abonnement_jusqu_au := v_compte.abonnement_jusqu_au;
      NEW.trial_ends_at := now() + interval '30 days';
    ELSE
      SELECT min(trial_ends_at) INTO v_fin_essai
      FROM public.stores
      WHERE owner_id = NEW.owner_id;

      NEW.activation_status := 'trial';
      NEW.trial_ends_at := coalesce(v_fin_essai, now() + interval '30 days');
      NEW.activated_at := NULL;
      NEW.abonnement_jusqu_au := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.activation_status := OLD.activation_status;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.activated_at := OLD.activated_at;
    NEW.abonnement_jusqu_au := OLD.abonnement_jusqu_au;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activer_le_compte(p_user_id uuid, p_duree_jours integer)
RETURNS public.activations_de_compte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne public.activations_de_compte;
BEGIN
  INSERT INTO public.activations_de_compte (user_id, active_le, abonnement_jusqu_au)
  VALUES (
    p_user_id,
    now(),
    CASE WHEN p_duree_jours IS NULL THEN NULL
         ELSE now() + (p_duree_jours || ' days')::interval END
  )
  ON CONFLICT (user_id) DO UPDATE
    SET abonnement_jusqu_au = CASE
          WHEN p_duree_jours IS NULL THEN NULL
          WHEN activations_de_compte.abonnement_jusqu_au IS NULL THEN NULL
          ELSE greatest(now(), activations_de_compte.abonnement_jusqu_au)
               + (p_duree_jours || ' days')::interval
        END,
        mis_a_jour_le = now()
  RETURNING * INTO v_ligne;

  PERFORM set_config('app.bypass_activation_guard', 'on', true);

  UPDATE public.stores
  SET activation_status = 'active',
      activated_at = coalesce(activated_at, v_ligne.active_le),
      abonnement_jusqu_au = v_ligne.abonnement_jusqu_au
  WHERE owner_id = p_user_id;

  RETURN v_ligne;
END;
$function$;

CREATE OR REPLACE FUNCTION public.copy_store(p_source_store_id uuid, p_new_name text)
RETURNS public.stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.stores;
  v_new public.stores;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_source FROM public.stores WHERE id = p_source_store_id;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Boutique source introuvable.';
  END IF;
  IF v_source.owner_id <> v_uid THEN
    RAISE EXCEPTION 'Non autorisé : vous n''êtes pas propriétaire de cette boutique.';
  END IF;
  IF p_new_name IS NULL OR trim(p_new_name) = '' THEN
    RAISE EXCEPTION 'Nom de boutique requis.';
  END IF;

  PERFORM set_config('app.bypass_activation_guard', 'on', true);

  INSERT INTO public.stores (
    name, subtitle, owner_id, currency_symbol, tva_rate, suppliers,
    enable_pin_security, capital_initial, seuil_alerte_tresorerie,
    address, phone, email, nif_stat, receipt_footer,
    activation_status, trial_ends_at, activated_at, abonnement_jusqu_au
  )
  VALUES (
    trim(p_new_name), v_source.subtitle, v_uid, v_source.currency_symbol, v_source.tva_rate,
    v_source.suppliers, v_source.enable_pin_security,
    0,
    v_source.seuil_alerte_tresorerie,
    v_source.address, v_source.phone, v_source.email, v_source.nif_stat, v_source.receipt_footer,
    v_source.activation_status,
    v_source.trial_ends_at,
    CASE WHEN v_source.activation_status = 'active' THEN now() ELSE NULL END,
    v_source.abonnement_jusqu_au
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code text, p_store_name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code record;
  v_store_id uuid;
  v_email text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Non authentifié.'; END IF;

  SELECT * INTO v_code FROM access_codes
  WHERE upper(btrim(code)) = upper(btrim(p_code)) FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Code d''accès introuvable.'; END IF;
  IF v_code.status NOT IN ('pending', 'generated', 'sent') THEN
    RAISE EXCEPTION 'Ce code d''accès n''est plus utilisable (%).', v_code.status;
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'Ce code d''accès a expiré.';
  END IF;
  IF v_code.user_id IS NOT NULL AND v_code.user_id <> v_user THEN
    RAISE EXCEPTION 'Ce code d''accès est réservé à un autre compte.';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = v_user;

  SELECT id INTO v_store_id FROM stores WHERE owner_id = v_user ORDER BY created_at LIMIT 1;

  IF v_store_id IS NULL THEN
    INSERT INTO stores (name, owner_id)
    VALUES (COALESCE(NULLIF(btrim(p_store_name), ''), 'Boutique de ' || COALESCE(v_email, 'nouveau compte')), v_user)
    RETURNING id INTO v_store_id;
  END IF;

  UPDATE profiles
     SET role = 'founder',
         status = 'activated',
         store_id = v_store_id
   WHERE id = v_user;

  UPDATE access_codes
     SET status = 'used',
         user_id = v_user,
         activated_at = now()
   WHERE id = v_code.id;

  PERFORM public.activer_le_compte(v_user, v_code.duree_jours);

  RETURN (SELECT to_jsonb(s) FROM stores s WHERE s.id = v_store_id);
END;
$function$;

-- Droits d'exécution d'avant M2
GRANT EXECUTE ON FUNCTION public.copy_store(uuid, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_store_activation_fields() TO PUBLIC, anon, authenticated;

-- Étiquette et liste
DROP TRIGGER IF EXISTS stores_00_proteger_marque ON public.stores;
DROP FUNCTION IF EXISTS public.proteger_marque_de_boutique();
-- La liste (user_id, e-mail pour information) disparaît avec la table.
DROP TABLE IF EXISTS public.proprietaires_de_marque;
DROP INDEX IF EXISTS public.stores_marque_id_idx;
ALTER TABLE public.stores DROP COLUMN IF EXISTS marque_id;

COMMIT;
