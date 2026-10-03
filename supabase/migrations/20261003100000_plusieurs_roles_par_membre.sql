-- Plusieurs rôles pour une même personne dans une boutique — étape 1 (base).
-- Analyse : docs/multi-roles/analyse.md
--
-- 1. store_members.roles (text[]) devient la vérité ; role reste tenu à jour
--    comme « rôle principal » (premier rôle autre que livreur) pour les
--    navigateurs encore sur l'ancienne version.
-- 2. is_store_member : membre du personnel = au moins un rôle autre que
--    livreur. Un livreur seul reste isolé comme avant.
-- 3. Accepter une invitation dans une boutique où l'on est déjà membre
--    AJOUTE le rôle et fusionne les permissions, au lieu de les remplacer.
--
-- transferer_boutique et garder_le_proprietaire lisent role = 'livreur' :
-- avec le rôle principal, cela reste vrai seulement pour un livreur seul.
--
-- Retour arrière : supabase/retours-arriere/20261003100000_plusieurs_roles_par_membre.sql

BEGIN;

ALTER TABLE public.store_members ADD COLUMN IF NOT EXISTS roles text[];

UPDATE public.store_members SET roles = ARRAY[role] WHERE roles IS NULL;

-- Premier rôle qui n'est pas livreur, sinon livreur.
CREATE OR REPLACE FUNCTION public.role_principal(p_roles text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT r FROM unnest(p_roles) WITH ORDINALITY AS t(r, i)
      WHERE r IS DISTINCT FROM 'livreur' ORDER BY i LIMIT 1),
    p_roles[1]
  );
$$;

-- Garde role et roles cohérents, quel que soit le code qui écrit.
CREATE OR REPLACE FUNCTION public.synchroniser_roles_membre()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.roles IS NULL OR cardinality(NEW.roles) = 0 THEN
      NEW.roles := ARRAY[NEW.role];
    ELSE
      NEW.role := public.role_principal(NEW.roles);
    END IF;
  ELSIF NEW.roles IS DISTINCT FROM OLD.roles THEN
    IF NEW.roles IS NULL OR cardinality(NEW.roles) = 0 THEN
      NEW.roles := ARRAY[NEW.role];
    ELSE
      NEW.role := public.role_principal(NEW.roles);
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Ancien code : il change le rôle unique, la liste suit.
    NEW.roles := ARRAY[NEW.role];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS synchroniser_roles_membre ON public.store_members;
CREATE TRIGGER synchroniser_roles_membre
  BEFORE INSERT OR UPDATE ON public.store_members
  FOR EACH ROW EXECUTE FUNCTION public.synchroniser_roles_membre();

