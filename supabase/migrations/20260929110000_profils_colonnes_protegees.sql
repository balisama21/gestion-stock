-- Profils : un utilisateur ne peut plus s'attribuer de droits lui-même.
--
-- La politique « Users can update own profile » autorise toute colonne
-- de sa propre ligne : is_platform_admin, role, status, store_id
-- compris. Ce trigger ferme ces quatre colonnes aux appels directs du
-- client, sans toucher aux politiques existantes.
--
-- Flux légitimes, tous préservés :
--   · handle_new_user, redeem_access_code, accept_invitation,
--     accept_invitation_by_code, ensure_owner_store, activer_le_compte :
--     SECURITY DEFINER, propriétaire postgres → current_user = postgres.
--   · fonctions edge (accept-invitation…) : clé service → service_role.
--   · client, useWorkspace : profiles.store_id = boutique ouverte, pour
--     une boutique dont on est propriétaire ou membre (livreur compris).
--
-- Additif : une fonction d'aide, une fonction de trigger, un trigger.

-- Appartenance à une boutique, tous rôles confondus (y compris livreur,
-- que is_store_member exclut volontairement).
CREATE OR REPLACE FUNCTION public.a_acces_a_la_boutique(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM store_members WHERE store_id = p_store_id AND user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.a_acces_a_la_boutique(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.a_acces_a_la_boutique(uuid) TO authenticated;

-- SECURITY INVOKER, volontairement : current_user doit refléter
-- l'appelant (authenticated depuis le client, postgres depuis une
-- fonction SECURITY DEFINER, service_role depuis une fonction edge).
CREATE OR REPLACE FUNCTION public.proteger_colonnes_de_profil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_platform_admin, false)
       OR NEW.role IS DISTINCT FROM 'pending'
       OR NEW.status IS DISTINCT FROM 'pending'
       OR NEW.store_id IS NOT NULL THEN
      RAISE EXCEPTION 'Un profil se crée en attente, sans droits.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Personne, pas même un administrateur depuis le client.
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'is_platform_admin ne se modifie pas depuis l''application.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Le rôle et le statut d''un compte ne se modifient pas directement.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.store_id IS DISTINCT FROM OLD.store_id
     AND NEW.store_id IS NOT NULL
     AND NOT public.a_acces_a_la_boutique(NEW.store_id) THEN
    RAISE EXCEPTION 'Boutique inaccessible pour ce compte.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- « profiles_00_… » : les triggers BEFORE s'exécutent par ordre
-- alphabétique ; celui-ci passe avant trg_ensure_owner_store, et ne
-- juge donc que ce que l'appelant a demandé, pas ce que ce dernier
-- complète ensuite.
DROP TRIGGER IF EXISTS profiles_00_proteger_colonnes ON public.profiles;
CREATE TRIGGER profiles_00_proteger_colonnes
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_colonnes_de_profil();
