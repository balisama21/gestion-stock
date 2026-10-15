-- Retour arrière de « photos_haut_de_page » : la bannière garde alors ses
-- 31 + 31 photos livrées, sans rien changer au code. Les photos importées
-- dans les paramètres sont perdues.
--
-- Les fichiers du seau ne s'effacent pas en SQL : les vider d'abord
-- depuis le tableau de bord Supabase (Storage → haut-de-page), sinon la
-- suppression du seau échoue.
BEGIN;

DROP POLICY IF EXISTS "haut_de_page_lecture" ON storage.objects;
DROP POLICY IF EXISTS "haut_de_page_depot_admin" ON storage.objects;
DROP POLICY IF EXISTS "haut_de_page_modification_admin" ON storage.objects;
DROP POLICY IF EXISTS "haut_de_page_suppression_admin" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'haut-de-page';

DROP TABLE IF EXISTS public.photos_haut_de_page;

COMMIT;
