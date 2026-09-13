-- Transmettre une boutique, et fermer la porte qui restait ouverte.
--
-- ── La faille trouvée en chemin ──
--
-- La politique « Members can update store » autorise la mise à jour de
-- `stores` à `is_store_member(id)`, c'est-à-dire à TOUT membre qui n'est
-- pas livreur. Rien n'y protégeait la colonne `owner_id` : un vendeur
-- pouvait donc se déclarer propriétaire de la boutique — et repartir
-- avec le commerce entier. Vérifié avant correctif, en transaction
-- annulée : le vol réussissait.
--
-- Le correctif ne touche pas la politique. La restreindre casserait les
-- réglages ordinaires de la boutique, que les responsables modifient
-- légitimement. Un déclencheur garde la seule colonne qui compte, et ne
-- se réveille que si `owner_id` change vraiment.
--
-- ── Le verrou et la porte ──
--
-- `garder_le_proprietaire()` est le VERROU : il refuse tout changement
-- de `owner_id` qui ne vient pas du propriétaire en place, quel que soit
-- le chemin emprunté. La règle vit dans la base, pas seulement dans
-- l'écran — un écran se contourne, un déclencheur non.
--
-- `transferer_boutique()` est la PORTE : elle vérifie l'appelant, exige
-- que le destinataire fasse déjà partie de l'équipe et ne soit pas
-- livreur, puis procède à l'échange.
--
-- L'ancien propriétaire reste dans l'équipe avec le rôle admin.
-- Transmettre sa boutique ne doit pas l'en éjecter dans la seconde ; le
-- nouveau propriétaire pourra l'en retirer délibérément s'il le veut.
--
-- Les permissions que l'ancien propriétaire conserve sont passées en
-- paramètre plutôt que recopiées ici : les gabarits de rôles vivent dans
-- src/lib/permissions.ts, et les dupliquer en SQL créerait une seconde
-- vérité qui finirait par diverger de la première.
--
-- ── Pourquoi cet écran devait exister ──
--
-- La migration précédente a mis `stores.owner_id` en RESTRICT : on ne
-- peut plus supprimer quelqu'un qui possède encore une boutique. C'est
-- la bonne protection, mais elle n'a de sens que si l'on dispose d'un
-- moyen de faire passer la boutique à quelqu'un d'autre. Sans cela, un
-- propriétaire qui s'en va bloquerait indéfiniment son propre compte.
--
-- ── Vérifié en transaction annulée, sur les données réelles ──
--
--   1 vol direct par un vendeur ................ REFUSÉ
--   2 vendeur s'attribuant la boutique ......... REFUSÉ
--   3 transfert hors de l'équipe ............... REFUSÉ
--   4 transfert à un livreur ................... REFUSÉ
--   5 transfert légitime à un membre ........... ACCEPTÉ
--
-- Après le transfert : le propriétaire a changé, l'ancien est devenu
-- membre admin, la ligne de membre du nouveau a été retirée, et les
-- 25 ventes sont toujours là.

CREATE OR REPLACE FUNCTION public.garder_le_proprietaire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  -- Les réglages ordinaires de la boutique ne regardent pas ce verrou.
  IF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
    RETURN NEW;
  END IF;

  -- Sans jeton (clé de service, migrations, outillage), ou pour
  -- l'administrateur de la plateforme qui doit pouvoir dépanner.
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Seul le proprietaire peut transmettre sa boutique.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role INTO v_role FROM store_members
   WHERE store_id = NEW.id AND user_id = NEW.owner_id;
  IF v_role IS NULL OR v_role = 'livreur' THEN
    RAISE EXCEPTION 'La boutique ne se transmet qu a un membre de l equipe qui n est pas livreur.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_garder_le_proprietaire ON public.stores;
CREATE TRIGGER trg_garder_le_proprietaire
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.garder_le_proprietaire();

CREATE OR REPLACE FUNCTION public.transferer_boutique(
  p_store_id uuid,
  p_nouveau_proprietaire uuid,
  p_permissions_ancien jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ancien uuid;
  v_role text;
BEGIN
  SELECT owner_id INTO v_ancien FROM stores WHERE id = p_store_id;
  IF v_ancien IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_ancien IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Seul le proprietaire de la boutique peut la transmettre.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_nouveau_proprietaire IS NOT DISTINCT FROM v_ancien THEN
    RAISE EXCEPTION 'Cette boutique vous appartient deja.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT role INTO v_role FROM store_members
   WHERE store_id = p_store_id AND user_id = p_nouveau_proprietaire;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Cette personne ne fait pas partie de l equipe de la boutique.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_role = 'livreur' THEN
    RAISE EXCEPTION 'Un livreur ne peut pas recevoir la boutique.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- L'ancien propriétaire reste dans l'équipe.
  INSERT INTO store_members (store_id, user_id, role, invited_by, permissions)
  VALUES (p_store_id, v_ancien, 'admin', p_nouveau_proprietaire,
          coalesce(p_permissions_ancien, '{}'::jsonb))
  ON CONFLICT (store_id, user_id)
  DO UPDATE SET role = 'admin', permissions = coalesce(p_permissions_ancien, '{}'::jsonb);

  UPDATE stores SET owner_id = p_nouveau_proprietaire WHERE id = p_store_id;

  -- Le nouveau propriétaire n'a plus à figurer parmi les membres.
  DELETE FROM store_members
   WHERE store_id = p_store_id AND user_id = p_nouveau_proprietaire;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.transferer_boutique(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferer_boutique(uuid, uuid, jsonb) TO authenticated;
