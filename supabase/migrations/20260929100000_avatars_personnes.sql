-- ═══════════════════════════════════════════════════════════════════
-- Avatars des personnes — le visage choisi, ou une photo.
--
-- Sans rien de choisi, l'application dessine un visage tiré du nom.
-- Cette table ne garde que les exceptions : un visage réglé à la main
-- (teint, coiffure, tenue…) ou le chemin d'une photo.
--
-- LA CLÉ EST LE NOM, ramené à sa forme stable (sans accents, casse ni
-- espaces parasites) : un même client apparaît sous son nom dans la
-- fiche, dans une vente à crédit ou une livraison, sans toujours y être
-- rattaché par un identifiant. Le visage suit donc la personne partout.
--
-- LES PHOTOS vont dans un seau PRIVÉ : ce sont des visages de clients
-- et d'employés. Lecture par les seuls membres de la boutique, par des
-- liens signés de courte durée ; tout fichier vit sous `<store_id>/…`.
--
-- MIGRATION ADDITIVE : aucune table, aucune politique existante touchée.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS avatars_personnes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cle          TEXT NOT NULL CHECK (btrim(cle) <> ''),
  traits       JSONB,
  photo_chemin TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, cle)
);

ALTER TABLE avatars_personnes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avatars_personnes_select" ON avatars_personnes;
CREATE POLICY "avatars_personnes_select" ON avatars_personnes FOR SELECT
  USING (is_store_member(store_id));

DROP POLICY IF EXISTS "avatars_personnes_insert" ON avatars_personnes;
CREATE POLICY "avatars_personnes_insert" ON avatars_personnes FOR INSERT
  WITH CHECK (is_store_member(store_id) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "avatars_personnes_update" ON avatars_personnes;
CREATE POLICY "avatars_personnes_update" ON avatars_personnes FOR UPDATE
  USING (is_store_member(store_id))
  WITH CHECK (is_store_member(store_id));

DROP POLICY IF EXISTS "avatars_personnes_delete" ON avatars_personnes;
CREATE POLICY "avatars_personnes_delete" ON avatars_personnes FOR DELETE
  USING (is_store_member(store_id));

-- ─────────────────────────────────────────
-- Le seau des photos
-- ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', FALSE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_lecture_membre" ON storage.objects;
CREATE POLICY "avatars_lecture_membre" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "avatars_depot_membre" ON storage.objects;
CREATE POLICY "avatars_depot_membre" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "avatars_suppression_membre" ON storage.objects;
CREATE POLICY "avatars_suppression_membre" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND is_store_member(storage_boutique_du_chemin(name))
  );