-- Union de deux cartes de permissions : le rôle qui donne le plus l'emporte.
-- actions : absence = aucune ; fields / widgets : absence = tous.
CREATE OR REPLACE FUNCTION public.fusionner_permissions(a jsonb, b jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  k text;
  x jsonb;
  y jsonb;
  m jsonb;
  champ text;
  sx text;
  sy text;
BEGIN
  IF a IS NULL OR jsonb_typeof(a) <> 'object' OR a = '{}'::jsonb THEN
    RETURN coalesce(b, a);
  END IF;
  IF b IS NULL OR jsonb_typeof(b) <> 'object' OR b = '{}'::jsonb THEN
    RETURN a;
  END IF;

  FOR k IN SELECT jsonb_object_keys(a) UNION SELECT jsonb_object_keys(b) LOOP
    x := a -> k;
    y := b -> k;
    IF x IS NULL OR coalesce((x ->> 'visible')::boolean, false) = false THEN
      m := coalesce(y, x);
    ELSIF y IS NULL OR coalesce((y ->> 'visible')::boolean, false) = false THEN
      m := x;
    ELSE
      m := x || y;
      m := jsonb_set(m, '{visible}', 'true'::jsonb);

      IF jsonb_typeof(x -> 'actions') = 'array' OR jsonb_typeof(y -> 'actions') = 'array' THEN
        m := jsonb_set(m, '{actions}', (
          SELECT coalesce(jsonb_agg(DISTINCT e), '[]'::jsonb) FROM (
            SELECT jsonb_array_elements(CASE WHEN jsonb_typeof(x -> 'actions') = 'array' THEN x -> 'actions' ELSE '[]'::jsonb END) AS e
            UNION
            SELECT jsonb_array_elements(CASE WHEN jsonb_typeof(y -> 'actions') = 'array' THEN y -> 'actions' ELSE '[]'::jsonb END)
          ) s));
      END IF;

      FOREACH champ IN ARRAY ARRAY['fields', 'widgets'] LOOP
        IF jsonb_typeof(x -> champ) = 'array' AND jsonb_typeof(y -> champ) = 'array' THEN
          m := jsonb_set(m, ARRAY[champ], (
            SELECT coalesce(jsonb_agg(DISTINCT e), '[]'::jsonb) FROM (
              SELECT jsonb_array_elements(x -> champ) AS e
              UNION
              SELECT jsonb_array_elements(y -> champ)
            ) s));
        ELSE
          m := m - champ;
        END IF;
      END LOOP;

      sx := x ->> 'scope';
      sy := y ->> 'scope';
      IF 'all' IN (sx, sy) THEN
        m := jsonb_set(m, '{scope}', '"all"'::jsonb);
      ELSIF 'team' IN (sx, sy) THEN
        m := jsonb_set(m, '{scope}', '"team"'::jsonb);
      ELSIF 'own' IN (sx, sy) THEN
        m := jsonb_set(m, '{scope}', '"own"'::jsonb);
      END IF;
    END IF;
    r := r || jsonb_build_object(k, m);
  END LOOP;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_store_member(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
    UNION
    SELECT 1 FROM store_members
     WHERE store_id = p_store_id AND user_id = auth.uid()
       AND NOT (coalesce(roles, ARRAY[role]) <@ ARRAY['livreur'])
  );
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
  v_store_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_inv FROM public.collaborator_invitations WHERE token = p_token FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation introuvable.';
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

  INSERT INTO public.store_members (store_id, user_id, role, roles, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, ARRAY[v_inv.role], v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET roles = CASE
          WHEN EXCLUDED.role = ANY (coalesce(store_members.roles, ARRAY[store_members.role]))
            THEN coalesce(store_members.roles, ARRAY[store_members.role])
          ELSE coalesce(store_members.roles, ARRAY[store_members.role]) || EXCLUDED.role
        END,
        permissions = public.fusionner_permissions(store_members.permissions, EXCLUDED.permissions);

  UPDATE public.collaborator_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  UPDATE public.profiles
  SET status = 'activated',
      role = CASE WHEN role = 'pending' THEN 'seller'::public.user_role ELSE role END,
      store_id = COALESCE(store_id, v_inv.store_id)
  WHERE id = v_uid;

  SELECT name INTO v_store_name FROM public.stores WHERE id = v_inv.store_id;

  RETURN jsonb_build_object('store_id', v_inv.store_id, 'store_name', v_store_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
  v_store_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_inv FROM public.collaborator_invitations WHERE invite_code = upper(trim(p_code)) FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Code invalide.';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Ce code a déjà été utilisé ou annulé.';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Ce code a expiré.';
  END IF;
  IF lower(v_inv.invited_email) <> lower(coalesce(v_email, '')) THEN
    RAISE EXCEPTION 'Ce code ne correspond pas à votre e-mail.';
  END IF;

  INSERT INTO public.store_members (store_id, user_id, role, roles, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, ARRAY[v_inv.role], v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET roles = CASE
          WHEN EXCLUDED.role = ANY (coalesce(store_members.roles, ARRAY[store_members.role]))
            THEN coalesce(store_members.roles, ARRAY[store_members.role])
          ELSE coalesce(store_members.roles, ARRAY[store_members.role]) || EXCLUDED.role
        END,
        permissions = public.fusionner_permissions(store_members.permissions, EXCLUDED.permissions);

  UPDATE public.collaborator_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  UPDATE public.profiles
  SET status = 'activated',
      role = CASE WHEN role = 'pending' THEN 'seller'::public.user_role ELSE role END,
      store_id = COALESCE(store_id, v_inv.store_id)
  WHERE id = v_uid;

  SELECT name INTO v_store_name FROM public.stores WHERE id = v_inv.store_id;

  RETURN jsonb_build_object('store_id', v_inv.store_id, 'store_name', v_store_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rejoindre_invitation_sur_marque(p_invitation_id uuid, p_hote text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO store_members (store_id, user_id, role, roles, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, ARRAY[v_inv.role], v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET roles = CASE
          WHEN EXCLUDED.role = ANY (coalesce(store_members.roles, ARRAY[store_members.role]))
            THEN coalesce(store_members.roles, ARRAY[store_members.role])
          ELSE coalesce(store_members.roles, ARRAY[store_members.role]) || EXCLUDED.role
        END,
        permissions = public.fusionner_permissions(store_members.permissions, EXCLUDED.permissions);

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
$function$;

COMMIT;
