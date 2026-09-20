-- ═══════════════════════════════════════════════════════════════════
-- LES CINQ RÈGLES D'HÉRITAGE, ÉPROUVÉES SUR LES VRAIES DONNÉES
--
-- Vérifie les migrations 20260920124322_activation_par_compte et
-- 20260920124400_rattrapage_activation_des_boutiques. Le script se
-- termine par un ROLLBACK : il n'écrit rien, et les boutiques
-- « ZZ … » qu'il crée disparaissent avec la transaction.
--
-- Passé le 20/09/2026 : les huit lignes rendent OK.
-- ═══════════════════════════════════════════════════════════════════
--
-- Les comptes utilisés sont réels, choisis pour ce qu'ils représentent :
--
--   balisamamamy2003  compte réglé à vie, trois boutiques
--   lastrichie2003    invité chez le précédent, jamais payeur,
--                     deux boutiques à lui en essai terminé
--   lafatra           essai EN COURS, une boutique
--   yasthimas         compte sans aucune boutique

BEGIN;

CREATE TEMP TABLE resultat (
  n int GENERATED ALWAYS AS IDENTITY,
  regle text,
  attendu text,
  obtenu text
) ON COMMIT DROP;

DO $$
DECLARE
  v_mamy uuid;
  v_richie uuid;
  v_lafatra uuid;
  v_neuf uuid;
  v_id uuid;
  v_statut text;
  v_fin timestamptz;
  v_fin_attendue timestamptz;
  v_verrou boolean;
  v_avant text;
BEGIN
  SELECT id INTO v_mamy    FROM public.profiles WHERE email = 'balisamamamy2003@gmail.com';
  SELECT id INTO v_richie  FROM public.profiles WHERE email = 'lastrichie2003@gmail.com';
  SELECT id INTO v_lafatra FROM public.profiles WHERE email = 'lafatra@gmail.com';
  SELECT id INTO v_neuf    FROM public.profiles WHERE email = 'yasthimas@gmail.com';

  -- ── RÈGLE 1 — un compte réglé ne se voit plus redemander de clé ──
  -- C'est la boutique de la capture d'écran.
  SELECT activation_status, public.store_is_locked(id)
    INTO v_statut, v_verrou
  FROM public.stores
  WHERE owner_id = v_mamy AND name = 'Boutique de Mamy';

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'R1 · boutique existante d un compte regle',
    'active / ouverte',
    coalesce(v_statut, '?') || ' / ' || CASE WHEN v_verrou THEN 'VERROUILLEE' ELSE 'ouverte' END
  );

  -- ── RÈGLE 2 — il crée une boutique de plus : elle naît ouverte ──
  INSERT INTO public.stores (name, owner_id) VALUES ('ZZ R2 compte regle', v_mamy)
  RETURNING id INTO v_id;

  SELECT activation_status, public.store_is_locked(id) INTO v_statut, v_verrou
  FROM public.stores WHERE id = v_id;

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'R2 · compte regle cree une boutique',
    'active / ouverte',
    v_statut || ' / ' || CASE WHEN v_verrou THEN 'VERROUILLEE' ELSE 'ouverte' END
  );

  -- ── RÈGLE 3 — l'invité entre chez son hôte sans clé ──
  SELECT public.store_is_locked(s.id) INTO v_verrou
  FROM public.stores s
  JOIN public.store_members m ON m.store_id = s.id AND m.user_id = v_richie
  WHERE s.owner_id = v_mamy;

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'R3 · invite chez un compte regle',
    'membre / ouverte',
    CASE WHEN v_verrou IS NULL THEN 'PAS MEMBRE / ?'
         ELSE 'membre / ' || CASE WHEN v_verrou THEN 'VERROUILLEE' ELSE 'ouverte' END END
  );

  -- ── RÈGLE 4 — mais SA boutique à lui reste à sa charge ──
  -- Son propre essai est terminé : elle naît donc verrouillée.
  INSERT INTO public.stores (name, owner_id) VALUES ('ZZ R4 boutique de l invite', v_richie)
  RETURNING id INTO v_id;

  SELECT activation_status, public.store_is_locked(id) INTO v_statut, v_verrou
  FROM public.stores WHERE id = v_id;

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'R4 · l invite cree SA boutique',
    'trial / verrouillee',
    v_statut || ' / ' || CASE WHEN v_verrou THEN 'verrouillee' ELSE 'OUVERTE' END
  );

  -- ── RÈGLE 5 — un compte en essai transmet SA date de fin ──
  SELECT min(trial_ends_at) INTO v_fin_attendue
  FROM public.stores WHERE owner_id = v_lafatra;

  INSERT INTO public.stores (name, owner_id) VALUES ('ZZ R5 essai en cours', v_lafatra)
  RETURNING id INTO v_id;

  SELECT activation_status, trial_ends_at INTO v_statut, v_fin
  FROM public.stores WHERE id = v_id;

  -- L'attendu est la fin de l'essai DÉJÀ en cours. Si la colonne
  -- « obtenu » affiche une date trente jours plus loin, c'est que la
  -- boutique a ouvert un essai neuf : la faille est restée ouverte.
  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'R5 · compte en essai cree une boutique',
    'trial / ' || v_fin_attendue::date,
    v_statut || ' / ' || v_fin::date
  );

  -- ── Contrôle · un compte neuf garde bien ses trente jours ──
  INSERT INTO public.stores (name, owner_id) VALUES ('ZZ compte neuf', v_neuf)
  RETURNING id INTO v_id;

  SELECT activation_status, trial_ends_at INTO v_statut, v_fin
  FROM public.stores WHERE id = v_id;

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'C1 · compte sans aucune boutique',
    'trial / ' || (now() + interval '30 days')::date,
    v_statut || ' / ' || v_fin::date
  );

  -- ── Contrôle · la garde tient : personne ne s'auto-active ──
  SELECT activation_status INTO v_avant
  FROM public.stores WHERE id = v_id;

  UPDATE public.stores
  SET activation_status = 'active', abonnement_jusqu_au = NULL, trial_ends_at = now() + interval '10 years'
  WHERE id = v_id;

  SELECT activation_status INTO v_statut FROM public.stores WHERE id = v_id;

  INSERT INTO resultat (regle, attendu, obtenu) VALUES (
    'C2 · auto-activation par un update client',
    'refusee, reste ' || v_avant,
    CASE WHEN v_statut = v_avant THEN 'refusee, reste ' || v_statut
         ELSE 'PASSEE — ' || v_statut END
  );

  -- ── Contrôle · l'activation par code règle le compte entier ──
  PERFORM public.activer_le_compte(v_richie, NULL);

  INSERT INTO resultat (regle, attendu, obtenu)
  SELECT 'C3 · activer le compte ouvre toutes ses boutiques',
         'aucune fermee',
         CASE WHEN count(*) = 0 THEN 'aucune fermee'
              ELSE count(*)::text || ' ENCORE FERMEES' END
  FROM public.stores
  WHERE owner_id = v_richie AND public.store_is_locked(id);
END $$;

SELECT n, regle, attendu, obtenu,
       CASE WHEN obtenu = attendu THEN 'OK' ELSE 'A REGARDER' END AS verdict
FROM resultat
ORDER BY n;

-- Rien n'est conservé.
ROLLBACK;
