-- ═══════════════════════════════════════════════════════════════════
-- LA PRÉALERTE DE STOCK — 3. LE RÉSUMÉ QUOTIDIEN, ET L'E-MAIL
-- ═══════════════════════════════════════════════════════════════════
--
-- ── Pourquoi il faut un travail périodique ──
--
-- Le déclencheur de la migration précédente pose les lignes au moment
-- même où le stock bouge, application ouverte ou non. Mais deux choses
-- ne peuvent pas se faire là :
--
--   — LIBÉRER LE RÉSUMÉ QUOTIDIEN. Une préalerte franchie à sept heures
--     doit attendre l'heure choisie par le commerçant. Personne n'est
--     là pour la libérer à ce moment-là.
--   — ENVOYER L'E-MAIL. Postgres ne parle pas SMTP.
--
-- D'où `pg_cron`, qui réveille la base toutes les heures, et `pg_net`,
-- qui lui permet d'appeler la fonction Edge chargée de l'envoi — celle
-- qui détient la clé Resend, comme `send-invitation` avant elle.
--
-- ── Deux robinets, et une seule mécanique ──
--
-- `notifiee_le` : la préalerte est SORTIE. C'est ce que lit la cloche.
-- Posée tout de suite par le déclencheur en mode « à chaque mouvement »,
-- posée ici en mode « résumé quotidien ».
--
-- `email_le` : elle est PARTIE par e-mail. Posée par la fonction Edge
-- une fois l'envoi accepté, jamais avant — un envoi raté doit pouvoir
-- être retenté à l'heure suivante.
--
-- Conséquence, et elle est voulue : en mode « à chaque mouvement », la
-- cloche est immédiate et l'e-mail part dans l'heure, groupé. Envoyer
-- un e-mail par vente serait exactement le bruit que la fonction est
-- censée éviter.
--
-- ── ROBUSTE À UN RÉVEIL MANQUÉ ──
--
-- On ne compare pas l'heure courante à l'heure choisie — un réveil
-- sauté ferait alors perdre le résumé du jour. On libère tout ce qui a
-- été franchi AVANT le dernier passage dû de l'heure choisie, ce qui
-- rattrape de lui-même le retard sans jamais libérer en avance.
--
-- ── Le fuseau ──
--
-- `Indian/Antananarivo`, UTC+3, sans heure d'été. Écrit une fois dans
-- `public.fuseau_des_boutiques()` plutôt que recopié : le jour où un
-- client sortira de Madagascar, il n'y aura qu'une colonne à ajouter et
-- un appel à changer.

-- ───────────────────────────────────────────────────────────────────
-- 1. Ce qui est déjà parti par e-mail
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE public.prealertes_stock
  ADD COLUMN IF NOT EXISTS email_le timestamptz;

COMMENT ON COLUMN public.prealertes_stock.email_le IS
  'Date d envoi de l e-mail. Posee par la fonction Edge apres acceptation par Resend : un envoi rate se retente a l heure suivante.';

DROP VIEW IF EXISTS public.prealertes_a_annoncer;
CREATE VIEW public.prealertes_a_annoncer
WITH (security_invoker = true) AS
  SELECT
    a.product_id,
    a.store_id,
    a.niveau,
    a.franchie_le,
    a.notifiee_le,
    a.email_le,
    p.display_name AS produit,
    p.numero,
    p.stock_actuel,
    p.seuil_alerte,
    p.unite
  FROM public.prealertes_stock a
  JOIN public.products p ON p.id = a.product_id
  WHERE a.origine = 'franchissement'
    AND p.stock_actuel > p.seuil_alerte
    AND p.stock_actuel <= a.niveau;

COMMENT ON VIEW public.prealertes_a_annoncer IS
  'Les produits dans la bande orange dont le franchissement est reel. security_invoker : la RLS de prealertes_stock et de products s applique au lecteur.';

-- ───────────────────────────────────────────────────────────────────
-- 2. Le fuseau, écrit une seule fois
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fuseau_des_boutiques()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$ SELECT 'Indian/Antananarivo'::text; $function$;

COMMENT ON FUNCTION public.fuseau_des_boutiques() IS
  'UTC+3, sans heure d ete. Le jour ou un client en sortira, une colonne sur stores et un appel a changer.';

-- ───────────────────────────────────────────────────────────────────
-- 3. LIBÉRER LES RÉSUMÉS DUS
-- ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.liberer_les_prealertes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fuseau text := public.fuseau_des_boutiques();
  v_liberees integer;
