-- Retour arrière de « photos_inspiration » : le tableau de bord reprend
-- alors ses photos d'origine, sans rien changer au code.
--
-- Les fichiers du seau ne s'effacent pas en SQL : les vider d'abord
-- depuis le tableau de bord Supabase (Storage → inspiration), sinon la
-- suppression du seau échoue.
BEGIN;

DROP POLICY IF EXISTS "inspiration_lecture" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_depot_admin" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_modification_admin" ON storage.objects;
DROP POLICY IF EXISTS "inspiration_suppression_admin" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'inspiration';

DROP TABLE IF EXISTS public.photos_inspiration;

COMMIT;
