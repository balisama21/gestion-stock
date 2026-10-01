-- M2 — Boutiques étiquetées par marque (Kinvest et futures marques blanches).
--
-- Une boutique dont stores.marque_id est renseigné appartient à une marque
-- cliente : jamais verrouillée, jamais d'essai ni d'abonnement Tantana.
-- L'étiquette ne se pose que par ouvrir_boutique_de_marque (propriétaires
-- listés, e-mail confirmé) ou par l'éditeur SQL ; le client ne peut ni la
-- poser ni la changer.
--
-- Additif : une colonne nullable (null = Tantana), une table, des
-- fonctions. Remplacées : store_is_locked, protect_store_activation_fields,
-- activer_le_compte, copy_store, redeem_access_code — comportement Tantana
-- identique pour toute boutique sans étiquette.
--
-- Retour arrière : supabase/retours-arriere/20261001110000_marques_boutiques_etiquetees.sql

BEGIN;

-- ─── 1. L'étiquette ─────────────────────────────────────────────────

ALTER TABLE public.stores
  ADD COLUMN marque_id uuid REFERENCES public.branding(id);

CREATE INDEX stores_marque_id_idx ON public.stores (marque_id) WHERE marque_id IS NOT NULL;

COMMENT ON COLUMN public.stores.marque_id IS
  'Marque blanche de la boutique (branding.id). NULL = Tantana. Posée uniquement par ouvrir_boutique_de_marque ou en SQL.';

CREATE OR REPLACE FUNCTION public.proteger_marque_de_boutique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Fonctions SECURITY DEFINER, clé de service, éditeur SQL.
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.marque_id IS NOT NULL THEN
    RAISE EXCEPTION 'Une boutique de marque se crée par ouvrir_boutique_de_marque.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.marque_id IS DISTINCT FROM OLD.marque_id THEN
    RAISE EXCEPTION 'La marque d''une boutique ne se modifie pas depuis l''application.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_marque_de_boutique() FROM PUBLIC, anon, authenticated;

-- « 00 » : passe avant trg_protect_store_activation (ordre alphabétique).
CREATE TRIGGER stores_00_proteger_marque
  BEFORE INSERT OR UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.proteger_marque_de_boutique();

-- ─── 2. La liste des propriétaires ──────────────────────────────────

CREATE TABLE public.proprietaires_de_marque (
  marque_id uuid NOT NULL REFERENCES public.branding(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  ajoute_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marque_id, email)
);

COMMENT ON TABLE public.proprietaires_de_marque IS
  'E-mails autorisés à créer des boutiques sous une marque. Écriture : éditeur SQL uniquement.';

ALTER TABLE public.proprietaires_de_marque ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.proprietaires_de_marque FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proprietaires_de_marque TO authenticated;

-- Aucune politique d'écriture : seul le rôle postgres (éditeur SQL) écrit.
CREATE POLICY "Lecture par l'admin plateforme"
  ON public.proprietaires_de_marque FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

-- ─── 3. Fonctions internes (aucun appel depuis le client) ──────────

