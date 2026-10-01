-- SECOURS — à n'exécuter qu'avec accord, si M2 n'est pas passée avant le
-- 15/10/2026. Repousse de 30 jours la fin d'essai de « CRM Kinvest ».
BEGIN;
SELECT set_config('app.bypass_activation_guard', 'on', true);
UPDATE public.stores
   SET trial_ends_at = greatest(trial_ends_at, now()) + interval '30 days'
 WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80'
   AND activation_status = 'trial';
COMMIT;

-- Retour arrière :
--   BEGIN;
--   SELECT set_config('app.bypass_activation_guard', 'on', true);
--   UPDATE public.stores SET trial_ends_at = '2026-10-15 00:06:10.912202+00'
--    WHERE id = 'caa17416-3aef-4d1c-9f24-6fd66909cf80';
--   COMMIT;
