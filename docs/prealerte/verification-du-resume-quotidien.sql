-- ═══════════════════════════════════════════════════════════════════
-- LE RÉSUMÉ QUOTIDIEN SORT À L'HEURE, ET UNE SEULE FOIS
-- ═══════════════════════════════════════════════════════════════════
--
-- À coller dans l'éditeur SQL de Supabase. Transaction ANNULÉE : rien
-- n'est écrit, et `net.http_post` étant transactionnel, aucune requête
-- HTTP ne part non plus.
--
-- Toutes les lignes doivent porter « ok ».
--
-- ── Ce que ces neuf cas établissent ──
--
--   1-2  Une préalerte franchie attend l'heure choisie. La cloche ne la
--        montre pas avant : `notifiee_le` est le seul robinet, pour la
--        cloche comme pour l'e-mail.
--   3-4  L'heure passée, elle sort, et la cloche la montre.
--   5    Le réveil suivant ne la libère pas une seconde fois.
--   6-7  Le canal e-mail commande l'envoi, et lui seul. Éteint : aucune
--        requête. Allumé : la boutique entre dans la file.
--   8    Une fois `email_le` posée, elle en sort.
--   9    UN RÉVEIL MANQUÉ SE RATTRAPE. On ne compare pas l'heure
--        courante à l'heure choisie — un réveil sauté perdrait alors le
--        résumé du jour. On libère ce qui a été franchi avant le dernier
--        passage DÛ, ce qui rattrape sans jamais libérer en avance.
--
-- ── Une conséquence à connaître ──
--
-- Le résumé de huit heures couvre ce qui a été franchi AVANT huit
-- heures. Un produit qui franchit à neuf heures attend le lendemain.
-- C'est ce qu'est un résumé quotidien ; le tableau de bord, lui, montre
-- l'état réel à tout instant.

BEGIN;
CREATE TEMP TABLE preuve(n int, cas text, attendu text, obtenu text);

DO $preuve$
DECLARE
  v_store uuid := 'cc1112dd-ff83-4a29-8358-5bbf10fc62a7'; -- TROPIC VISION
  v_prod  uuid;
  v_seuil integer;
  v_h     integer;
  n int;
BEGIN
  v_h := extract(hour from (now() at time zone public.fuseau_des_boutiques()))::int;

  INSERT INTO public.reglages_alertes_stock(store_id, prealerte_active, mode, ecart, frequence, heure_resume)
  VALUES (v_store, true, 'ecart', 2, 'quotidien', (v_h + 1) % 24);

  SELECT id, seuil_alerte INTO v_prod, v_seuil
    FROM public.products
   WHERE store_id = v_store AND seuil_alerte > 0 AND stock_actuel > seuil_alerte + 5
   ORDER BY stock_actuel DESC LIMIT 1;
  UPDATE public.products SET stock_actuel = v_seuil + 1 WHERE id = v_prod;

  -- Franchie il y a trois heures : le cas normal.
  UPDATE public.prealertes_stock SET franchie_le = now() - interval '3 hours'
   WHERE product_id = v_prod;

  SELECT public.liberer_les_prealertes() INTO n;
  INSERT INTO preuve VALUES (1, 'resume prevu dans une heure : rien ne sort', '0 liberee', n || ' liberee');

  SELECT count(*) INTO n FROM public.prealertes_a_annoncer
   WHERE store_id = v_store AND notifiee_le IS NOT NULL;
  INSERT INTO preuve VALUES (2, 'la cloche ne montre rien encore', '0', n::text);

  -- L heure choisie est passee il y a deux heures : le resume est du.
  UPDATE public.reglages_alertes_stock SET heure_resume = (v_h + 22) % 24 WHERE store_id = v_store;
  SELECT public.liberer_les_prealertes() INTO n;
  INSERT INTO preuve VALUES (3, 'l heure est passee : le resume sort', '1 liberee', n || ' liberee');

  SELECT count(*) INTO n FROM public.prealertes_a_annoncer
   WHERE store_id = v_store AND notifiee_le IS NOT NULL;
  INSERT INTO preuve VALUES (4, 'et la cloche la montre', '1', n::text);

  SELECT public.liberer_les_prealertes() INTO n;
  INSERT INTO preuve VALUES (5, 'le reveil suivant ne relibere rien', '0 liberee', n || ' liberee');

  SELECT public.demander_les_resumes_par_email() INTO n;
  INSERT INTO preuve VALUES (6, 'canal e-mail eteint : aucun envoi demande', '0 appel', n || ' appel');

  UPDATE public.reglages_alertes_stock SET canaux = ARRAY['email'] WHERE store_id = v_store;
  SELECT count(DISTINCT a.store_id) INTO n
    FROM public.prealertes_a_annoncer a
    JOIN public.reglages_alertes_stock r ON r.store_id = a.store_id
   WHERE a.notifiee_le IS NOT NULL AND a.email_le IS NULL
     AND r.prealerte_active AND 'email' = ANY (r.canaux);
  INSERT INTO preuve VALUES (7, 'canal e-mail allume : une boutique a servir', '1 boutique', n || ' boutique');

  UPDATE public.prealertes_stock SET email_le = now() WHERE store_id = v_store;
  SELECT public.demander_les_resumes_par_email() INTO n;
  INSERT INTO preuve VALUES (8, 'deja envoyee : plus rien a servir', '0 appel', n || ' appel');

  -- Un reveil saute hier : la prealerte d hier sort quand meme.
  UPDATE public.prealertes_stock SET notifiee_le = NULL, email_le = NULL,
         franchie_le = now() - interval '30 hours' WHERE product_id = v_prod;
  SELECT public.liberer_les_prealertes() INTO n;
  INSERT INTO preuve VALUES (9, 'un reveil manque se rattrape', '1 liberee', n || ' liberee');
END
$preuve$;

SELECT n, cas, attendu, obtenu,
       CASE WHEN attendu = obtenu THEN 'ok' ELSE '>>> ECHEC' END AS verdict
FROM preuve ORDER BY n;

-- Le reveil horaire doit exister et etre actif.
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'prealertes-de-stock';

ROLLBACK;
