-- Après M2 uniquement. Seules écritures de données autorisées.
--
-- « Confirm email » est DÉSACTIVÉ dans Supabase Auth : email_confirmed_at
-- est rempli d'office à l'inscription et ne prouve pas que la personne
-- possède l'adresse. Le contrôle reste dans les RPC, mais la protection
-- réelle vient d'ici : on n'inscrit que des e-mails dont le compte EXISTE
-- DÉJÀ. Inscrire une adresse sans compte laisserait le premier venu
-- l'enregistrer et devenir propriétaire.
--
-- Un e-mail absent (liste en fin de script) s'ajoute plus tard, une fois
-- son compte créé et vérifié par vous, en rejouant le bloc (a).

BEGIN;

-- (a) Les propriétaires Kinvest, comptes existants uniquement
INSERT INTO public.proprietaires_de_marque (marque_id, email)
SELECT public.marque_de_l_hote('mg-kinvest.com'), lower(u.email)
  FROM auth.users u
 WHERE lower(u.email) IN (
         'kinvest.concept@gmail.com',
         'lastrichie2003@gmail.com',
         'balisamamamy2003@gmail.com',
         'ventso.kinvest@gmail.com'
       )
   AND u.deleted_at IS NULL
   AND public.marque_de_l_hote('mg-kinvest.com') IS NOT NULL
ON CONFLICT DO NOTHING;

-- (b) « CRM Kinvest » rejoint sa marque (le trigger la passe ouverte à vie)
UPDATE public.stores
   SET marque_id = public.marque_de_l_hote('mg-kinvest.com')
 WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80'
   AND marque_id IS NULL;

COMMIT;

-- E-mails demandés mais NON inscrits, faute de compte :
SELECT e AS email_sans_compte
  FROM unnest(ARRAY[
    'kinvest.concept@gmail.com',
    'lastrichie2003@gmail.com',
    'balisamamamy2003@gmail.com',
    'ventso.kinvest@gmail.com'
  ]) AS e
 WHERE NOT EXISTS (
   SELECT 1 FROM auth.users u WHERE lower(u.email) = e AND u.deleted_at IS NULL
 );

-- Retour arrière de (a) et (b) seuls, sans défaire M2 :
--   BEGIN;
--   SELECT set_config('app.bypass_activation_guard', 'on', true);
--   UPDATE public.stores
--      SET marque_id = NULL, activation_status = 'trial',
--          trial_ends_at = '2026-10-15 00:06:10.912202+00',
--          activated_at = NULL, abonnement_jusqu_au = NULL
--    WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80';
--   DELETE FROM public.proprietaires_de_marque
--    WHERE marque_id = public.marque_de_l_hote('mg-kinvest.com');
--   COMMIT;
