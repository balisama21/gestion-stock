-- Retour arrière de M1 : définitions et droits d'avant le 01/10/2026.
BEGIN;

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

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

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

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

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

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_code(text) TO PUBLIC, anon, authenticated;

ALTER FUNCTION public.is_store_owner(uuid) RESET search_path;
ALTER FUNCTION public.is_platform_admin() RESET search_path;
ALTER FUNCTION public.handle_new_user() RESET search_path;

COMMIT;
