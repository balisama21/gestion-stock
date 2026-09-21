-- ═══════════════════════════════════════════════════════════════════
-- QUI PEUT RÉGLER LA PRÉALERTE, ET CE QUE LA BASE REFUSE
-- ═══════════════════════════════════════════════════════════════════
--
-- À coller dans l'éditeur SQL de Supabase. Tout se passe dans une
-- transaction ANNULÉE : rien n'est écrit, y compris les cas de succès.
--
-- Toutes les lignes doivent porter « ok ».
--
-- Les trois identifiants ci-dessous sont ceux de la base du 20/09/2026.
-- Pour les retrouver un autre jour :
--
--   SELECT s.id, s.name, s.owner_id, public.store_is_locked(s.id),
--          (SELECT m.user_id FROM public.store_members m
--            WHERE m.store_id = s.id AND m.role IS DISTINCT FROM 'livreur'
--            LIMIT 1) AS un_membre
--     FROM public.stores s;
--
-- ── Ce que ces dix cas établissent ──
--
--   1-2  Le propriétaire d'une boutique ouverte règle sa préalerte.
--   3    La date de modification est posée par le déclencheur, pas par
--        celui qui écrit — la valeur envoyée par le client est écrasée.
--   4-5  Un collaborateur LIT les réglages (son tableau de bord doit
--        peindre la préalerte comme celui du patron) mais ne les
--        modifie pas. Le refus est SILENCIEUX sur un UPDATE : la ligne
--        devient invisible et PostgREST répond « aucune ligne ».
--   6    Une boutique verrouillée ne se règle pas, comme les douze
--        tables refermées le 20/09. Le refus est ici une ERREUR 42501,
--        parce qu'il porte sur une création.
--   7-10 Les CHECK refusent ce qu'un JSON aurait laissé passer : un
--        mode inconnu, un écart nul qui poserait la préalerte sur le
--        seuil lui-même, une heure impossible, une fréquence inconnue.
--
--        Le choix du CANAL n'est plus ici : il a déménagé sur la
--        personne, le 21/09. Voir `verification-des-abonnements.sql`.

BEGIN;

CREATE TEMP TABLE preuve(n int, cas text, attendu text, obtenu text);

DO $preuve$
DECLARE
  v_ouverte  uuid := '43fc454f-ae66-48cd-af23-a46c0857a527'; -- Balsama DG, ouverte
  v_fermee   uuid := '820a8404-4bd5-446e-982c-eb918faaee84'; -- GAGB, verrouillee
  v_patron   uuid := '8d22f166-7409-4319-9ac1-8f468b16dc17'; -- proprietaire de Balsama DG
  v_equipier uuid := '859aba2d-87d7-4936-931f-17fffc50c4e3'; -- membre de Balsama DG
  n int;
  v_date timestamptz;
BEGIN
  --------------------------------------------------------------- 1 et 2
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_patron)::text);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.reglages_alertes_stock(store_id, prealerte_active, mode, ecart)
  VALUES (v_ouverte, true, 'ecart', 2);
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (1, 'le proprietaire cree ses reglages', '1 ligne', n || ' ligne');

  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.reglages_alertes_stock SET pourcentage = 40, mis_a_jour_le = '2000-01-01'
   WHERE store_id = v_ouverte;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (2, 'le proprietaire les modifie', '1 ligne', n || ' ligne');

  --------------------------------------------------------------- 3
  SELECT mis_a_jour_le INTO v_date FROM public.reglages_alertes_stock WHERE store_id = v_ouverte;
  INSERT INTO preuve VALUES (3, 'la date de modification ne se saisit pas', 'maintenant',
    CASE WHEN v_date > now() - interval '1 minute' THEN 'maintenant' ELSE v_date::text END);

  --------------------------------------------------------------- 4 et 5
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_equipier)::text);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO n FROM public.reglages_alertes_stock WHERE store_id = v_ouverte;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (4, 'un collaborateur les lit', '1 ligne', n || ' ligne');

  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.reglages_alertes_stock SET ecart = 9 WHERE store_id = v_ouverte;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (5, 'un collaborateur les modifie', '0 ligne', n || ' ligne');

  --------------------------------------------------------------- 6
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.reglages_alertes_stock(store_id, prealerte_active) VALUES (v_fermee, true);
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (6, 'boutique verrouillee : le proprietaire cree', 'refus 42501', 'ACCEPTE');
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (6, 'boutique verrouillee : le proprietaire cree', 'refus 42501', 'refus 42501');
  END;

  --------------------------------------------------------------- 7 a 10
  BEGIN
    INSERT INTO public.reglages_alertes_stock(store_id, mode) VALUES (v_fermee, 'peu_importe');
    INSERT INTO preuve VALUES (7, 'un mode inconnu', 'refuse', 'ACCEPTE');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO preuve VALUES (7, 'un mode inconnu', 'refuse', 'refuse');
  END;

  BEGIN
    INSERT INTO public.reglages_alertes_stock(store_id, ecart) VALUES (v_fermee, 0);
    INSERT INTO preuve VALUES (8, 'un ecart a zero', 'refuse', 'ACCEPTE');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO preuve VALUES (8, 'un ecart a zero', 'refuse', 'refuse');
  END;

  BEGIN
    INSERT INTO public.reglages_alertes_stock(store_id, heure_resume) VALUES (v_fermee, 99);
    INSERT INTO preuve VALUES (9, 'une heure impossible', 'refuse', 'ACCEPTE');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO preuve VALUES (9, 'une heure impossible', 'refuse', 'refuse');
  END;

  BEGIN
    INSERT INTO public.reglages_alertes_stock(store_id, frequence) VALUES (v_fermee, 'parfois');
    INSERT INTO preuve VALUES (10, 'une frequence inconnue', 'refuse', 'ACCEPTE');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO preuve VALUES (10, 'une frequence inconnue', 'refuse', 'refuse');
  END;
END
$preuve$;

SELECT n, cas, attendu, obtenu,
       CASE WHEN attendu = obtenu THEN 'ok' ELSE '>>> ECHEC' END AS verdict
FROM preuve ORDER BY n;

-- Et le contrôle de non-régression du verrou, qui doit rendre ZÉRO ligne.
SELECT * FROM public.policies_sans_verrou();

ROLLBACK;
