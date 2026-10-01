-- Après M2 uniquement. Seules écritures de données autorisées.

BEGIN;

-- (a) Les propriétaires Kinvest
INSERT INTO public.proprietaires_de_marque (marque_id, email)
SELECT public.marque_de_l_hote('mg-kinvest.com'), e
  FROM unnest(ARRAY[
    'kinvest.concept@gmail.com',
    'lastrichie2003@gmail.com',
    'balisamamamy2003@gmail.com',
    'ventso.kinvest@gmail.com'
  ]) AS e
 WHERE public.marque_de_l_hote('mg-kinvest.com') IS NOT NULL
ON CONFLICT DO NOTHING;

-- (b) « CRM Kinvest » rejoint sa marque (le trigger la passe ouverte à vie)
UPDATE public.stores
   SET marque_id = public.marque_de_l_hote('mg-kinvest.com')
 WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80'
   AND marque_id IS NULL;

COMMIT;

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
