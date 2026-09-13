-- Les politiques de sécurité ré-évaluaient auth.uid() à chaque ligne.
--
-- ── Le problème ──
--
-- Une politique écrite « owner_id = auth.uid() » fait appeler la
-- fonction UNE FOIS PAR LIGNE examinée. Sur une table de trente lignes
-- c'est invisible ; sur un historique de ventes qui grossit tous les
-- jours, c'est un appel de fonction multiplié par le nombre de lignes,
-- à chaque lecture, pour un résultat qui ne change jamais au cours de
-- la requête.
--
-- Enveloppée dans « (select auth.uid()) », l'expression devient un
-- sous-plan d'initialisation : PostgreSQL l'évalue une seule fois et
-- réutilise la valeur. C'est le correctif que recommande Supabase.
--
-- ── Pourquoi c'est sûr ──
--
-- auth.uid() ne prend aucun argument et ne lit aucune colonne : sa
-- valeur ne peut pas dépendre de la ligne examinée. L'envelopper ne
-- change donc pas le résultat du test, seulement le nombre de fois
-- qu'on le calcule. La sémantique est identique par construction.
--
-- ── Ce qui a été vérifié avant d'appliquer, en transaction annulée ──
--
--   38 politiques réécrites, sur 34 tables.
--   Visibilité : 136 mesures (4 profils x 34 tables) — propriétaire,
--   vendeur, propriétaire tiers, et un compte fantôme ne possédant
--   rien. ZÉRO écart avant/après.
--   Structure : en retirant l'enveloppe du texte relu, on retombe
--   exactement sur l'expression d'origine. ZÉRO anomalie.
--   Écritures : 7 épreuves dont 4 qui DOIVENT être refusées (créer
--   chez un tiers, créer au nom de quelqu'un d'autre). ZÉRO
--   basculement, et les refus restent des refus de sécurité (42501).
--
-- ── Réécriture automatique, et non recopiée à la main ──
--
-- Le texte de chaque politique est relu depuis le catalogue puis
-- substitué par programme. Recopier trente-huit prédicats à la main
-- ferait courir le risque d'une faute de frappe qui changerait
-- silencieusement qui voit quoi.
--
-- ALTER POLICY, et non DROP puis CREATE : la politique n'est jamais
-- absente, même une fraction de seconde, et ses rôles comme sa
-- commande sont conservés tels quels.

DO $migration$
DECLARE
  r record;
  v_sql text;
  v_q text;
  v_w text;
  v_n int := 0;
  v_restant int;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      -- On ne prend que celles qui portent encore un auth.uid() NU.
      -- Une politique déjà enveloppée est laissée intacte, ce qui rend
      -- cette migration rejouable sans effet.
      AND regexp_replace(
            coalesce(qual, '') || coalesce(with_check, ''),
            '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') ~ 'auth\.uid\(\)'
    ORDER BY tablename, policyname
  LOOP
    -- On met les occurrences déjà enveloppées à l'abri, on enveloppe
    -- les nues, puis on remet les premières. Sans cette précaution,
    -- rejouer la migration envelopperait une enveloppe.
    v_q := regexp_replace(coalesce(r.qual, ''),
             '\( SELECT auth\.uid\(\) AS uid\)', '@@UID@@', 'g');
    v_q := regexp_replace(v_q, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    v_q := replace(v_q, '@@UID@@', '(select auth.uid())');

    v_w := regexp_replace(coalesce(r.with_check, ''),
             '\( SELECT auth\.uid\(\) AS uid\)', '@@UID@@', 'g');
    v_w := regexp_replace(v_w, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    v_w := replace(v_w, '@@UID@@', '(select auth.uid())');

    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_q);
    END IF;
    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_w);
    END IF;

    EXECUTE v_sql;
    v_n := v_n + 1;
  END LOOP;

  -- Garde-fou : si une seule politique porte encore un auth.uid() nu,
  -- la substitution a manqué quelque chose et la migration échoue au
  -- lieu de laisser croire qu'elle a fait son travail.
  SELECT count(*) INTO v_restant
  FROM pg_policies
  WHERE schemaname = 'public'
    AND regexp_replace(
          coalesce(qual, '') || coalesce(with_check, ''),
          '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') ~ 'auth\.uid\(\)';

  IF v_restant > 0 THEN
    RAISE EXCEPTION 'Reecriture incomplete : % politique(s) portent encore un auth.uid() nu', v_restant;
  END IF;

  RAISE NOTICE 'Politiques reecrites : %', v_n;
END $migration$;
