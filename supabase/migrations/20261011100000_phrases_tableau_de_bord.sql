-- ═══════════════════════════════════════════════════════════════════
-- Les phrases du haut du tableau de bord — ajoutées par le créateur de
-- la plateforme.
--
-- L'application livre 93 phrases pour la journée et 93 pour le soir :
-- plus de trois mois sans répétition. Cette table ne reçoit que les
-- phrases AJOUTÉES ensuite ; elles prennent la suite des phrases livrées.
--
-- `reglages_phrases` (une seule ligne) dit quand chaque série a commencé
-- et ce qui se passe une fois la série épuisée :
--   'reutiliser' : la série recommence à la première phrase ;
--   'attendre'   : la dernière reste affichée jusqu'aux prochains ajouts.
--
-- Une seule liste pour toutes les boutiques : c'est le décor du tableau
-- de bord, pas une donnée d'entreprise.
--
-- Lecture : tout utilisateur connecté.
-- Écriture : réservée au super admin (profiles.is_platform_admin).
--
-- MIGRATION ADDITIVE : deux tables neuves, rien d'existant n'est touché.
-- Retour arrière : supabase/retours-arriere/ du même nom.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.phrases_tableau_de_bord (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment      text NOT NULL CHECK (moment IN ('jour', 'soir')),
  ligne1      text NOT NULL CHECK (btrim(ligne1) <> '' AND char_length(ligne1) <= 120),
  ligne2      text NOT NULL DEFAULT '' CHECK (char_length(ligne2) <= 120),
  devise1     text NOT NULL CHECK (btrim(devise1) <> '' AND char_length(devise1) <= 30),
  devise2     text NOT NULL DEFAULT '' CHECK (char_length(devise2) <= 30),
  position    integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phrases_tableau_de_bord_ordre
  ON public.phrases_tableau_de_bord(moment, position);

CREATE TABLE IF NOT EXISTS public.reglages_phrases (
  id          boolean PRIMARY KEY DEFAULT TRUE CHECK (id),
  a_la_fin    text NOT NULL DEFAULT 'reutiliser' CHECK (a_la_fin IN ('reutiliser', 'attendre')),
  debut_jour  date NOT NULL DEFAULT DATE '2026-10-11',
  debut_soir  date NOT NULL DEFAULT DATE '2026-10-11',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reglages_phrases (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.phrases_tableau_de_bord ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglages_phrases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.phrases_tableau_de_bord FROM anon;
REVOKE ALL ON public.reglages_phrases FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phrases_tableau_de_bord TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reglages_phrases TO authenticated;

DROP POLICY IF EXISTS phrases_lecture ON public.phrases_tableau_de_bord;
CREATE POLICY phrases_lecture ON public.phrases_tableau_de_bord
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS phrases_ajout ON public.phrases_tableau_de_bord;
CREATE POLICY phrases_ajout ON public.phrases_tableau_de_bord
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS phrases_modification ON public.phrases_tableau_de_bord;
CREATE POLICY phrases_modification ON public.phrases_tableau_de_bord
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS phrases_suppression ON public.phrases_tableau_de_bord;
CREATE POLICY phrases_suppression ON public.phrases_tableau_de_bord
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS reglages_phrases_lecture ON public.reglages_phrases;
CREATE POLICY reglages_phrases_lecture ON public.reglages_phrases
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS reglages_phrases_ajout ON public.reglages_phrases;
CREATE POLICY reglages_phrases_ajout ON public.reglages_phrases
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS reglages_phrases_modification ON public.reglages_phrases;
CREATE POLICY reglages_phrases_modification ON public.reglages_phrases
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));
