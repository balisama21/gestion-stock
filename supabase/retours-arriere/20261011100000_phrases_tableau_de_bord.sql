-- Retour arrière de « phrases_tableau_de_bord » : le tableau de bord
-- garde alors ses 93 + 93 phrases livrées, sans rien changer au code.
-- Les phrases ajoutées dans les paramètres sont perdues.
BEGIN;

DROP TABLE IF EXISTS public.phrases_tableau_de_bord;
DROP TABLE IF EXISTS public.reglages_phrases;

COMMIT;
