-- ═══════════════════════════════════════════════════════════════════
-- Les photos des bannières de section du tableau de bord (Opérations,
-- Ventes, L'argent, Stock, Fournisseurs) — importées et réglées par le
-- créateur de la plateforme.
--
-- L'application livre cinq photos par section. `photos_sections` reçoit
-- les photos AJOUTÉES ensuite ; leurs fichiers vont dans le seau
-- `haut-de-page` (déjà créé, écriture réservée au super admin), sous
-- `sections/<section>/`.
--
-- `reglages_photos_sections` dit, section par section, le mode :
--   'auto'   : la photo change chaque jour en parcourant la série ;
--   'manuel' : la photo `photo_id` reste affichée.
-- `photo_id` est l'identifiant d'une photo livrée (Unsplash) ou celui
-- d'une ligne de `photos_sections` : un texte, sans clé étrangère.
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

CREATE TABLE IF NOT EXISTS public.photos_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL CHECK (section IN ('operations', 'ventes', 'argent', 'stock', 'fournisseurs')),
  chemin      text NOT NULL UNIQUE CHECK (btrim(chemin) <> ''),
  position    integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_sections_ordre
  ON public.photos_sections(section, position);

CREATE TABLE IF NOT EXISTS public.reglages_photos_sections (
  section     text PRIMARY KEY CHECK (section IN ('operations', 'ventes', 'argent', 'stock', 'fournisseurs')),
  mode        text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manuel')),
  photo_id    text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photos_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglages_photos_sections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.photos_sections FROM anon;
REVOKE ALL ON public.reglages_photos_sections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reglages_photos_sections TO authenticated;

DROP POLICY IF EXISTS photos_sections_lecture ON public.photos_sections;
CREATE POLICY photos_sections_lecture ON public.photos_sections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS photos_sections_ajout ON public.photos_sections;
CREATE POLICY photos_sections_ajout ON public.photos_sections
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_sections_modification ON public.photos_sections;
CREATE POLICY photos_sections_modification ON public.photos_sections
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_sections_suppression ON public.photos_sections;
CREATE POLICY photos_sections_suppression ON public.photos_sections
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS reglages_photos_sections_lecture ON public.reglages_photos_sections;
CREATE POLICY reglages_photos_sections_lecture ON public.reglages_photos_sections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS reglages_photos_sections_ajout ON public.reglages_photos_sections;
CREATE POLICY reglages_photos_sections_ajout ON public.reglages_photos_sections
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS reglages_photos_sections_modification ON public.reglages_photos_sections;
CREATE POLICY reglages_photos_sections_modification ON public.reglages_photos_sections
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));
