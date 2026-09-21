-- ═══════════════════════════════════════════════════════════════════
-- CHACUN RÈGLE SON PROPRE E-MAIL, ET PERSONNE D'AUTRE
-- ═══════════════════════════════════════════════════════════════════
--
-- À coller dans l'éditeur SQL de Supabase. Transaction ANNULÉE.
-- Toutes les lignes doivent porter « ok ».
--
-- ── Ce que ces huit cas établissent ──
--
--   1  Un collaborateur — pas seulement le propriétaire — s'abonne.
--   2  Mais pour LUI SEUL : abonner un collègue est refusé.
--   3  Et personne ne lit l'abonnement d'un autre, pas même le
--      propriétaire. Recevoir un e-mail ne regarde que celui qui le
--      reçoit.
--   4  Une boutique verrouillée ne prend pas de nouvel abonné.
--   5  Chacun relit bien le sien.
--   6  SE DÉSABONNER RESTE POSSIBLE, verrou ou pas. Retenir quelqu'un
--      dans une liste de diffusion parce que la boutique n'est plus
--      payée serait un piège — l'exception est déclarée dans
--      `policies_sans_verrou()`, pas maquillée.
--   7  Sans abonné, aucun e-mail n'est demandé : c'est le défaut, et
--      il vaut pour tout le monde.
--   8  Le contrôle du verrou rend toujours zéro ligne.
--
-- ── UN PIÈGE DE PLPGSQL, RENCONTRÉ EN ÉCRIVANT CECI ──
--
-- Un bloc `BEGIN … EXCEPTION` pose un point de sauvegarde, et y
-- revenir DÉFAIT AUSSI les `SET LOCAL` faits à l'intérieur. Après un
-- cas qui attend un refus, l'identité de l'appelant est donc celle
-- d'avant le bloc. Les cas 5 et 6 reposent leurs claims pour cette
-- raison ; sans cela, ils s'exécutaient sous une autre identité et
-- « se désabonner » supprimait zéro ligne — un faux échec qui ne
-- disait rien du code.

BEGIN;
CREATE TEMP TABLE preuve(n int, cas text, attendu text, obtenu text);

DO $preuve$
DECLARE
  v_ouverte  uuid := '43fc454f-ae66-48cd-af23-a46c0857a527'; -- Balsama DG, ouverte
  v_fermee   uuid := '820a8404-4bd5-446e-982c-eb918faaee84'; -- GAGB, verrouillee
  v_patron   uuid := '8d22f166-7409-4319-9ac1-8f468b16dc17'; -- proprietaire de Balsama DG
  v_equipier uuid := '859aba2d-87d7-4936-931f-17fffc50c4e3'; -- membre de Balsama DG
  n int;
BEGIN
  --------------------------------------------------------------- 1
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_equipier)::text);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.abonnements_alertes_stock(store_id, user_id) VALUES (v_ouverte, v_equipier);
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (1, 'un collaborateur s abonne lui-meme', '1 ligne', n || ' ligne');

  --------------------------------------------------------------- 2
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.abonnements_alertes_stock(store_id, user_id) VALUES (v_ouverte, v_patron);
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (2, 'abonner quelqu un d autre', 'refus 42501', 'ACCEPTE');
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (2, 'abonner quelqu un d autre', 'refus 42501', 'refus 42501');
  END;

  --------------------------------------------------------------- 3
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_patron)::text);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.abonnements_alertes_stock WHERE store_id = v_ouverte;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (3, 'le proprietaire ne lit pas l abonnement d un autre', '0 ligne', n || ' ligne');

  --------------------------------------------------------------- 4
  BEGIN
    EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_equipier)::text);
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.abonnements_alertes_stock(store_id, user_id) VALUES (v_fermee, v_equipier);
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (4, 's abonner sur une boutique verrouillee', 'refus 42501', 'ACCEPTE');
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
    INSERT INTO preuve VALUES (4, 's abonner sur une boutique verrouillee', 'refus 42501', 'refus 42501');
  END;

  --------------------------------------------------------------- 5 et 6
  -- Les claims sont REPOSEES : le bloc EXCEPTION ci-dessus a defait
  -- celles qu il contenait. Voir l en-tete de ce fichier.
  EXECUTE format('SET LOCAL request.jwt.claims = %L', json_build_object('sub', v_equipier)::text);

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.abonnements_alertes_stock WHERE user_id = v_equipier;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (5, 'il relit bien le sien', '1 ligne', n || ' ligne');

  EXECUTE 'SET LOCAL ROLE authenticated';
  DELETE FROM public.abonnements_alertes_stock WHERE store_id = v_ouverte AND user_id = v_equipier;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve VALUES (6, 'se desabonner', '1 ligne', n || ' ligne');

  --------------------------------------------------------------- 7
  INSERT INTO public.reglages_alertes_stock(store_id, prealerte_active, frequence)
  VALUES (v_ouverte, true, 'mouvement');
  SELECT public.demander_les_resumes_par_email() INTO n;
  INSERT INTO preuve VALUES (7, 'sans abonne, aucun envoi demande', '0 appel', n || ' appel');

  --------------------------------------------------------------- 8
  INSERT INTO preuve
  SELECT 8, 'le controle du verrou rend zero ligne', '0', count(*)::text
    FROM public.policies_sans_verrou();
END
$preuve$;

SELECT n, cas, attendu, obtenu,
       CASE WHEN attendu = obtenu THEN 'ok' ELSE '>>> ECHEC' END AS verdict
FROM preuve ORDER BY n;

ROLLBACK;
