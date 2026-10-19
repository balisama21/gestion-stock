-- Retour arrière de 20261019083335_corriger_prix_vente.sql
--
-- Retire la fonction ajoutée. Aucune autre fonction ni aucune donnée n'est
-- touchée ; les prix déjà corrigés restent tels qu'enregistrés.

DROP FUNCTION IF EXISTS public.corriger_prix_vente(uuid, numeric);
