-- ═══════════════════════════════════════════════════════════════════
-- LE VERROU TIENT-IL ENCORE PARTOUT ?
--
-- À rejouer après toute nouvelle table, toute nouvelle policy, ou
-- simplement de temps en temps. Le script se termine par un ROLLBACK :
-- il n'écrit rien.
-- ═══════════════════════════════════════════════════════════════════
--
-- LE CONTRÔLE QUI COMPTE tient en une ligne, et ne demande même pas de
-- transaction :
--
--     SELECT * FROM public.policies_sans_verrou();
--
-- Elle doit rendre ZÉRO ligne. Toute ligne qu'elle rend est une écriture
-- encore possible sur une boutique dont l'abonnement est échu. C'est
-- exactement ce trou qui s'était ouvert : `enforce_store_lock_in_rls`
-- avait corrigé les clauses `USING` et oublié la plupart des
-- `WITH CHECK`, laissant douze tables ouvertes aux CRÉATIONS.
--
-- Deux exceptions sont inscrites dans la fonction, et voulues : on doit
-- pouvoir créer une boutique, et se débarrasser d'une boutique qu'on ne
-- paie plus.
--
-- Le reste de ce fichier éprouve le résultat pour de vrai, en se
-- faisant passer pour chaque rôle.

BEGIN;

CREATE TEMP TABLE preuve (n serial, cas text, attendu text, obtenu text) ON COMMIT DROP;

DO $$
DECLARE
  -- Deux comptes réels, choisis pour ce qu'ils représentent :
  --   MAMY   réglé à vie, boutiques ouvertes
  --   RICHIE jamais payeur, ses deux boutiques sont fermées
  MAMY    constant text := '8d22f166-7409-4319-9ac1-8f468b16dc17';
  RICHIE  constant text := '859aba2d-87d7-4936-931f-17fffc50c4e3';
  FERMEE  constant uuid := '1995717d-42f7-420a-b2b7-0c37ae9d0f90';
  OUVERTE constant uuid := 'a59f9f13-e48d-4683-9c8d-dd6a506829c2';
  r text;
  n int;
BEGIN
  -- ── ce qu'on ne peut plus faire sur une boutique fermée ──
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  BEGIN
    INSERT INTO public.categories (store_id, nom, created_by) VALUES (FERMEE, 'ZZ', RICHIE::uuid);
    r := 'ACCEPTEE';
  EXCEPTION WHEN others THEN r := 'refusee';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('creer une categorie · fermee', 'refusee', r);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  BEGIN
    INSERT INTO public.suppliers (store_id, nom, created_by) VALUES (FERMEE, 'ZZ', RICHIE::uuid);
    r := 'ACCEPTEE';
  EXCEPTION WHEN others THEN r := 'refusee';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('creer un fournisseur · fermee', 'refusee', r);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  BEGIN
    INSERT INTO public.store_members (store_id, user_id, role, permissions)
    VALUES (FERMEE, MAMY::uuid, 'vendeur', '{}'::jsonb);
    r := 'ACCEPTEE';
  EXCEPTION WHEN others THEN r := 'refusee';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('inviter un collaborateur · fermee', 'refusee', r);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  BEGIN
    INSERT INTO public.custom_field_definitions (store_id, entite, cle, libelle)
    VALUES (FERMEE, 'produits', 'zz', 'ZZ');
    r := 'ACCEPTEE';
  EXCEPTION WHEN others THEN r := 'refusee';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('creer un champ personnalise · fermee', 'refusee', r);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  UPDATE public.stores SET name = name || ' (essai)' WHERE id = FERMEE;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('modifier la fiche boutique · fermee', '0', n::text);

  -- ── ce qui doit continuer de marcher ──
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || RICHIE || '"}', true);
  SELECT count(*) INTO n FROM public.stores WHERE id = FERMEE;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('lire sa boutique fermee', '1', n::text);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || MAMY || '"}', true);
  BEGIN
    INSERT INTO public.categories (store_id, nom, created_by) VALUES (OUVERTE, 'ZZ', MAMY::uuid);
    r := 'acceptee';
  EXCEPTION WHEN others THEN r := 'REFUSEE';
  END;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('creer une categorie · ouverte', 'acceptee', r);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', '{"sub":"' || MAMY || '"}', true);
  UPDATE public.stores SET name = name WHERE id = OUVERTE;
  GET DIAGNOSTICS n = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('modifier la fiche boutique · ouverte', '1', n::text);

  -- ── et le contrôle d'ensemble ──
  SELECT count(*) INTO n FROM public.policies_sans_verrou();
  INSERT INTO preuve (cas, attendu, obtenu) VALUES ('policies d ecriture sans verrou', '0', n::text);
END $$;

SELECT n, cas, attendu, obtenu,
       CASE WHEN attendu = obtenu THEN 'OK' ELSE 'A REGARDER' END AS verdict
FROM preuve ORDER BY n;

ROLLBACK;
