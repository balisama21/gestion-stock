-- ═══════════════════════════════════════════════════════════════════
-- LA PRÉALERTE DE STOCK — REFERMER SES FONCTIONS
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Ce qui n'allait pas ──
--
-- Les migrations précédentes écrivaient `REVOKE EXECUTE … FROM PUBLIC`
-- en croyant fermer la porte. Elle restait ouverte : Supabase pose des
-- DEFAULT PRIVILEGES qui accordent EXECUTE à `anon` et `authenticated`
-- NOMMÉMENT, sur chaque fonction créée dans `public`. Retirer le droit
-- de PUBLIC ne retire pas un droit accordé à un rôle précis.
--
-- Vérifié après coup sur la base : les dix fonctions portaient bien
-- `anon=X` et `authenticated=X`.
--
-- ── Pourquoi c'est grave ici, et pas partout ──
--
-- La plupart des fonctions SECURITY DEFINER de ce projet vérifient
-- elles-mêmes qui appelle, par `auth.uid()`. Appelée par un inconnu,
-- une telle fonction ne rend rien.
--
-- Trois des nouvelles ne le font pas, et ne peuvent pas le faire :
--
--   `resynchroniser_prealertes(store_id)` prend une boutique EN
--   PARAMÈTRE. N'importe quel utilisateur connecté pouvait donc
--   resynchroniser la boutique d'un autre, c'est-à-dire faire taire
--   ses préalertes en attente.
--
--   `liberer_les_prealertes()` et `demander_les_resumes_par_email()`
--   travaillent sur TOUTES les boutiques : elles appartiennent au
--   réveil horaire, pas à un utilisateur. La seconde déclenche des
--   envois d'e-mails.
--
-- Elles n'ont pas de garde interne parce qu'elles n'en ont pas besoin :
-- elles ne doivent tout simplement être appelables par personne. C'est
-- donc le droit qu'on retire, et non une vérification qu'on ajoute —
-- la surface la plus sûre est celle qui n'existe pas.
--
-- ── Et le `search_path` ──
--
-- Trois fonctions n'en avaient pas. Aucune ne lit de table, donc rien
-- n'était exploitable, mais une fonction sans `search_path` fixe est
-- une invitation à le devenir le jour où on y ajoute une requête.

-- ───────────────────────────────────────────────────────────────────
-- 1. Ce que personne ne doit pouvoir appeler
-- ───────────────────────────────────────────────────────────────────
--
-- Le réveil horaire tourne en `postgres` et les déclencheurs en
-- SECURITY DEFINER : aucun des deux ne passe par ces droits.

REVOKE EXECUTE ON FUNCTION public.niveau_surveille(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.resynchroniser_prealertes(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.liberer_les_prealertes()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.demander_les_resumes_par_email()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.traiter_les_prealertes()
  FROM PUBLIC, anon, authenticated, service_role;

-- Les fonctions de déclencheur. Les appeler hors déclencheur échoue de
-- toute façon, mais une porte fermée vaut mieux qu'une porte inutile.
REVOKE EXECUTE ON FUNCTION public.controler_prealerte_stock()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reglages_alertes_stock_resynchroniser()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toucher_mis_a_jour_le()
  FROM PUBLIC, anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- 2. Ce qui reste ouvert, et à qui
-- ───────────────────────────────────────────────────────────────────
--
-- `niveau_de_prealerte` est de l'arithmétique pure : aucune table, pas
-- de SECURITY DEFINER. Elle reste à portée des utilisateurs connectés,
-- qui pourraient de toute façon refaire l'addition. Pas d'`anon` pour
-- autant : rien de ce produit ne se consulte sans compte.

REVOKE EXECUTE ON FUNCTION public.niveau_de_prealerte(integer, text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.niveau_de_prealerte(integer, text, integer, integer)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fuseau_des_boutiques() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fuseau_des_boutiques() TO authenticated;

-- ───────────────────────────────────────────────────────────────────
-- 3. Le search_path des trois qui n'en avaient pas
-- ───────────────────────────────────────────────────────────────────

ALTER FUNCTION public.niveau_de_prealerte(integer, text, integer, integer)
  SET search_path TO 'public';
ALTER FUNCTION public.fuseau_des_boutiques() SET search_path TO 'public';
ALTER FUNCTION public.toucher_mis_a_jour_le() SET search_path TO 'public';

-- ───────────────────────────────────────────────────────────────────
-- 4. Le contrôle, à rejouer
-- ───────────────────────────────────────────────────────────────────
--
-- Doit rendre ZÉRO ligne. Sur le modèle de `policies_sans_verrou()`,
-- posé le 20/09 : une règle qu'on rétablit à la main se re-perd, une
-- règle qu'on peut interroger se tient.

CREATE OR REPLACE FUNCTION public.fonctions_de_prealerte_ouvertes()
RETURNS TABLE(fonction text, droits text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p.proname::text, array_to_string(p.proacl, ' | ')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('niveau_surveille', 'resynchroniser_prealertes',
                       'liberer_les_prealertes', 'demander_les_resumes_par_email',
                       'traiter_les_prealertes', 'controler_prealerte_stock',
                       'reglages_alertes_stock_resynchroniser', 'toucher_mis_a_jour_le')
     AND (p.proacl IS NULL
          OR array_to_string(p.proacl, ',') ~ '(anon|authenticated|service_role)=X|^=X|,=X')
   ORDER BY 1;
$function$;

COMMENT ON FUNCTION public.fonctions_de_prealerte_ouvertes() IS
  'Doit rendre zero ligne. Les fonctions internes de la prealerte ne sont appelables ni par anon, ni par un utilisateur connecte.';

REVOKE EXECUTE ON FUNCTION public.fonctions_de_prealerte_ouvertes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fonctions_de_prealerte_ouvertes() TO authenticated;
