-- ═══════════════════════════════════════════════════════════════════
-- Le logo d'une pièce émise, figé une fois par version.
--
-- Le logo vit en base64 dans `stores.logo_url` (jusqu'à 2 Mo) : le
-- recopier dans chaque copie figée ferait grossir la base de centaines de
-- mégaoctets par an. Chaque VERSION du logo est donc rangée une seule fois
-- ici, sous `<boutique>/<empreinte SHA-256>.<ext>`, et la copie figée ne
-- garde que ce chemin.
--
--   • lecture et dépôt : tout membre de la boutique — c'est le vendeur qui
--     émet la pièce, donc qui dépose la version du logo s'il manque ;
--   • ni remplacement ni suppression : un chemin désigne un contenu, pour
--     toujours. L'application vérifie en plus l'empreinte à la lecture.
--
-- MIGRATION ADDITIVE : aucune table, aucune politique existante touchée.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', FALSE, 5242880,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "logos_lecture_membre" ON storage.objects;
CREATE POLICY "logos_lecture_membre" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "logos_depot_membre" ON storage.objects;
CREATE POLICY "logos_depot_membre" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND is_store_member(storage_boutique_du_chemin(name))
  );
