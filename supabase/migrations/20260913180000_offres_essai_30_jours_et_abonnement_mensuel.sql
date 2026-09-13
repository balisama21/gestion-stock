-- Nouvelles offres : essai de 30 jours, et un abonnement au mois.
--
-- ── L'essai passe de 7 à 30 jours ──
--
-- La durée vivait à DEUX endroits : le `DEFAULT` de
-- `stores.trial_ends_at`, et le déclencheur
-- `protect_store_activation_fields()` qui l'ÉCRASE à chaque insertion.
-- Seul le second décidait réellement — le `DEFAULT` était du code mort.
-- Les deux sont mis à jour : laisser l'un mentir sur l'autre condamne le
-- prochain lecteur à refaire l'enquête.
--
-- ── Une boutique peut désormais être active AVEC une échéance ──
--
--   `stores.abonnement_jusqu_au` NULL   → à vie (ou essai) : ne se
--                                         verrouille jamais pour cette raison
--   `stores.abonnement_jusqu_au` posée  → au mois : se verrouille à l'échéance
--
-- `access_codes.duree_jours` porte la même distinction côté code
-- d'activation : sans durée le code vaut à vie, à 30 jours il vaut un
-- mois. C'est l'administrateur qui choisit au moment de générer.
--
-- Un renouvellement anticipé s'AJOUTE au reste du mois en cours plutôt
-- que de l'effacer : payer en avance ne doit jamais faire perdre des
-- jours.
--
-- ── Rien de rétroactif, et c'est structurel ──
--
-- Les boutiques déjà activées ont `abonnement_jusqu_au` à NULL : elles
-- restent à vie, définitivement. Ceux qui ont payé 100 000 Ar avant ce
-- changement ne perdent rien. Le déclencheur gèle par ailleurs les
-- colonnes d'activation à chaque UPDATE, donc aucun essai en cours n'est
-- recalculé sur la nouvelle durée.
--
-- ── Deux pièges évités ──
--
-- Sans geler `abonnement_jusqu_au` dans le déclencheur, n'importe quel
-- client aurait pu se prolonger de dix ans par un simple `update()` —
-- la colonne est écrite par une RPC de confiance, jamais par le client.
--
-- Sans la recopier dans `copy_store`, copier une boutique au mois aurait
-- produit une boutique active sans échéance : une activation à vie
-- gratuite, offerte par inadvertance.
--
-- ── Vérifié en transaction annulée, sur les données réelles ──
--
--   1 nouvel essai .................... 30 jours
--   2 boutiques à vie ................. 0 verrouillée à tort
--   3 essai en cours .................. figé
--   4 auto-prolongation par le client . figée
--   5 code mensuel .................... 30 jours, boutique ouverte
--   6 renouvellement anticipé ......... 60 jours (il s'ajoute)
--   7 mois échu ....................... boutique verrouillée
--   8 code à vie ...................... date nulle, boutique ouverte

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS abonnement_jusqu_au timestamptz;

COMMENT ON COLUMN public.stores.abonnement_jusqu_au IS
  'Echeance d un abonnement au mois. NULL = activation a vie ou essai : la boutique ne se verrouille jamais pour cette raison.';

ALTER TABLE public.access_codes
  ADD COLUMN IF NOT EXISTS duree_jours integer;

COMMENT ON COLUMN public.access_codes.duree_jours IS
  'Duree que le code accorde, en jours. NULL = a vie.';

ALTER TABLE public.stores
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '30 days');

CREATE OR REPLACE FUNCTION public.protect_store_activation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_activation_guard', true) = 'on' THEN
    RETURN NEW; -- Appel légitime depuis une RPC de confiance
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Toute nouvelle boutique créée directement par le client démarre
    -- TOUJOURS en essai standard, quoi que le client ait essayé d'envoyer.
    NEW.activation_status := 'trial';
    NEW.trial_ends_at := now() + interval '30 days';
    NEW.activated_at := NULL;
    NEW.abonnement_jusqu_au := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Toute tentative de modifier ces colonnes par un update() normal
    -- est silencieusement annulée (on garde les anciennes valeurs).
    NEW.activation_status := OLD.activation_status;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.activated_at := OLD.activated_at;
    NEW.abonnement_jusqu_au := OLD.abonnement_jusqu_au;
  END IF;

  RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.activate_store_with_code(p_store_id uuid, p_code text)
RETURNS public.stores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code record;
  v_store public.stores;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id FOR UPDATE;
  IF v_store.id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;
  IF v_store.owner_id <> v_uid AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé.';
  END IF;

  -- Une boutique a vie est deja reglee. Une boutique au mois, elle, se
  -- renouvelle : c est tout l interet de l offre.
  IF v_store.activation_status = 'active' AND v_store.abonnement_jusqu_au IS NULL THEN
    RAISE EXCEPTION 'Cette boutique est déjà active.';
  END IF;

  SELECT * INTO v_code
  FROM public.access_codes
  WHERE code = upper(trim(p_code))
    AND status = 'generated'
    AND (store_id IS NULL OR store_id = p_store_id)
  FOR UPDATE;

  IF v_code.id IS NULL THEN
    RAISE EXCEPTION 'Code invalide ou déjà utilisé.';
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'Ce code a expiré.';
  END IF;

  UPDATE public.access_codes
  SET status = 'used', user_id = v_uid, store_id = p_store_id, activated_at = now()
  WHERE id = v_code.id;

  PERFORM set_config('app.bypass_activation_guard', 'on', true);

  UPDATE public.stores
  SET activation_status = 'active',
      activated_at = coalesce(activated_at, now()),
      -- Un code sans duree vaut a vie. Un renouvellement anticipe
      -- s ajoute au reste du mois en cours plutot que de l effacer :
      -- payer en avance ne doit jamais faire perdre des jours.
      abonnement_jusqu_au = CASE
        WHEN v_code.duree_jours IS NULL THEN NULL
        ELSE greatest(now(), coalesce(abonnement_jusqu_au, now()))
             + (v_code.duree_jours || ' days')::interval
      END
  WHERE id = p_store_id
  RETURNING * INTO v_store;

  RETURN v_store;
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
    0, -- capital réinitialisé : une copie ne doit jamais hériter de la trésorerie
    v_source.seuil_alerte_tresorerie,
    v_source.address, v_source.phone, v_source.email, v_source.nif_stat, v_source.receipt_footer,
    v_source.activation_status,
    v_source.trial_ends_at,
    CASE WHEN v_source.activation_status = 'active' THEN now() ELSE NULL END,
    -- La copie hérite de la MÊME échéance, jamais d'un mois neuf : sans
    -- cela, copier une boutique au mois donnerait une boutique à vie.
    v_source.abonnement_jusqu_au
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$function$;
