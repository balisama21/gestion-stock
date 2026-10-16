-- Sécurité : les fonctions SECURITY DEFINER ne sont plus exécutables
-- par un visiteur non connecté (rôle anon).
--
-- Constat (conseiller Supabase, 16/10/2026) : 77 fonctions SECURITY
-- DEFINER de public étaient appelables par anon via /rest/v1/rpc/…
-- (droit EXECUTE accordé par défaut à PUBLIC). Elles vérifient presque
-- toutes auth.uid() en interne, mais rien ne justifie qu'un visiteur
-- anonyme puisse les déclencher (ex. compte_est_active, next_store_counter).
--
-- Règle appliquée, fonction par fonction :
--   1. si authenticated pouvait l'exécuter, on le lui accorde
--      EXPLICITEMENT (il ne dépend plus de PUBLIC) — rien ne change
--      pour les utilisateurs connectés ;
--   2. idem pour service_role (fonctions edge) ;
--   3. on retire EXECUTE à PUBLIC et à anon.
--
-- Exceptions conservées pour anon :
--   - get_public_branding / normaliser_hote : marque blanche avant connexion ;
--   - les prédicats appelés dans des politiques RLS (is_store_member, …) :
--     ils rendent false pour anon ; les retirer ferait échouer une requête
--     anonyme sur « permission denied » au lieu d'un résultat vide.
--
-- Les fonctions déclencheurs ne sont pas concernées par EXECUTE au moment
-- où le trigger se déclenche : les retirer à anon ne change rien à leur
-- fonctionnement.
--
-- Retour arrière : supabase/retours-arriere/20261016100000_securite_fonctions_definer_hors_anon.sql

DO $$
DECLARE
  f record;
  politiques text;
BEGIN
  SELECT string_agg(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''), ' ')
    INTO politiques
    FROM pg_policies;

  FOR f IN
    SELECT p.oid, p.oid::regprocedure AS signature, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
       AND p.proname NOT IN ('get_public_branding', 'normaliser_hote')
  LOOP
    IF COALESCE(politiques, '') ~ ('\m' || f.proname || '\M') THEN
      CONTINUE;
    END IF;

    IF has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END LOOP;
END
$$;

-- ─── search_path figé sur les fonctions signalées « mutable » ────────
-- « extensions » reste dans le chemin : generate_access_code s'appuie
-- sur pgcrypto (gen_random_bytes), installé dans ce schéma.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'update_updated_at', 'generate_access_code', 'get_auth_role',
         'check_payment_does_not_exceed_balance', 'update_order_payment_status',
         'can_modify_in_store', 'store_allows_write', '_module_metadata',
         '_legacy_array_to_permissions', 'storage_boutique_du_chemin',
         'categories_deux_niveaux'
       )
       AND NOT EXISTS (
         SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%'
       )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.signature);
  END LOOP;
END
$$;
