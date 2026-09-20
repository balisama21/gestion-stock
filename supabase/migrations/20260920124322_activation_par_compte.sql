-- ═══════════════════════════════════════════════════════════════════
-- L'ACTIVATION APPARTIENT AU COMPTE, LA BOUTIQUE SUIT SON PROPRIÉTAIRE
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Ce qui ne marchait pas ──
--
-- L'activation n'existait qu'au niveau de la BOUTIQUE
-- (`stores.activation_status`). Il n'y avait donc rien à hériter : un
-- compte déjà réglé qui ouvrait une deuxième boutique se voyait
-- redemander une clé, parce que `protect_store_activation_fields()`
-- écrasait tout `INSERT` avec un essai neuf de trente jours.
--
-- Une colonne ressemblait pourtant à ce qu'on cherchait, et c'est un
-- piège : `profiles.status = 'activated'` ne dit RIEN du paiement.
-- `accept_invitation_by_code()` la pose sur tout invité. S'en servir
-- aurait offert l'activation à vie à chaque collaborateur invité.
--
-- ── La règle, en une phrase ──
--
-- L'activation est une propriété du COMPTE ; une boutique prend l'état
-- de son propriétaire. Les cinq règles en découlent, dont deux
-- gratuitement : un invité lit la boutique de son hôte parce que la
-- serrure de cette boutique dépend de SON propriétaire (règle 3), et
-- les boutiques de l'invité dépendent du compte de l'invité (règle 4).
--
-- ── Pourquoi `store_is_locked()` n'est pas touchée ──
--
-- Elle est lue par les RLS ET recopiée à l'identique côté client
-- (BalsamaApp.tsx). La correction porte donc sur ce qu'on ÉCRIT dans
-- `stores`, jamais sur la façon dont on le lit : les deux calculs ne
-- peuvent pas se mettre à diverger, et l'application n'a pas une ligne
-- à changer.
--
-- ── Deux choix tranchés par le client le 20/09/2026 ──
--
--   1. L'abonnement au mois est un droit de COMPTE, comme l'activation
--      à vie : un mois payé ouvre toutes les boutiques du compte, et
--      l'échéance les verrouille ensemble.
--   2. « Mode gratuit » = l'essai de trente jours. Une nouvelle
--      boutique reprend la date de fin de l'essai en cours au lieu
--      d'en ouvrir un neuf — ce qui ferme au passage la porte du
--      renouvellement d'essai à volonté (une boutique de plus = un
--      mois de plus, aujourd'hui).
--
--      CONSÉQUENCE ASSUMÉE : un compte dont l'essai est terminé crée
--      une boutique déjà verrouillée. C'est voulu.

-- ───────────────────────────────────────────────────────────────────
-- 1. Où vit l'activation d'un compte
-- ───────────────────────────────────────────────────────────────────
--
-- Une table à part plutôt qu'une colonne sur `profiles` : la policy
-- « Store teammates can view each other profiles » rend le profil
-- lisible par toute l'équipe, et l'état de facturation du patron n'a
-- pas à y être.

CREATE TABLE IF NOT EXISTS public.activations_de_compte (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  active_le timestamptz NOT NULL DEFAULT now(),
  abonnement_jusqu_au timestamptz,
  mis_a_jour_le timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activations_de_compte IS
  'Activation payante d un COMPTE. Toutes les boutiques du compte en heritent : voir protect_store_activation_fields() et activer_le_compte().';
COMMENT ON COLUMN public.activations_de_compte.abonnement_jusqu_au IS
  'Echeance de l abonnement au mois. NULL = a vie : le compte ne se verrouille jamais pour cette raison.';

ALTER TABLE public.activations_de_compte ENABLE ROW LEVEL SECURITY;

-- Lecture seule, et seulement la sienne. Aucune policy d'écriture :
-- cette table n'est écrite que par les fonctions SECURITY DEFINER
-- ci-dessous, sans quoi n'importe qui s'activerait d'un `insert()`.
DROP POLICY IF EXISTS "Chacun lit sa propre activation" ON public.activations_de_compte;
CREATE POLICY "Chacun lit sa propre activation"
  ON public.activations_de_compte FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR public.is_platform_admin());

-- ───────────────────────────────────────────────────────────────────
-- 2. Ce compte est-il en règle ?
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compte_est_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.activations_de_compte a
    WHERE a.user_id = p_user_id
      AND (a.abonnement_jusqu_au IS NULL OR a.abonnement_jusqu_au > now())
  );
$function$;

-- ───────────────────────────────────────────────────────────────────
-- 3. Activer un compte — et propager à toutes ses boutiques
-- ───────────────────────────────────────────────────────────────────
--
-- Le seul endroit qui écrit l'activation. Les deux RPC publiques
-- (`activate_store_with_code`, `redeem_access_code`) passent par lui.

