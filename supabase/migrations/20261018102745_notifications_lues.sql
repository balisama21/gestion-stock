-- État de lecture des notifications, par personne et par boutique.
--
-- Purement additif : une table neuve, rien d'autre n'est touché. Aucune
-- table existante, aucune fonction, aucun déclencheur ne change.
--
-- Les notifications elles-mêmes se déduisent des écritures réelles de la
-- boutique (ventes, achats, règlements, journal_activite…) : elles n'ont
-- pas besoin d'être recopiées. Ce qui manquait, c'est de savoir ce que
-- CHACUN en a fait. Cet état vivait dans le navigateur (localStorage) :
-- il se perdait d'un appareil à l'autre, et la pastille revenait à « 9+ »
-- sur le téléphone après avoir tout lu sur l'ordinateur.
--
-- Deux états, comme sur un réseau social :
--   « vu » — la cloche a été ouverte pendant que la notification était
--            là. Elle ne compte plus dans la pastille, mais reste en gras
--            dans la liste tant qu'on ne l'a pas ouverte ;
--   « lu » — on l'a ouverte, ou « Tout marquer lu ».
-- Un « lu » ne redevient jamais « vu » (le client n'écrit « vu » qu'en
-- ignorant les lignes existantes).
--
-- Écriture et lecture : uniquement ses propres lignes, dans une boutique
-- dont on est membre. Personne ne voit ce que les autres ont lu.
--
-- Retour arrière : supabase/retours-arriere/20261018102745_notifications_lues.sql

CREATE TABLE IF NOT EXISTS public.notifications_lues (
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id         uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  notification_id  text NOT NULL CHECK (char_length(notification_id) BETWEEN 1 AND 200),
  etat             text NOT NULL DEFAULT 'lu' CHECK (etat IN ('vu', 'lu')),
  maj_le           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_lues_boutique
  ON public.notifications_lues (store_id);

ALTER TABLE public.notifications_lues ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications_lues FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.notifications_lues TO authenticated;
GRANT ALL ON public.notifications_lues TO service_role;

DROP POLICY IF EXISTS notifications_lues_lecture ON public.notifications_lues;
CREATE POLICY notifications_lues_lecture ON public.notifications_lues
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id));

DROP POLICY IF EXISTS notifications_lues_ajout ON public.notifications_lues;
CREATE POLICY notifications_lues_ajout ON public.notifications_lues
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id));

DROP POLICY IF EXISTS notifications_lues_maj ON public.notifications_lues;
CREATE POLICY notifications_lues_maj ON public.notifications_lues
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_store_member(store_id));