BEGIN
  WITH maintenant AS (
    SELECT (now() AT TIME ZONE v_fuseau) AS local
  ),
  -- Le dernier passage DÛ de l'heure choisie : aujourd'hui si elle est
  -- déjà passée, hier sinon.
  echeances AS (
    SELECT r.store_id,
           CASE
             WHEN m.local >= date_trunc('day', m.local) + make_interval(hours => r.heure_resume)
               THEN date_trunc('day', m.local) + make_interval(hours => r.heure_resume)
             ELSE date_trunc('day', m.local) + make_interval(hours => r.heure_resume)
                  - interval '1 day'
           END AS dernier_resume
      FROM public.reglages_alertes_stock r
      CROSS JOIN maintenant m
     WHERE r.prealerte_active
       AND r.frequence = 'quotidien'
  ),
  liberees AS (
    UPDATE public.prealertes_stock a
       SET notifiee_le = now()
      FROM echeances e
     WHERE a.store_id = e.store_id
       AND a.origine = 'franchissement'
       AND a.notifiee_le IS NULL
       AND (a.franchie_le AT TIME ZONE v_fuseau) <= e.dernier_resume
    RETURNING a.product_id
  )
  SELECT count(*) INTO v_liberees FROM liberees;

  RETURN v_liberees;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.liberer_les_prealertes()
  FROM PUBLIC, anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- 4. DEMANDER L'ENVOI DES E-MAILS
-- ───────────────────────────────────────────────────────────────────
--
-- Une requête HTTP par boutique concernée, et rien de plus : la
-- composition du message, la clé Resend et le marquage de `email_le`
-- appartiennent à la fonction Edge. Postgres se contente de dire « il y
-- a quelque chose à envoyer pour cette boutique ».
--
-- L'adresse et le jeton d'appel viennent du coffre (`vault`) et non du
-- corps de cette fonction : une migration se lit dans un dépôt, une clé
-- n'a rien à y faire — même une clé publique par destination.
--
-- `net.http_post` est ASYNCHRONE : il met la requête en file et rend
-- tout de suite. Le travail horaire ne reste donc jamais suspendu à un
-- service tiers.

CREATE OR REPLACE FUNCTION public.demander_les_resumes_par_email()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url    text;
  v_jeton  text;
  v_appli  text;
  v_store  uuid;
  v_appels integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'prealerte_fonction_url';
  SELECT decrypted_secret INTO v_jeton
    FROM vault.decrypted_secrets WHERE name = 'prealerte_cle_appel';
  -- Facultative : sans elle, l'e-mail part sans son bouton de retour
  -- vers l'application plutôt que de ne pas partir.
  SELECT decrypted_secret INTO v_appli
    FROM vault.decrypted_secrets WHERE name = 'prealerte_adresse_application';

  IF v_url IS NULL OR v_jeton IS NULL THEN
    RAISE WARNING 'Prealerte : adresse ou jeton absent du coffre, aucun e-mail demande.';
    RETURN 0;
  END IF;

  FOR v_store IN
    SELECT DISTINCT a.store_id
      FROM public.prealertes_a_annoncer a
      JOIN public.reglages_alertes_stock r ON r.store_id = a.store_id
     WHERE a.notifiee_le IS NOT NULL
       AND a.email_le IS NULL
       AND r.prealerte_active
       AND 'email' = ANY (r.canaux)
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_jeton
                 ),
      body    := jsonb_build_object('store_id', v_store, 'app_url', v_appli)
    );
    v_appels := v_appels + 1;
  END LOOP;

  RETURN v_appels;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.demander_les_resumes_par_email()
  FROM PUBLIC, anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────
-- 5. LE RÉVEIL HORAIRE
-- ───────────────────────────────────────────────────────────────────
--
-- Toutes les heures à la minute zéro. Une heure suffit : le réglage le
-- plus fin qu'un commerçant puisse choisir est l'heure de son résumé.
--
-- L'e-mail est demandé APRÈS la libération, dans le même passage, pour
-- que ce qui vient d'être libéré parte le jour même.

CREATE OR REPLACE FUNCTION public.traiter_les_prealertes()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_liberees integer;
  v_appels   integer;
BEGIN
  v_liberees := public.liberer_les_prealertes();
  v_appels   := public.demander_les_resumes_par_email();
  RETURN v_liberees || ' prealertes liberees, ' || v_appels || ' e-mails demandes';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.traiter_les_prealertes()
  FROM PUBLIC, anon, authenticated, service_role;

-- Reprogrammer sans doublon : `cron.schedule` remplace la tâche qui
-- porte déjà ce nom.
SELECT cron.schedule(
  'prealertes-de-stock',
  '0 * * * *',
  $cron$ SELECT public.traiter_les_prealertes(); $cron$
);
