-- ═══════════════════════════════════════════════════════════════════
-- Cachets et signatures des documents — un seau à part.
--
-- Pourquoi pas `documents` : tout membre y remplace ou supprime un
-- fichier. Un vendeur pourrait donc changer la signature du gérant.
--
--   • lecture : tout membre de la boutique (il imprime les documents) ;
--   • dépôt   : ceux qui règlent les documents (propriétaire, admin,
--               manager) — même règle que `personnalisation.documents` ;
--   • ni remplacement ni suppression : un document émis garde l'image
--     qu'il portait. Retirer un cachet l'ôte de la liste, pas du seau.
--
-- MIGRATION ADDITIVE : aucune table, aucune politique existante touchée.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cachets', 'cachets', FALSE, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "cachets_lecture_membre" ON storage.objects;
CREATE POLICY "cachets_lecture_membre" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cachets'
    AND is_store_member(storage_boutique_du_chemin(name))
  );

DROP POLICY IF EXISTS "cachets_depot_reglages" ON storage.objects;
CREATE POLICY "cachets_depot_reglages" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cachets'
    AND public.peut_regler_les_documents(storage_boutique_du_chemin(name))
  );
