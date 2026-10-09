-- ═══════════════════════════════════════════════════════════════════
-- « Inspiration du moment » — les photos choisies par l'administrateur
-- de la plateforme.
--
-- Une seule liste pour toutes les boutiques : c'est la décoration du
-- tableau de bord, pas une donnée d'entreprise. Trois photos par jour,
-- dans l'ordre de `position` ; une fois la liste parcourue, elle
-- recommence au début. Liste vide : l'application garde ses photos
-- d'origine.
--
-- Lecture : tout utilisateur connecté.
-- Écriture : réservée au super admin (profiles.is_platform_admin).
--
-- LES FICHIERS vont dans un seau PUBLIC en lecture : ce sont des photos
-- de plantes, faites pour être vues, et une adresse directe se met en
-- cache dans le navigateur.
--
-- MIGRATION ADDITIVE : une table neuve, un seau neuf. Rien d'existant
-- n'est touché. Retour arrière : supabase/retours-arriere/ du même nom.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.photos_inspiration (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemin      text NOT NULL UNIQUE CHECK (btrim(chemin) <> ''),
  position    integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_inspiration_position
  ON public.photos_inspiration(position);

ALTER TABLE public.photos_inspiration ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.photos_inspiration FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos_inspiration TO authenticated;

DROP POLICY IF EXISTS photos_inspiration_lecture ON public.photos_inspiration;
CREATE POLICY photos_inspiration_lecture ON public.photos_inspiration
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS photos_inspiration_ajout ON public.photos_inspiration;
CREATE POLICY photos_inspiration_ajout ON public.photos_inspiration
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_inspiration_modification ON public.photos_inspiration;
CREATE POLICY photos_inspiration_modification ON public.photos_inspiration
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_inspiration_suppression ON public.photos_inspiration;
CREATE POLICY photos_inspiration_suppression ON public.photos_inspiration
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

-- ─────────────────────────────────────────
-- Le seau des photos
-- ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inspiration', 'inspiration', TRUE, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "inspiration_lecture" ON storage.objects;
CREATE POLICY "inspiration_lecture" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'inspiration');

DROP POLICY IF EXISTS "inspiration_depot_admin" ON storage.objects;
CREATE POLICY "inspiration_depot_admin" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inspiration' AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "inspiration_modification_admin" ON storage.objects;
CREATE POLICY "inspiration_modification_admin" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'inspiration' AND (SELECT public.is_super_admin()))
  WITH CHECK (bucket_id = 'inspiration' AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "inspiration_suppression_admin" ON storage.objects;
CREATE POLICY "inspiration_suppression_admin" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inspiration' AND (SELECT public.is_super_admin()));
