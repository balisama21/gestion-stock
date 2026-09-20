-- ═══════════════════════════════════════════════════════════════════
-- DIX VENTES NE FONT QU'UNE PRÉALERTE
-- ═══════════════════════════════════════════════════════════════════
--
-- À coller dans l'éditeur SQL de Supabase. Tout se passe dans une
-- transaction ANNULÉE : le stock du client n'est pas touché, et aucune
-- ligne ne survit.
--
-- Toutes les lignes doivent porter « ok ».
--
-- ── Ce que ces treize cas établissent ──
--
--   1-2   À l'activation, l'existant est repris en silence. Sur la base
--         du 20/09, 31 produits sur 41 sont déjà sous leur seuil : sans
--         cette reprise, activer la fonction enverrait une notification
--         d'une trentaine de lignes, c'est-à-dire la liste qu'on ignore.
--   3-4   Un produit qui entre dans la bande produit UNE ligne, en
--         attente de son résumé, et devient annonçable.
--   5-6   LE CŒUR DU MÉCANISME. Dix mouvements dans la bande laissent
--         UNE ligne, et ne la re-datent pas. La date est mise à 2020
--         exprès : si le `ON CONFLICT DO NOTHING` ne tenait pas, elle
--         reviendrait à aujourd'hui.
--   7-8   Le stock remonte au-dessus du niveau : la ligne disparaît, le
--         produit se réarme, et le franchissement suivant re-notifie.
--         C'est la règle demandée, mot pour mot.
--   9-10  Tombé SOUS le seuil, le produit garde sa ligne — sinon il
--         re-notifierait en remontant à quatre — mais quitte la bande
--         orange : il relève de l'alerte rouge, qui existe déjà.
--   11    En mode « à chaque mouvement », la préalerte sort tout de
--         suite au lieu d'attendre le résumé.
--   12    Éteinte, la boutique n'a plus aucune ligne.
--   13    UNE BOUTIQUE SANS RÉGLAGES NE VOIT RIEN. C'est la garantie
--         « rien ne change pour celles qui n'activent pas ».
--
-- L'identifiant de boutique est celui de la base du 20/09/2026, choisi
-- parce qu'il porte 33 produits tous pourvus d'un seuil. Pour en
-- retrouver un autre jour :
--
--   SELECT p.store_id, s.name, count(*) FILTER (WHERE p.seuil_alerte > 0)
--     FROM public.products p JOIN public.stores s ON s.id = p.store_id
--    GROUP BY 1, 2 ORDER BY 3 DESC;

BEGIN;
CREATE TEMP TABLE preuve(n int, cas text, attendu text, obtenu text);

DO $preuve$
DECLARE
  v_store   uuid := 'cc1112dd-ff83-4a29-8358-5bbf10fc62a7'; -- TROPIC VISION, 33 produits
  v_autre   uuid;
  v_prod    uuid;
  v_seuil   integer;
  v_autre_p uuid;
  n  int;
  t  timestamptz;
  i  int;
