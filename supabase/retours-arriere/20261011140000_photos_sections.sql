-- Retour arrière de « photos_sections » : chaque section reprend ses cinq
-- photos livrées, en mode auto, sans rien changer au code. Les photos
-- importées et les choix manuels sont perdus.
--
-- Les fichiers restent dans le seau `haut-de-page`, sous `sections/` :
-- les supprimer depuis le tableau de bord Supabase si besoin.
BEGIN;

DROP TABLE IF EXISTS public.photos_sections;
DROP TABLE IF EXISTS public.reglages_photos_sections;

COMMIT;