CREATE OR REPLACE FUNCTION public.activer_le_compte(p_user_id uuid, p_duree_jours integer)
RETURNS public.activations_de_compte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ligne public.activations_de_compte;
BEGIN
  -- Un renouvellement anticipé s'AJOUTE au reste du mois en cours
  -- plutôt que de l'effacer : payer en avance ne doit jamais faire
  -- perdre des jours. Un compte déjà à vie le reste, quoi qu'on lui
  -- applique ensuite.
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

  -- La boutique suit son propriétaire : toutes, d'un coup. C'est ce qui
  -- rattrape les boutiques ouvertes AVANT le paiement.
  PERFORM set_config('app.bypass_activation_guard', 'on', true);

  UPDATE public.stores
  SET activation_status = 'active',
      activated_at = coalesce(activated_at, v_ligne.active_le),
      abonnement_jusqu_au = v_ligne.abonnement_jusqu_au
  WHERE owner_id = p_user_id;

  RETURN v_ligne;
END;
$function$;

-- Personne ne l'appelle depuis le navigateur : sans ce REVOKE,
-- n'importe quel compte s'activerait lui-même par un simple rpc().
REVOKE ALL ON FUNCTION public.activer_le_compte(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.activer_le_compte(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.activer_le_compte(uuid, integer) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.compte_est_active(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 4. Le déclencheur HÉRITE, au lieu d'imposer un essai neuf
-- ───────────────────────────────────────────────────────────────────

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
    RETURN NEW; -- Appel légitime depuis une RPC de confiance
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_compte
    FROM public.activations_de_compte
    WHERE user_id = NEW.owner_id;

    IF v_compte.user_id IS NOT NULL
       AND (v_compte.abonnement_jusqu_au IS NULL OR v_compte.abonnement_jusqu_au > now())
    THEN
      -- RÈGLES 1 ET 2 — le compte est réglé : la boutique naît ouverte,
      -- aux mêmes conditions que le compte. Aucune clé demandée.
      NEW.activation_status := 'active';
      NEW.activated_at := now();
      NEW.abonnement_jusqu_au := v_compte.abonnement_jusqu_au;
      -- Inerte quand le statut est 'active' (voir store_is_locked),
      -- mais la colonne est NOT NULL : on lui donne une valeur franche
      -- plutôt que de laisser passer ce que le client a envoyé.
      NEW.trial_ends_at := now() + interval '30 days';
    ELSE
      -- RÈGLES 4 ET 5 — pas de compte réglé : essai. La date de fin est
      -- celle de l'essai DÉJÀ EN COURS sur ce compte, et non trente
      -- jours neufs, sans quoi une boutique de plus vaudrait un mois de
      -- plus. Un compte sans aucune boutique démarre le sien.
      SELECT min(trial_ends_at) INTO v_fin_essai
      FROM public.stores
      WHERE owner_id = NEW.owner_id;

      NEW.activation_status := 'trial';
      NEW.trial_ends_at := coalesce(v_fin_essai, now() + interval '30 days');
      NEW.activated_at := NULL;
      NEW.abonnement_jusqu_au := NULL;
    END IF;
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

-- ───────────────────────────────────────────────────────────────────
-- 5. Le code d'activation règle le COMPTE, plus une boutique seule
-- ───────────────────────────────────────────────────────────────────
--
-- Signature inchangée : l'écran de déverrouillage n'a rien à modifier.

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

  -- La question n'est plus « cette boutique est-elle déjà active ? »
  -- mais « ce COMPTE est-il déjà réglé à vie ? ». Un compte au mois,
  -- lui, se renouvelle : c'est tout l'intérêt de l'offre.
  IF EXISTS (
    SELECT 1 FROM public.activations_de_compte a
    WHERE a.user_id = v_store.owner_id AND a.abonnement_jusqu_au IS NULL
  ) THEN
    RAISE EXCEPTION 'Ce compte est déjà activé à vie.';
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

  -- Le compte du PROPRIÉTAIRE, pas celui de l'appelant : un
  -- administrateur de la plateforme peut débloquer pour son client.
  PERFORM public.activer_le_compte(v_store.owner_id, v_code.duree_jours);

  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id;
  RETURN v_store;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────
-- 6. L'ancien parcours d'activation, remis d'accord avec le nouveau
-- ───────────────────────────────────────────────────────────────────
--
-- `redeem_access_code` (écran de connexion) activait le COMPTE au sens
-- `profiles.status` mais laissait la boutique en essai : le compte était
-- marqué « activated » et restait verrouillé. Incohérence antérieure,
-- corrigée ici en passant par le même geste que l'autre parcours.

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

  -- Boutique propre au compte
  SELECT id INTO v_store_id FROM stores WHERE owner_id = v_user ORDER BY created_at LIMIT 1;

  IF v_store_id IS NULL THEN
    INSERT INTO stores (name, owner_id)
    VALUES (COALESCE(NULLIF(btrim(p_store_name), ''), 'Boutique de ' || COALESCE(v_email, 'nouveau compte')), v_user)
    RETURNING id INTO v_store_id;
  END IF;

  -- `status`/`role` disent que le compte est INSTALLÉ, pas qu'il a payé.
  -- Les deux notions cohabitent : la seconde vit dans
  -- `activations_de_compte`, posée juste après.
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