CREATE OR REPLACE FUNCTION public.marque_de_l_hote(p_hote text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
    FROM custom_domains d
    JOIN branding b ON b.store_id = d.store_id
   WHERE d.hostname = normaliser_hote(p_hote)
     AND d.is_active
   LIMIT 1;
$$;

-- E-mail du COMPTE (auth.users), confirmé, présent dans la liste.
CREATE OR REPLACE FUNCTION public.est_proprietaire_de_marque(p_marque_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_marque_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN proprietaires_de_marque p ON p.email = lower(btrim(u.email))
     WHERE u.id = auth.uid()
       AND u.email_confirmed_at IS NOT NULL
       AND p.marque_id = p_marque_id
  );
$$;

REVOKE ALL ON FUNCTION public.marque_de_l_hote(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.est_proprietaire_de_marque(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 4. RPC du client ───────────────────────────────────────────────

-- Marque du domaine visité, et droit de l'appelant d'y créer des boutiques.
CREATE OR REPLACE FUNCTION public.acces_a_la_marque(p_hote text)
RETURNS TABLE (marque_id uuid, proprietaire boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, public.est_proprietaire_de_marque(m.id)
    FROM (SELECT public.marque_de_l_hote(p_hote) AS id) m;
$$;

CREATE OR REPLACE FUNCTION public.ouvrir_boutique_de_marque(p_hote text, p_nom text)
RETURNS public.stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_marque uuid;
  v_store public.stores;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  v_marque := public.marque_de_l_hote(p_hote);
  IF v_marque IS NULL THEN
    RAISE EXCEPTION 'Ce domaine n''est rattaché à aucune marque.';
  END IF;
  IF NOT public.est_proprietaire_de_marque(v_marque) THEN
    RAISE EXCEPTION 'Ce compte n''est pas autorisé à créer une boutique ici.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO stores (name, owner_id, marque_id)
  VALUES (left(coalesce(nullif(btrim(p_nom), ''), 'Ma boutique'), 120), v_uid, v_marque)
  RETURNING * INTO v_store;

  -- Premier accès : le compte s'installe sur cette boutique. store_id posé
  -- en même temps que le statut, sans quoi ensure_owner_store ouvrirait
  -- une boutique Tantana.
  UPDATE profiles
     SET role = CASE WHEN role = 'pending' THEN 'founder'::public.user_role ELSE role END,
         status = 'activated',
         store_id = coalesce(store_id, v_store.id)
   WHERE id = v_uid
     AND (status = 'pending' OR role = 'pending' OR store_id IS NULL);

  RETURN v_store;
END;
$$;

-- Rattachement commun au code et au lien : l'étiquette de la boutique
-- invitante doit être celle du domaine visité (NULL = Tantana).
CREATE OR REPLACE FUNCTION public.rejoindre_invitation_sur_marque(p_invitation_id uuid, p_hote text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
  v_store public.stores;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_inv FROM collaborator_invitations WHERE id = p_invitation_id FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Code invalide.';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette invitation a déjà été utilisée ou annulée.';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Cette invitation a expiré.';
  END IF;
  IF lower(v_inv.invited_email) <> lower(coalesce(v_email, '')) THEN
    RAISE EXCEPTION 'Cette invitation ne correspond pas à votre e-mail.';
  END IF;

  SELECT * INTO v_store FROM stores WHERE id = v_inv.store_id;
  IF v_store.marque_id IS DISTINCT FROM public.marque_de_l_hote(p_hote) THEN
    RAISE EXCEPTION 'Cette invitation concerne une autre application.';
  END IF;

  INSERT INTO store_members (store_id, user_id, role, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;

  UPDATE collaborator_invitations
     SET status = 'accepted', accepted_at = now()
   WHERE id = v_inv.id;

  UPDATE profiles
     SET status = 'activated',
         role = CASE WHEN role = 'pending' THEN 'seller'::public.user_role ELSE role END,
         store_id = coalesce(store_id, v_inv.store_id)
   WHERE id = v_uid;

  RETURN jsonb_build_object('store_id', v_store.id, 'store_name', v_store.name);
END;
$$;

REVOKE ALL ON FUNCTION public.rejoindre_invitation_sur_marque(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rejoindre_par_code_sur_marque(p_code text, p_hote text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rejoindre_invitation_sur_marque(
    (SELECT id FROM collaborator_invitations
      WHERE invite_code = upper(btrim(p_code))
      ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 1),
    p_hote
  );
$$;

CREATE OR REPLACE FUNCTION public.rejoindre_par_lien_sur_marque(p_token text, p_hote text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rejoindre_invitation_sur_marque(
    (SELECT id FROM collaborator_invitations WHERE token = p_token LIMIT 1),
    p_hote
  );
$$;

-- Marque d'une boutique pour ses documents, e-mails et exports. Vide pour
-- une boutique Tantana ou inaccessible à l'appelant.
CREATE OR REPLACE FUNCTION public.marque_de_la_boutique(p_store_id uuid)
RETURNS TABLE (
  app_name text, short_name text, tagline text, page_title text,
  logo_url text, favicon_url text, splash_logo_url text, login_image_url text,
  login_title text, login_subtitle text,
  primary_color text, primary_color_dark text, splash_background text, landing jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.app_name, b.short_name, b.tagline, b.page_title,
         b.logo_url, b.favicon_url, b.splash_logo_url, b.login_image_url,
         b.login_title, b.login_subtitle,
         b.primary_color, b.primary_color_dark, b.splash_background,
         b.landing
    FROM stores s
    JOIN branding b ON b.id = s.marque_id
   WHERE s.id = p_store_id
     AND (public.a_acces_a_la_boutique(p_store_id) OR public.is_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.acces_a_la_marque(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ouvrir_boutique_de_marque(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rejoindre_par_code_sur_marque(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rejoindre_par_lien_sur_marque(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marque_de_la_boutique(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_a_la_marque(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ouvrir_boutique_de_marque(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejoindre_par_code_sur_marque(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejoindre_par_lien_sur_marque(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marque_de_la_boutique(uuid) TO authenticated;

-- ─── 5. Une boutique de marque n'est jamais verrouillée ────────────
--
-- Droits d'exécution inchangés : 91 politiques TO public l'appellent, et
-- anon les évalue ; lui retirer anon changerait des lectures vides en erreurs.

CREATE OR REPLACE FUNCTION public.store_is_locked(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN s.marque_id IS NOT NULL THEN false
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

-- ─── 6. L'essai et l'activation Tantana ignorent les boutiques de marque

CREATE OR REPLACE FUNCTION public.protect_store_activation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compte public.activations_de_compte;
  v_fin_essai timestamptz;
  v_etiquetage boolean := false;
BEGIN
  IF current_setting('app.bypass_activation_guard', true) = 'on' THEN
    RETURN NEW; -- Appel légitime depuis une RPC de confiance
  END IF;

  -- Boutique de marque : ouverte à vie, à la création comme à l'étiquetage.
  -- Les navigateurs encore sur l'ancien code la voient aussi ouverte.
  IF NEW.marque_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_etiquetage := true;
    ELSE
      v_etiquetage := NEW.marque_id IS DISTINCT FROM OLD.marque_id;
    END IF;
    IF v_etiquetage THEN
      NEW.activation_status := 'active';
      NEW.activated_at := coalesce(NEW.activated_at, now());
      NEW.abonnement_jusqu_au := NULL;
      NEW.trial_ends_at := coalesce(NEW.trial_ends_at, now() + interval '30 days');
      RETURN NEW;
    END IF;
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
      -- Essai en cours du compte, boutiques de marque exclues.
      SELECT min(trial_ends_at) INTO v_fin_essai
      FROM public.stores
      WHERE owner_id = NEW.owner_id
        AND marque_id IS NULL;

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

REVOKE ALL ON FUNCTION public.protect_store_activation_fields() FROM PUBLIC, anon, authenticated;

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

  -- Boutiques Tantana seulement : une échéance d'abonnement ne doit
  -- jamais atteindre une boutique de marque.
  UPDATE public.stores
  SET activation_status = 'active',
      activated_at = coalesce(activated_at, v_ligne.active_le),
      abonnement_jusqu_au = v_ligne.abonnement_jusqu_au
  WHERE owner_id = p_user_id
    AND marque_id IS NULL;

  RETURN v_ligne;
END;
$function$;

REVOKE ALL ON FUNCTION public.activer_le_compte(uuid, integer) FROM PUBLIC, anon, authenticated;

-- ─── 7. Copier une boutique garde son étiquette ─────────────────────
--
-- Sans cela, la copie d'une boutique de marque (ouverte à vie) donnerait
-- une boutique Tantana ouverte à vie.

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
  IF v_source.marque_id IS NOT NULL
     AND NOT public.est_proprietaire_de_marque(v_source.marque_id) THEN
    RAISE EXCEPTION 'Ce compte n''est pas autorisé à créer une boutique pour cette marque.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('app.bypass_activation_guard', 'on', true);

  INSERT INTO public.stores (
    name, subtitle, owner_id, currency_symbol, tva_rate, suppliers,
    enable_pin_security, capital_initial, seuil_alerte_tresorerie,
    address, phone, email, nif_stat, receipt_footer,
    activation_status, trial_ends_at, activated_at, abonnement_jusqu_au,
    marque_id
  )
  VALUES (
    trim(p_new_name), v_source.subtitle, v_uid, v_source.currency_symbol, v_source.tva_rate,
    v_source.suppliers, v_source.enable_pin_security,
    0, -- capital réinitialisé : une copie ne doit jamais hériter de la trésorerie
    v_source.seuil_alerte_tresorerie,
    v_source.address, v_source.phone, v_source.email, v_source.nif_stat, v_source.receipt_footer,
    v_source.activation_status,
    v_source.trial_ends_at,
    CASE WHEN v_source.activation_status = 'active' THEN now() ELSE NULL END,
    -- La copie herite de la MEME echeance, jamais d un mois neuf : sans
    -- cela, copier une boutique au mois donnerait une boutique a vie.
    v_source.abonnement_jusqu_au,
    v_source.marque_id
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$function$;

REVOKE ALL ON FUNCTION public.copy_store(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_store(uuid, text) TO authenticated;

-- ─── 8. Le code d'accès Tantana ouvre une boutique Tantana ─────────

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

  -- Boutique Tantana du compte ; une boutique de marque n'en tient pas lieu.
  SELECT id INTO v_store_id FROM stores
   WHERE owner_id = v_user AND marque_id IS NULL
   ORDER BY created_at LIMIT 1;

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

REVOKE ALL ON FUNCTION public.redeem_access_code(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text, text) TO authenticated;

COMMIT;
