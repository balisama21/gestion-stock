-- ═══════════════════════════════════════════════════════════════════
-- Les photos de la grande bannière du tableau de bord — importées par le
-- créateur de la plateforme.
--
-- L'application livre 31 photos de jour et 31 du soir : un mois entier
-- sans que la photo de tête se répète. Cette table ne reçoit que les
-- photos AJOUTÉES ensuite ; elles prennent la suite des photos livrées,
-- et une fois la série parcourue, la boucle recommence.
--
-- Une seule liste pour toutes les boutiques : c'est le décor du tableau
-- de bord, pas une donnée d'entreprise.
--
-- Lecture : tout utilisateur connecté.
-- Écriture : réservée au super admin (profiles.is_platform_admin).
--
-- LES FICHIERS vont dans un seau PUBLIC en lecture : ce sont des photos
-- de paysages, faites pour être vues, et une adresse directe se met en
-- cache dans le navigateur.
--
-- MIGRATION ADDITIVE : une table neuve, un seau neuf. Rien d'existant
-- n'est touché. Retour arrière : supabase/retours-arriere/ du même nom.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.photos_haut_de_page (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment      text NOT NULL CHECK (moment IN ('jour', 'soir')),
  chemin      text NOT NULL UNIQUE CHECK (btrim(chemin) <> ''),
  position    integer NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_haut_de_page_ordre
  ON public.photos_haut_de_page(moment, position);

ALTER TABLE public.photos_haut_de_page ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.photos_haut_de_page FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos_haut_de_page TO authenticated;

DROP POLICY IF EXISTS photos_haut_lecture ON public.photos_haut_de_page;
CREATE POLICY photos_haut_lecture ON public.photos_haut_de_page
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS photos_haut_ajout ON public.photos_haut_de_page;
CREATE POLICY photos_haut_ajout ON public.photos_haut_de_page
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_haut_modification ON public.photos_haut_de_page;
CREATE POLICY photos_haut_modification ON public.photos_haut_de_page
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS photos_haut_suppression ON public.photos_haut_de_page;
CREATE POLICY photos_haut_suppression ON public.photos_haut_de_page
  FOR DELETE TO authenticated
  USING ((SELECT public.is_super_admin()));

-- ─────────────────────────────────────────
-- Le seau des photos
-- ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('haut-de-page', 'haut-de-page', TRUE, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "haut_de_page_lecture" ON storage.objects;
CREATE POLICY "haut_de_page_lecture" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'haut-de-page');

DROP POLICY IF EXISTS "haut_de_page_depot_admin" ON storage.objects;
CREATE POLICY "haut_de_page_depot_admin" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'haut-de-page' AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "haut_de_page_modification_admin" ON storage.objects;
CREATE POLICY "haut_de_page_modification_admin" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'haut-de-page' AND (SELECT public.is_super_admin()))
  WITH CHECK (bucket_id = 'haut-de-page' AND (SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "haut_de_page_suppression_admin" ON storage.objects;
CREATE POLICY "haut_de_page_suppression_admin" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'haut-de-page' AND (SELECT public.is_super_admin()));
