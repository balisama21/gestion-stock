-- Retour arrière de 20261016110000_ia_infrastructure.sql
-- Supprime le socle IA (tables et fonctions neuves). Aucune autre table
-- n'en dépend. ATTENTION : efface le journal de consommation.

DROP FUNCTION IF EXISTS public.ia_purger_contenus(integer);
DROP FUNCTION IF EXISTS public.ia_tableau_de_bord(date);
DROP FUNCTION IF EXISTS public.ia_etat_boutique(uuid);
DROP FUNCTION IF EXISTS public.ia_decider_action(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.ia_proposer_action(uuid, uuid, uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.ia_finaliser(uuid, text, integer, integer, text, integer);
DROP FUNCTION IF EXISTS public.ia_reserver(uuid, uuid, text, integer);

DROP TABLE IF EXISTS public.ia_actions;
DROP TABLE IF EXISTS public.ia_consommation;
DROP TABLE IF EXISTS public.ia_reglages_boutique;
DROP TABLE IF EXISTS public.ia_tarifs;
DROP TABLE IF EXISTS public.ia_reglages_plateforme;

DROP FUNCTION IF EXISTS public.ia_fonctionnalites_connues();
