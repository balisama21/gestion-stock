-- Retour arrière de 20261018102745_notifications_lues.sql
--
-- Ne supprime que l'état de lecture des notifications (qui a lu quoi).
-- Aucune donnée commerciale n'est touchée ; l'application retombe sur la
-- mémoire du navigateur.

DROP TABLE IF EXISTS public.notifications_lues;