BEGIN
  --------------------------------------------------------- 1. activation
  INSERT INTO public.reglages_alertes_stock(store_id, prealerte_active, mode, ecart, frequence)
  VALUES (v_store, true, 'ecart', 2, 'quotidien');

  SELECT count(*) INTO n FROM public.prealertes_stock WHERE store_id = v_store AND origine='reprise';
  INSERT INTO preuve VALUES (1, 'a l activation, l existant est repris', '>0 lignes reprise',
    CASE WHEN n > 0 THEN '>0 lignes reprise' ELSE n || ' ligne' END);

  SELECT count(*) INTO n FROM public.prealertes_a_annoncer WHERE store_id = v_store;
  INSERT INTO preuve VALUES (2, 'et rien n est annonce', '0', n::text);

  --------------------------------------------------------- 2. un franchissement
  SELECT id, seuil_alerte INTO v_prod, v_seuil
    FROM public.products
   WHERE store_id = v_store AND seuil_alerte > 0 AND stock_actuel > seuil_alerte + 5
   ORDER BY stock_actuel DESC LIMIT 1;

  UPDATE public.products SET stock_actuel = v_seuil + 2 WHERE id = v_prod;

  SELECT count(*) INTO n FROM public.prealertes_stock
   WHERE product_id = v_prod AND origine = 'franchissement' AND notifiee_le IS NULL;
  INSERT INTO preuve VALUES (3, 'le stock entre dans la bande', '1 ligne en attente', n || ' ligne en attente');

  SELECT count(*) INTO n FROM public.prealertes_a_annoncer WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (4, 'il est a annoncer', '1', n::text);

  --------------------------------------------------------- 3. DIX VENTES, UNE LIGNE
  UPDATE public.prealertes_stock SET franchie_le = '2020-01-01' WHERE product_id = v_prod;
  FOR i IN 1..10 LOOP
    UPDATE public.products
       SET stock_actuel = CASE WHEN i % 2 = 0 THEN v_seuil + 2 ELSE v_seuil + 1 END
     WHERE id = v_prod;
  END LOOP;

  SELECT count(*) INTO n FROM public.prealertes_stock WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (5, 'dix mouvements dans la bande', '1 ligne', n || ' ligne');

  SELECT franchie_le INTO t FROM public.prealertes_stock WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (6, 'la ligne n est pas re-datee', '2020', to_char(t, 'YYYY'));

  --------------------------------------------------------- 4. rearmement
  UPDATE public.products SET stock_actuel = v_seuil + 20 WHERE id = v_prod;
  SELECT count(*) INTO n FROM public.prealertes_stock WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (7, 'le stock remonte : le produit se rearme', '0 ligne', n || ' ligne');

  UPDATE public.products SET stock_actuel = v_seuil + 1 WHERE id = v_prod;
  SELECT count(*) INTO n FROM public.prealertes_stock
   WHERE product_id = v_prod AND origine='franchissement' AND franchie_le > now() - interval '1 minute';
  INSERT INTO preuve VALUES (8, 'et re-notifie au franchissement suivant', '1 ligne', n || ' ligne');

  --------------------------------------------------------- 5. sous le seuil
  UPDATE public.products SET stock_actuel = v_seuil - 1 WHERE id = v_prod;
  SELECT count(*) INTO n FROM public.prealertes_stock WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (9, 'sous le seuil, la ligne reste (anti-repetition)', '1 ligne', n || ' ligne');
  SELECT count(*) INTO n FROM public.prealertes_a_annoncer WHERE product_id = v_prod;
  INSERT INTO preuve VALUES (10, 'mais il quitte la bande orange', '0', n::text);

  --------------------------------------------------------- 6. « a chaque mouvement »
  UPDATE public.reglages_alertes_stock SET frequence = 'mouvement' WHERE store_id = v_store;
  UPDATE public.products SET stock_actuel = v_seuil + 20 WHERE id = v_prod;  -- rearme
  UPDATE public.products SET stock_actuel = v_seuil + 1  WHERE id = v_prod;  -- refranchit
  SELECT count(*) INTO n FROM public.prealertes_stock
   WHERE product_id = v_prod AND notifiee_le IS NOT NULL;
  INSERT INTO preuve VALUES (11, 'a chaque mouvement : la prealerte sort tout de suite', '1 ligne', n || ' ligne');

  --------------------------------------------------------- 7. extinction
  UPDATE public.reglages_alertes_stock SET prealerte_active = false WHERE store_id = v_store;
  SELECT count(*) INTO n FROM public.prealertes_stock WHERE store_id = v_store;
  INSERT INTO preuve VALUES (12, 'eteinte, la boutique n a plus aucune ligne', '0 ligne', n || ' ligne');

  --------------------------------------------------------- 8. sans reglages
  SELECT p.id, p.store_id INTO v_autre_p, v_autre
    FROM public.products p WHERE p.store_id <> v_store AND p.seuil_alerte > 0 LIMIT 1;
  UPDATE public.products SET stock_actuel = 1 WHERE id = v_autre_p;
  SELECT count(*) INTO n FROM public.prealertes_stock WHERE store_id = v_autre;
  INSERT INTO preuve VALUES (13, 'sans reglages, rien ne se passe', '0 ligne', n || ' ligne');
END
$preuve$;

SELECT n, cas, attendu, obtenu,
       CASE WHEN attendu = obtenu THEN 'ok' ELSE '>>> ECHEC' END AS verdict
FROM preuve ORDER BY n;

ROLLBACK;
