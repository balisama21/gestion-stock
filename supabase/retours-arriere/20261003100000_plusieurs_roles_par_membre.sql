-- Retour arrière de « plusieurs rôles par membre » : définitions d'avant le 03/10/2026.
-- Une personne qui avait plusieurs rôles garde seulement son rôle principal (colonne role).
BEGIN;

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
       AND role IS DISTINCT FROM 'livreur'
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

  INSERT INTO public.store_members (store_id, user_id, role, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;

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

  INSERT INTO public.store_members (store_id, user_id, role, invited_by, permissions)
  VALUES (v_inv.store_id, v_uid, v_inv.role, v_inv.invited_by, v_inv.permissions)
  ON CONFLICT (store_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;

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
$function$;

DROP TRIGGER IF EXISTS synchroniser_roles_membre ON public.store_members;
DROP FUNCTION IF EXISTS public.synchroniser_roles_membre();
DROP FUNCTION IF EXISTS public.fusionner_permissions(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.role_principal(text[]);
ALTER TABLE public.store_members DROP COLUMN IF EXISTS roles;

COMMIT;
